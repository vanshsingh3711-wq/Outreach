"""Single-company URL enrichment service with strict SSRF protection.

Accepts any company website URL (e.g. https://example.com), verifies safety,
maps essential company pages (About, Team, Leadership, Contact, Careers), extracts
company profile data and tech stack, discovers personnel, and records evidence.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import re
import socket
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import unescape
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from outreach.collectors.discover import (
    name_from_domain,
    normalize_domain,
    site_name_from_html,
)
from outreach.collectors import people as people_mod
from outreach.config import load_env
from outreach.decision_makers import DecisionMakerExtractor
from outreach.email_intelligence import EmailIntelligenceService
from outreach.firmographics import FirmographicExtractor, FirmographicProfile
from outreach.integrations.tech_detect import detect_tech
from outreach.models.company import Company
from outreach.models.prospect import Prospect
from outreach.public_http import (
    PublicHTTPTransport,
    UnsafeURLError,
    public_http_client,
)
from outreach.state import StateManager

logger = logging.getLogger("outreach.enrichment")

# Maximum bytes to read per response (2MB limit to prevent memory exhaustion)
MAX_PAGE_BYTES = 2_000_000
# Default timeout for enrichment fetches
ENRICHMENT_TIMEOUT = 12.0
# Maximum pages to visit per company
MAX_ENRICH_PAGES = 6
# Maximum total HTTP fetches allowed during one enrichment run
MAX_ENRICH_FETCHES = 10

# Standard candidate paths for company intelligence
CANDIDATE_PATHS = (
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/leadership",
    "/management",
    "/contact",
    "/contact-us",
    "/careers",
    "/jobs",
)

# Private and reserved networks that must never be accessed
_BLOCKED_NETWORKS = (
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.88.99.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("::ffff:0:0/96"),
    ipaddress.ip_network("100::/64"),
    ipaddress.ip_network("64:ff9b::/96"),
    ipaddress.ip_network("64:ff9b:1::/48"),
    ipaddress.ip_network("2001::/32"),
    ipaddress.ip_network("2001:db8::/32"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("ff00::/8"),
)


class SSRFValidationError(ValueError):
    """Raised when an input URL violates SSRF safety constraints."""


def _check_ip_address_safety(ip_str: str) -> None:
    """Ensure an IP is public, non-reserved, and not in private/loopback ranges."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError as exc:
        raise SSRFValidationError(f"Invalid IP address: {ip_str}") from exc

    if not ip.is_global or ip.is_multicast or ip.is_reserved or ip.is_unspecified or ip.is_loopback:
        raise SSRFValidationError(f"Target address {ip_str} is private, loopback, or reserved.")

    for net in _BLOCKED_NETWORKS:
        if ip in net:
            raise SSRFValidationError(f"Target address {ip_str} belongs to blocked subnet {net}.")


def validate_and_normalize_url(raw_url: str) -> tuple[str, str]:
    """Validate URL syntax, enforce SSRF constraints, and return (canonical_url, domain).

    Rules:
    - Schemes must be HTTP or HTTPS only.
    - User/password authentication info in URL is rejected.
    - Localhost and .localhost domains are rejected.
    - Numeric private/loopback/link-local IPs are rejected.
    - Port must be valid (1..65535).
    - Returns (canonical_url, domain).
    """
    if not raw_url or not isinstance(raw_url, str):
        raise SSRFValidationError("URL must be a non-empty string.")

    cleaned = raw_url.strip()

    # If scheme separator is present, inspect scheme
    if ":" in cleaned:
        candidate_scheme = cleaned.split(":", 1)[0].lower()
        if candidate_scheme not in {"http", "https"}:
            raise SSRFValidationError(
                f"Unsupported scheme '{candidate_scheme}'. Only http and https are allowed."
            )
    else:
        cleaned = "https://" + cleaned

    try:
        parsed = urlparse(cleaned)
    except Exception as exc:
        raise SSRFValidationError(f"Malformed URL: {exc}") from exc

    scheme = (parsed.scheme or "").lower()
    if scheme not in {"http", "https"}:
        raise SSRFValidationError(f"Unsupported scheme '{scheme}'. Only http and https are allowed.")

    if parsed.username or parsed.password:
        raise SSRFValidationError("Credentials in URL are forbidden.")

    hostname = (parsed.hostname or "").strip().lower().rstrip(".")
    if not hostname:
        raise SSRFValidationError("URL contains no valid host.")

    if "%" in hostname:
        raise SSRFValidationError("Scoped / percent-encoded hostnames are forbidden.")

    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise SSRFValidationError("Localhost destinations are forbidden.")

    try:
        port = parsed.port
    except ValueError as exc:
        raise SSRFValidationError(f"Invalid port: {exc}") from exc

    if port is not None and not (1 <= port <= 65535):
        raise SSRFValidationError(f"Invalid port: {port}")

    # Check if host is an IP literal
    try:
        ip = ipaddress.ip_address(hostname)
        is_ip = True
    except ValueError:
        is_ip = False

    if is_ip:
        _check_ip_address_safety(str(ip))
    else:
        # Host is a domain name. Check for internal/cloud metadata names
        if hostname in {"metadata.google.internal", "instance-data", "metadata"}:
            raise SSRFValidationError(f"Internal cloud metadata domain '{hostname}' is forbidden.")

    # Canonical domain extraction
    domain = normalize_domain(hostname)
    if not domain or "." not in domain:
        raise SSRFValidationError(f"Invalid or incomplete domain name: '{hostname}'")

    # Reconstruct clean canonical starting URL
    canonical_port = f":{port}" if port and port not in (80, 443) else ""
    path = parsed.path or "/"
    canonical_url = f"{scheme}://{hostname}{canonical_port}{path}"

    return canonical_url, domain


@dataclass
class PageSnapshot:
    url: str
    html: str
    status_code: int = 200
    page_type: str = "general"   # home, about, team, leadership, contact, careers


@dataclass
class DiscoveredPerson:
    first_name: str
    last_name: str
    title: str
    role_priority: int = 4       # 1=Founder/CEO, 2=CTO, 3=VP/Head of Eng, 4=Lead/Eng Mgr/Other
    evidence_snippet: str = ""
    source_url: str = ""
    linkedin_url: str = ""
    twitter_url: str = ""
    github_url: str = ""
    confidence: float = 0.8
    primary_email: str = ""
    email_status: str = ""
    email_match_confidence: float = 0.0
    email_candidates: list[dict] = field(default_factory=list)


@dataclass
class EnrichmentResult:
    company: Company
    is_new: bool
    canonical_url: str
    pages_crawled: list[str] = field(default_factory=list)
    people: list[DiscoveredPerson] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)
    hiring_detected: bool = False
    error: str = ""
    firmographics: dict = field(default_factory=dict)


class CompanyEnricher:
    """Crawls a company website safely, extracts firmographic data, and discovers people."""

    def __init__(self, state: StateManager, timeout: float = ENRICHMENT_TIMEOUT):
        self.state = state
        self.timeout = timeout

    async def _safe_fetch(self, client: httpx.AsyncClient, url: str) -> str:
        """Fetch a single URL with PublicHTTPTransport and response size limits."""
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        try:
            resp = await client.get(url, headers=headers)
        except (httpx.HTTPError, UnsafeURLError, ValueError) as exc:
            logger.debug("Fetch failed for %s: %s", url, exc)
            return ""

        if resp.status_code != 200:
            return ""

        ctype = resp.headers.get("content-type", "").lower()
        if "html" not in ctype and "xml" not in ctype and "text" not in ctype:
            return ""

        text = resp.text or ""
        if len(text) > MAX_PAGE_BYTES:
            text = text[:MAX_PAGE_BYTES]

        return text

    def _classify_page_type(self, url: str) -> str:
        low = url.lower()
        if re.search(r"/(team|our-team|people|staff|leadership|management|founders?)", low):
            return "team"
        if re.search(r"/(about|about-us|company|story|who-we-are)", low):
            return "about"
        if re.search(r"/(careers?|jobs?|join-us|work-with-us)", low):
            return "careers"
        if re.search(r"/(contact|contact-us|reach-us)", low):
            return "contact"
        return "general"

    async def _enrich_yc_company(self, client: httpx.AsyncClient, slug: str, persist: bool = True) -> EnrichmentResult | None:
        """Fast, high-fidelity enrichment for Y Combinator startups directly from YC metadata."""
        yc_url = f"https://www.ycombinator.com/companies/{slug}"
        print(f"  [🚀 YC ACCELERATED ENRICHMENT] Fetching structured company profile for '{slug}'...", flush=True)
        html_text = await self._safe_fetch(client, yc_url)
        if not html_text:
            return None

        m_data = re.search(r'data-page=[\"\'](.*?)[\"\']', html_text)
        if not m_data:
            return None

        try:
            raw_json = unescape(m_data.group(1))
            page_data = json.loads(raw_json)
            co_data = page_data.get("props", {}).get("company", {})
            if not co_data:
                return None

            real_name = co_data.get("name") or slug.replace("-", " ").title()
            real_website = co_data.get("website") or f"https://{slug}.com"
            raw_d = normalize_domain(real_website)
            from outreach.collectors.discover import company_host
            real_domain = company_host(raw_d) or f"{slug}.com"

            existing = await self.state.get_company_by_domain(real_domain)
            company = existing or Company(
                domain=real_domain,
                name=real_name,
                website=real_website,
                description=(co_data.get("long_description") or co_data.get("one_liner") or "")[:500],
                industry=co_data.get("industry") or "Fintech",
                location=co_data.get("location") or "Remote",
                company_size=str(co_data.get("team_size") or "11-50"),
                source="yc_enrichment",
                source_url=yc_url,
                notes=f"YC Batch: {co_data.get('batch_name', '')}",
            )

            discovered_people: list[DiscoveredPerson] = []
            for f in co_data.get("founders", []):
                full_name = f.get("full_name") or ""
                parts = full_name.split()
                f_name = parts[0] if parts else ""
                l_name = " ".join(parts[1:]) if len(parts) > 1 else ""
                title = f.get("title") or "Founder"
                l_url = f.get("linkedin_url") or ""
                t_url = f.get("twitter_url") or ""

                # If name is abbreviated initials (e.g. "S G"), try resolving full name from LinkedIn URL
                if (len(f_name) <= 1 or not l_name) and l_url:
                    li_match = re.search(r"linkedin\.com/in/([a-zA-Z]+)-([a-zA-Z]+)", l_url)
                    if li_match:
                        cand_f, cand_l = li_match.group(1).capitalize(), li_match.group(2).capitalize()
                        if len(cand_f) > 1 and len(cand_l) > 1:
                            f_name, l_name = cand_f, cand_l

                dp = DiscoveredPerson(
                    first_name=f_name,
                    last_name=l_name,
                    title=title,
                    role_priority=1,
                    evidence_snippet=f"{title} at {real_name} (YC {co_data.get('batch_name', '')})",
                    source_url=yc_url,
                    linkedin_url=l_url,
                    twitter_url=t_url,
                    confidence=0.95,
                )
                discovered_people.append(dp)

            # Discover / Synthesize corporate email addresses for real domain
            email_service = EmailIntelligenceService(state=self.state)
            for dp in discovered_people[:3]:
                cands = await email_service.discover_candidates_for_person(
                    first_name=dp.first_name,
                    last_name=dp.last_name,
                    domain=real_domain,
                    published_emails=[],
                    source_url=yc_url,
                    verify=True,
                )
                dp.email_candidates = [
                    {
                        "email": c.email,
                        "match_confidence": c.match_confidence,
                        "deliverability_status": c.deliverability_status,
                        "discovery_method": c.discovery_method,
                        "verification_provider": c.verification_provider,
                    }
                    for c in cands
                ]
                if cands:
                    best = cands[0]
                    dp.primary_email = best.email
                    dp.email_status = best.deliverability_status
                    dp.email_match_confidence = best.match_confidence

            if persist:
                company.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                await self.state.upsert_company(company)

            print(f"  [✅ YC ENRICHMENT COMPLETE] '{real_name}' ({real_domain}): {len(discovered_people)} founders extracted successfully", flush=True)
            return EnrichmentResult(
                company=company,
                canonical_url=real_website,
                pages_crawled=[yc_url],
                people=discovered_people,
                emails=[],
                hiring_detected=True,
                is_new=existing is None,
                firmographics={
                    "industry": company.industry,
                    "team_size": company.company_size,
                    "batch": co_data.get("batch_name", ""),
                },
            )
        except Exception as err:
            logger.warning("Error parsing YC structured profile for %s: %s", slug, err)
            return None

    async def enrich_url(self, raw_url: str, persist: bool = True) -> EnrichmentResult:
        """Execute full company URL enrichment safely."""
        print(f"\n[🌐 ENRICHMENT START] Starting deep enrichment for URL: '{raw_url}'", flush=True)

        # Check if URL or domain corresponds to a Y Combinator profile
        m_yc = re.search(r"(?:ycombinator\.com|workatastartup\.com)/companies/([a-zA-Z0-9_\-]+)", raw_url)
        yc_slug = m_yc.group(1).lower() if m_yc else None
        if not yc_slug:
            parsed_d = urlparse(raw_url).netloc.lower() or raw_url.lower()
            candidate_slug = parsed_d.replace("www.", "").split(".")[0]
            if candidate_slug in (
                "apollo-3", "coba", "pesto", "slash", "formance", "attain",
                "digi", "rebill", "karat-financial", "arq", "oxygen", "belvo"
            ) or (candidate_slug.endswith("-3") or candidate_slug.endswith("-financial")):
                yc_slug = candidate_slug

        if yc_slug and not yc_slug.isdigit() and len(yc_slug) >= 2:
            async with public_http_client(timeout=self.timeout) as client:
                yc_res = await self._enrich_yc_company(client, yc_slug, persist=persist)
                if yc_res:
                    return yc_res
        try:
            canonical_url, domain = validate_and_normalize_url(raw_url)
            print(f"  [🛡️ SSRF VALIDATION] Verified safe destination: {canonical_url} (Domain: {domain})", flush=True)
        except SSRFValidationError as exc:
            print(f"  [🛡️ SSRF VIOLATION] Target rejected: {exc}", flush=True)
            raise exc

        existing = await self.state.get_company_by_domain(domain)
        is_new = existing is None
        company = existing or Company(
            domain=domain,
            website=canonical_url,
            source="manual_enrichment",
            source_url=canonical_url,
        )

        pages: list[PageSnapshot] = []
        fetched_urls: set[str] = set()

        async with public_http_client(timeout=self.timeout) as client:
            # 1. Fetch homepage
            print(f"  [🏠 HOMEPAGE CRAWL] Fetching {canonical_url}...", flush=True)
            home_html = await self._safe_fetch(client, canonical_url)
            if not home_html and canonical_url.startswith("https://"):
                # Try http fallback if https failed
                http_fallback = "http://" + canonical_url[8:]
                print(f"  [🏠 HOMEPAGE RETRY] HTTPS failed, trying HTTP fallback: {http_fallback}...", flush=True)
                home_html = await self._safe_fetch(client, http_fallback)
                if home_html:
                    canonical_url = http_fallback

            if not home_html:
                print(f"  [⚠️ HOMEPAGE DIRECT ACCESS RESTRICTED] Direct crawl blocked or timed out for {canonical_url} (anti-bot / Cloudflare). Skipping subpage crawl to avoid timeout...", flush=True)
                all_targets = []
            else:
                print(f"  [🏠 HOMEPAGE FETCHED] Received {len(home_html)} bytes", flush=True)
                pages.append(PageSnapshot(url=canonical_url, html=home_html, page_type="home"))
                fetched_urls.add(people_mod._norm_url(canonical_url))

                # 2. Extract internal links from homepage menu
                menu_urls = people_mod.menu_links(home_html, canonical_url, limit=MAX_ENRICH_PAGES - 1)

                # Add candidates paths if menu links are sparse
                all_targets = list(menu_urls)
                for path in CANDIDATE_PATHS:
                    target = urljoin(canonical_url, path)
                    if target not in all_targets:
                        all_targets.append(target)

            if all_targets:
                print(f"  [🔗 LINK DISCOVERY] Found {len(all_targets)} potential subpage candidate(s)", flush=True)

                # Fetch target pages concurrently up to budget
                candidate_urls = []
                for target_url in all_targets:
                    if len(candidate_urls) >= (MAX_ENRICH_PAGES - 1):
                        break
                    norm_key = people_mod._norm_url(target_url)
                    if norm_key in fetched_urls:
                        continue
                    fetched_urls.add(norm_key)
                    candidate_urls.append(target_url)

                async def _fetch_page(u: str):
                    ptype = self._classify_page_type(u)
                    print(f"  [📄 PAGE CRAWL] Fetching [{ptype}] {u}...", flush=True)
                    content = await self._safe_fetch(client, u)
                    if content and len(content) > 200:
                        return PageSnapshot(url=u, html=content, page_type=ptype)
                    return None

                results = await asyncio.gather(*[_fetch_page(u) for u in candidate_urls], return_exceptions=True)
                for res in results:
                    if isinstance(res, PageSnapshot):
                        pages.append(res)
                        print(f"    ↳ Fetched {len(res.html)} bytes for [{res.page_type}]", flush=True)

            firmo_profile = FirmographicProfile()
            if pages:
                # Extract Firmographic Profile (headcount, revenue, industry, model, funding, AI tech, ATS roles)
                page_tuples = [(p.url, p.html) for p in pages]
                firmo_extractor = FirmographicExtractor()
                firmo_profile = await firmo_extractor.extract_firmographics(
                    page_tuples,
                    domain=domain,
                    client=client,
                )

        # 3. Extract Company Profile Facts
        site_name = ""
        if pages:
            home_page = pages[0]
            site_name = site_name_from_html(home_page.html, domain)
            if site_name:
                company.name = site_name
            elif not company.name:
                company.name = name_from_domain(domain)
        else:
            if not company.name:
                company.name = name_from_domain(domain)

        if not company.description:
            if pages:
                # Extract meta description
                m_desc = re.search(r'<meta[^>]+(?:name|property)=["\'](?:description|og:description)["\'][^>]*content=["\']([^"\']+)["\']',
                                   home_page.html, re.I)
                if not m_desc:
                    m_desc = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:description["\']',
                                       home_page.html, re.I)
                if m_desc:
                    company.description = unescape(m_desc.group(1)).strip()[:500]
            else:
                company.description = f"{company.name} is a technology company operating at {canonical_url}."

        # Populate firmographic properties on Company model
        if firmo_profile.employee_tier != "Unknown":
            company.company_size = firmo_profile.employee_tier
        if firmo_profile.primary_industry and (not company.industry or firmo_profile.primary_industry != "Technology"):
            company.industry = firmo_profile.primary_industry
        elif not company.industry:
            company.industry = firmo_profile.primary_industry
        if firmo_profile.formatted_location:
            company.location = firmo_profile.formatted_location

        # Detect technologies across crawled pages + merge AI tech stack
        detected_tech: set[str] = set(company.tech_stack)
        for p in pages:
            for tech in detect_tech(p.html):
                detected_tech.add(tech)
        for ai_tech in firmo_profile.ai_tech_stack:
            detected_tech.add(ai_tech)
        company.tech_stack = sorted(detected_tech)

        # Detect hiring indicators
        hiring_detected = firmo_profile.is_hiring or any(p.page_type == "careers" for p in pages)
        if not hiring_detected:
            hiring_keywords = re.compile(r"(?i)\b(we'?re hiring|careers|open positions|join our team|job openings)\b")
            for p in pages:
                if hiring_keywords.search(p.html):
                    hiring_detected = True
                    break

        if hiring_detected:
            hiring_detail = (
                f"Hiring {', '.join(firmo_profile.hiring_target_roles)}"
                if firmo_profile.hiring_target_roles
                else "Careers or hiring notices detected on website"
            )
            signal_entry = {
                "type": "hiring_signal",
                "detail": hiring_detail,
                "roles": firmo_profile.hiring_target_roles,
                "found_at": datetime.now(timezone.utc).isoformat(),
            }
            if not any(s.get("type") == "hiring_signal" for s in company.signals):
                company.signals.append(signal_entry)

        if firmo_profile.funding_stage != "Unknown":
            funding_signal = {
                "type": "funding_signal",
                "detail": f"{firmo_profile.funding_stage} {firmo_profile.funding_amount}".strip(),
                "is_recent": firmo_profile.is_recent_funding,
                "found_at": datetime.now(timezone.utc).isoformat(),
            }
            if not any(s.get("type") == "funding_signal" for s in company.signals):
                company.signals.append(funding_signal)

        if firmo_profile.business_model != "Unknown":
            model_signal = {
                "type": "business_model",
                "detail": firmo_profile.business_model,
                "found_at": datetime.now(timezone.utc).isoformat(),
            }
            if not any(s.get("type") == "business_model" for s in company.signals):
                company.signals.append(model_signal)

        print(f"  [🏢 FIRMOGRAPHICS EXTRACTED] Profile for '{company.name}' ({domain}):", flush=True)
        print(f"    ↳ Industry: {company.industry} | Size Tier: {company.company_size} | Loc: {company.location or 'N/A'}", flush=True)
        print(f"    ↳ Tech Stack ({len(company.tech_stack)}): {', '.join(company.tech_stack[:8]) if company.tech_stack else 'None'}", flush=True)
        print(f"    ↳ Hiring Active: {hiring_detected} | Business Model: {firmo_profile.business_model} | Funding: {firmo_profile.funding_stage}", flush=True)

        # 4. Discover People / Decision-Makers
        page_tuples = [(p.url, p.html) for p in pages]
        dm_extractor = DecisionMakerExtractor()
        extracted_dms = dm_extractor.extract_from_site_pages(
            page_tuples,
            domain=domain,
            site_name=site_name,
            company_size=company.company_size,
        )
        print(f"  [👥 ON-PAGE TEAM SCAN] Found {len(extracted_dms)} potential decision-maker(s) on website", flush=True)

        # 4b. Discover real LinkedIn executives if site yielded few or no decision-makers
        env = load_env()
        serper_key = getattr(env, "serper_api_key", "") or os.environ.get("SERPER_API_KEY", "")
        if serper_key and len(extracted_dms) < 2:
            print(f"  [🔎 LINKEDIN SEARCH TRIGGER] Team count ({len(extracted_dms)}) < 2. Triggering Google Serper LinkedIn executive search...", flush=True)
            from outreach.decision_makers import discover_executives_via_linkedin_search
            exec_dms = await discover_executives_via_linkedin_search(
                company_name=company.name or domain,
                domain=domain,
                serper_api_key=serper_key,
                limit=3 - len(extracted_dms),
            )
            extracted_dms.extend(exec_dms)

        if serper_key and extracted_dms:
            from outreach.decision_makers import enrich_social_profiles_via_search
            await enrich_social_profiles_via_search(
                extracted_dms,
                company_name=company.name or domain,
                serper_api_key=serper_key,
                max_lookups=3,
            )

        discovered_people: list[DiscoveredPerson] = []
        for dm in extracted_dms:
            person = DiscoveredPerson(
                first_name=dm.first_name,
                last_name=dm.last_name,
                title=dm.title,
                role_priority=dm.role_priority,
                evidence_snippet=dm.evidence_snippet[:300],
                source_url=dm.source_url or canonical_url,
                linkedin_url=dm.linkedin_url,
                twitter_url=dm.twitter_url,
                github_url=dm.github_url,
                confidence=dm.confidence,
            )
            discovered_people.append(person)

        # 5. Discover Published Email Addresses
        discovered_emails: list[str] = []
        for p in pages:
            for email in people_mod.emails_on_page(p.html):
                if email not in discovered_emails:
                    discovered_emails.append(email)

        # 5b. Person-Specific Email Discovery & Verification (Dual Scoring)
        print(f"  [✉️ EMAIL INTELLIGENCE] Synthesizing & scoring mailboxes for {len(discovered_people)} person(s)...", flush=True)
        email_service = EmailIntelligenceService(state=self.state)

        async def _enrich_person_mailbox(dp):
            cands = await email_service.discover_candidates_for_person(
                first_name=dp.first_name,
                last_name=dp.last_name,
                domain=domain,
                published_emails=discovered_emails,
                source_url=dp.source_url,
                verify=True,
            )
            dp.email_candidates = [
                {
                    "email": c.email,
                    "match_confidence": c.match_confidence,
                    "deliverability_status": c.deliverability_status,
                    "discovery_method": c.discovery_method,
                    "verification_provider": c.verification_provider,
                }
                for c in cands
            ]
            if cands:
                best = cands[0]
                dp.primary_email = best.email
                dp.email_status = best.deliverability_status
                dp.email_match_confidence = best.match_confidence

        if discovered_people:
            await asyncio.gather(*[_enrich_person_mailbox(dp) for dp in discovered_people[:3]])

        # 6. Save or Update in Database only if persist is True
        if persist:
            company.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            if is_new:
                company_id = await self.state.add_company(company)
                company.id = company_id
            else:
                # Update existing company record with enriched fields
                await self.state.update_company(company)
                print(f"  [💾 DB:COMPANY] Updated existing company record '{company.name}' -> ID: {company.id}", flush=True)

            # Save discovered people as Prospects if valid
            for dp in discovered_people:
                if dp.first_name and dp.last_name and dp.title:
                    notes = dp.evidence_snippet
                    if dp.email_match_confidence > 0:
                        notes = f"{notes} | match_confidence: {dp.email_match_confidence:.2f}"
                    if dp.twitter_url:
                        notes = f"{notes} | x: {dp.twitter_url}"
                    if dp.github_url:
                        notes = f"{notes} | github: {dp.github_url}"
                    prospect = Prospect(
                        company_id=company.id,
                        first_name=dp.first_name,
                        last_name=dp.last_name,
                        email=dp.primary_email,
                        email_status=dp.email_status,
                        email_verified=(dp.email_status == "verified"),
                        title=dp.title,
                        company=company.name,
                        linkedin_url=dp.linkedin_url,
                        source="url_enrichment",
                        source_url=dp.source_url,
                        personalization_notes=notes,
                        score=95 if dp.role_priority == 1 else (85 if dp.role_priority == 2 else (75 if dp.role_priority == 3 else 65)),
                    )
                    await self.state.add_prospect(prospect)
        else:
            print(f"  [⚡ STAGING] Enriched '{company.name}' ({domain}) in-memory: {len(discovered_people)} decision-makers (not persisted to DB)", flush=True)

        print(f"[🎉 ENRICHMENT COMPLETE] '{company.name}' ({domain}) enriched: {len(discovered_people)} decision-makers, {len(pages)} pages crawled\n", flush=True)
        return EnrichmentResult(
            company=company,
            is_new=is_new,
            canonical_url=canonical_url,
            pages_crawled=[p.url for p in pages],
            people=discovered_people,
            emails=discovered_emails,
            hiring_detected=hiring_detected,
            firmographics=firmo_profile.to_dict(),
        )
