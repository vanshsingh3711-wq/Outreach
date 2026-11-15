"""Filtered Company Discovery Engine.

Generates targeted search queries based on firmographic filters (industries, roles,
tech stack, location, funding, business model), executes searches across supported
discovery providers with fallback, deduplicates domains against database records,
and optionally triggers deep company enrichment.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import unescape
import json
import logging
import re
import urllib.parse
from typing import Any

import httpx

from outreach.collectors.discover import (
    JUNK_DOMAIN_PATTERNS,
    Serper,
    business_name,
    company_host,
    normalize_domain,
)
from outreach.config import load_env
from outreach.enrichment import CompanyEnricher, validate_and_normalize_url
from outreach.models.company import Company
from outreach.public_http import public_http_client
from outreach.state import StateManager

logger = logging.getLogger("outreach.discovery_engine")

# Aggregator and noise exclusions appended to queries
DEFAULT_EXCLUSIONS = (
    "-site:linkedin.com/jobs -site:indeed.com -site:glassdoor.com "
    "-site:ziprecruiter.com -site:jobright.ai -site:wellfound.com/jobs "
    "-site:upwork.com -site:fiverr.com -site:freelancer.com "
    "-site:crunchbase.com -site:clutch.co -site:levels.fyi "
    "-site:ycombinator.com/jobs -site:remoteok.com -site:weworkremotely.com "
    "-site:github.com -site:medium.com "
    "-site:ibm.com -site:stripe.com -site:adyen.com -site:mastercard.com "
    "-site:visa.com -site:paypal.com -site:microsoft.com -site:google.com "
    "-site:amazon.com -site:apple.com -site:oracle.com -site:salesforce.com "
    '-"apply now" -"job description" -"job opening" -"apply for this role"'
)


@dataclass
class DiscoveryCriteria:
    """Filter criteria used to generate targeted discovery queries."""

    target_type: str = "all"      # "startup" (for jobs), "agency" (for freelance), "all"
    industries: list[str] = field(default_factory=list)
    roles: list[str] = field(default_factory=list)
    tech_stack: list[str] = field(default_factory=list)
    locations: list[str] = field(default_factory=list)
    funding_stage: str = ""       # e.g. "Seed", "Series A", "Bootstrapped"
    revenue_tier: str = ""        # e.g. "Bootstrapped", "< $1M", "$1M - $10M"
    business_model: str = ""      # e.g. "agency", "product", "consulting"
    company_size_tier: str = ""   # e.g. "1-10", "11-50", "51-200"
    custom_query: str = ""        # optional override
    limit: int = 15               # max companies to discover
    auto_enrich: bool = False     # whether to enrich discovered companies immediately
    save_to_db: bool = True       # whether to persist discovered companies to DB immediately


@dataclass
class DiscoveredCandidate:
    """Candidate company identified via filtered search."""

    domain: str
    name: str
    website: str
    title: str = ""
    snippet: str = ""
    source_url: str = ""
    query: str = ""
    rank: int = 0
    is_existing: bool = False
    company_id: str = ""
    enrichment_result: Any = None
    target_type: str = ""
    industry: str = ""
    location: str = ""
    size: str = ""

    def to_dict(self) -> dict:
        people_data = []
        if self.enrichment_result and hasattr(self.enrichment_result, "people"):
            people_data = [
                {
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "title": p.title,
                    "email": getattr(p, "primary_email", ""),
                    "linkedin_url": getattr(p, "linkedin_url", ""),
                    "email_status": getattr(p, "email_status", ""),
                }
                for p in self.enrichment_result.people
            ]

        return {
            "id": self.company_id,
            "company_id": self.company_id,
            "domain": self.domain,
            "name": self.name,
            "website": self.website,
            "title": self.title,
            "snippet": self.snippet,
            "description": self.snippet,
            "source_url": self.source_url,
            "query": self.query,
            "rank": self.rank,
            "is_existing": self.is_existing,
            "enriched": self.enrichment_result is not None,
            "people": people_data,
            "contact_count": len(people_data),
            "target_type": self.target_type,
            "industry": self.industry,
            "location": self.location,
            "size": self.size,
        }


class DiscoveryQueryBuilder:
    """Builds search queries from structured firmographic criteria."""

    @classmethod
    def build_queries(cls, criteria: DiscoveryCriteria) -> list[str]:
        """Generate high-intent search queries based on criteria."""
        if criteria.custom_query:
            return [f"{criteria.custom_query.strip()} {DEFAULT_EXCLUSIONS}".strip()]

        queries: list[str] = []

        industries = criteria.industries or ["AI", "SaaS", "software"]
        locations = criteria.locations or [""]
        techs = criteria.tech_stack or [""]

        # 1. Role-specific hiring query (if explicit role provided)
        if criteria.roles:
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                    for role in criteria.roles:
                        tech_part = f'"{techs[0]}"' if techs and techs[0] else ""
                        q = f'("{ind}") ("hiring {role}" OR "{role}") {tech_part} {loc_part} ("careers" OR "team") {DEFAULT_EXCLUSIONS}'
                        queries.append(cls._clean_query(q))
            return queries[:5]

        # Target Type Routing
        is_agency_mode = criteria.target_type == "agency" or criteria.business_model == "agency"
        is_startup_mode = criteria.target_type == "startup" or criteria.business_model == "product"
        is_both = (criteria.target_type == "all" and criteria.business_model not in ("agency", "product"))

        for ind in industries:
            for loc in locations:
                loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                tech_part = f'"{techs[0]}"' if techs and techs[0] else ""

                size_part = ""
                if criteria.company_size_tier:
                    size_part = f'"{criteria.company_size_tier} employees"'

                rev_part = ""
                if criteria.revenue_tier:
                    rev_part = f'"{criteria.revenue_tier}"'
                elif criteria.funding_stage:
                    rev_part = f'("{criteria.funding_stage} round" OR "{criteria.funding_stage} funded")'

                # A. Tech Startups (for Job Outreach - Founder/CTO pitching)
                if is_startup_mode or is_both:
                    q_prod = f'("{ind} startup" OR "{ind} company" OR "{ind} platform" OR "{ind} SaaS") {tech_part} ("our product" OR "our platform" OR "about us") {loc_part} {size_part} {rev_part} {DEFAULT_EXCLUSIONS}'
                    queries.append(cls._clean_query(q_prod))

                    if tech_part:
                        q_tech = f'("{ind}") ({tech_part}) ("product" OR "platform" OR "pricing") {loc_part} {DEFAULT_EXCLUSIONS}'
                        queries.append(cls._clean_query(q_tech))
                    elif rev_part:
                        q_fund = f'("{ind} startup" OR "{ind} company") {rev_part} {loc_part} {DEFAULT_EXCLUSIONS}'
                        queries.append(cls._clean_query(q_fund))
                    else:
                        q_plat = f'("{ind} startup" OR "{ind} SaaS" OR "{ind} platform") ("pricing" OR "customers" OR "solutions") {loc_part} {DEFAULT_EXCLUSIONS}'
                        queries.append(cls._clean_query(q_plat))

                # B. Agencies & Dev Studios (for Freelance Work - Owner/Partner pitching)
                if is_agency_mode or is_both:
                    q_agency = f'("{ind} agency" OR "software development agency" OR "digital agency") {tech_part} ("our clients" OR "our work" OR "case studies") {loc_part} {size_part} {DEFAULT_EXCLUSIONS}'
                    queries.append(cls._clean_query(q_agency))

                    q_studio = f'("custom software studio" OR "{ind} development agency" OR "product studio") {tech_part} ("our services" OR "case studies") {loc_part} {DEFAULT_EXCLUSIONS}'
                    queries.append(cls._clean_query(q_studio))

        # Deduplicate queries while preserving order
        unique_queries = []
        for q in queries:
            if q not in unique_queries:
                unique_queries.append(q)

        return unique_queries[:5]  # Cap generated queries

    @staticmethod
    def _clean_query(q: str) -> str:
        # Collapse multiple spaces
        return re.sub(r"\s+", " ", q).strip()


# Additional agency, software directory, and marketplace junk patterns
ADDITIONAL_JUNK_PATTERNS = tuple(re.compile(p, re.I) for p in (
    r"(^|\.)(clutch|goodfirms|designrush|sortlist|topdevelopers|themanifest)\.",
    r"(^|\.)(g2|capterra|softwareadvice|trustradius|sourceforge)\.",
    r"(^|\.)(jobright|levels|remoteok|weworkremotely|simplyhired|dice|monster|careerbuilder)\.",
    r"(^|\.)(boards\.greenhouse|jobs\.lever|apply\.workable|jobs\.ashbyhq)\.",
    r"(^|\.)(fiverr|freelancer|toptal|guru|upwork)\.",
    r"(^|\.)(ibm|stripe|adyen|mastercard|visa|paypal|microsoft|google|amazon|apple|oracle|salesforce|cisco|intel|meta|facebook|netflix|accenture|deloitte|mckinsey)\.",
    r"(^|\.)(angelinvestor|angelinvestorsnetwork|venturecapital|techstars)\.",
))


def is_junk_domain(domain: str) -> bool:
    """Return True if domain belongs to aggregators, social, or noise sites."""
    if not domain:
        return True
    low = domain.lower()
    for pat in JUNK_DOMAIN_PATTERNS:
        if pat.search(low):
            return True
    for pat in ADDITIONAL_JUNK_PATTERNS:
        if pat.search(low):
            return True
    return False


class FilteredDiscoveryEngine:
    """Discovers prospective companies matching criteria, with deduplication and enrichment."""

    def __init__(self, state: StateManager, enricher: CompanyEnricher | None = None):
        self.state = state
        self.enricher = enricher or CompanyEnricher(state)

    async def _fetch_duckduckgo_results(self, client: httpx.AsyncClient, query: str, limit: int = 20) -> list[dict]:
        """Zero-cost fallback web search using public search results."""
        results: list[dict] = []
        url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(query)
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        try:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.debug("DDG search returned HTTP %d for query %s", resp.status_code, query)
                return results

            html = resp.text
            # Extract links and snippets from DDG HTML
            link_pattern = re.compile(
                r'<a[^>]+class=["\']result__url["\'][^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
                re.I | re.S,
            )
            snippet_pattern = re.compile(
                r'<a[^>]+class=["\']result__snippet["\'][^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
                re.I | re.S,
            )

            snippets = {}
            for sm in snippet_pattern.finditer(html):
                raw_href = sm.group(1).strip()
                s_text = re.sub(r"<[^>]+>", "", sm.group(2)).strip()
                snippets[raw_href] = s_text

            for m in link_pattern.finditer(html):
                raw_href = m.group(1).strip()
                # Unquote DDG redirect link if wrapped in /l/?uddg=
                target_url = raw_href
                if "/l/?" in raw_href or "uddg=" in raw_href:
                    qs = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
                    target_url = qs.get("uddg", [raw_href])[0]

                if not target_url.startswith("http"):
                    continue

                title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
                snippet = snippets.get(raw_href, "")
                results.append({"link": target_url, "title": title, "snippet": snippet})
                if len(results) >= limit:
                    break

        except Exception as err:
            logger.debug("Error in public fallback search: %s", err)

        return results

    async def discover_companies(
        self,
        criteria: DiscoveryCriteria,
        provider: str = "auto",
    ) -> list[DiscoveredCandidate]:
        """Execute filtered discovery, deduplicate, persist, and optionally enrich."""
        print(f"\n[🔎 ICP DISCOVERY START] Initiating company discovery...", flush=True)
        print(f"  ↳ Industries: {criteria.industries or 'All'}", flush=True)
        print(f"  ↳ Tech Stack: {criteria.tech_stack or 'All'}", flush=True)
        print(f"  ↳ Locations: {criteria.locations or 'Global/Remote'}", flush=True)
        print(f"  ↳ Model/Funding: {criteria.business_model or 'Any'} / {criteria.funding_stage or 'Any'}", flush=True)
        print(f"  ↳ Target Limit: {criteria.limit} companies | Auto-enrich: {criteria.auto_enrich}", flush=True)

        queries = DiscoveryQueryBuilder.build_queries(criteria)
        if not queries:
            print("  ↳ ⚠️ No search queries could be generated from criteria.", flush=True)
            return []

        print(f"  [🎯 QUERY BUILDER] Generated {len(queries)} search query(ies):", flush=True)
        for i, q in enumerate(queries, 1):
            print(f"    ↳ [Q{i}]: {q}", flush=True)

        env = load_env().model_dump()
        serper_key = env.get("serper_api_key", "").strip()
        provider_name = "Serper (Google)" if (provider in ("auto", "serper") and serper_key and not serper_key.startswith("your_")) else "DuckDuckGo Public Search"
        print(f"  [🌐 SEARCH PROVIDER] Using: {provider_name}", flush=True)

        candidates: list[DiscoveredCandidate] = []
        seen_domains: set[str] = set()

        async with public_http_client(timeout=15.0) as client:
            for q_idx, q_str in enumerate(queries, 1):
                if len(candidates) >= criteria.limit:
                    break

                print(f"\n  [🚀 QUERY EXECUTION {q_idx}/{len(queries)}] Running: {q_str}", flush=True)
                raw_items: list[dict] = []
                # 1. Use Serper provider if configured
                if (provider in ("auto", "serper")) and serper_key and not serper_key.startswith("your_"):
                    try:
                        resp = await client.post(
                            "https://google.serper.dev/search",
                            headers={"X-API-KEY": serper_key, "Content-Type": "application/json"},
                            json={"q": q_str, "num": min(criteria.limit, 10), "gl": "us", "hl": "en"},
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            for item in data.get("organic") or []:
                                raw_items.append({
                                    "link": item.get("link", ""),
                                    "title": item.get("title", ""),
                                    "snippet": item.get("snippet", ""),
                                })
                            print(f"    ↳ Received {len(raw_items)} organic results from Serper", flush=True)
                        else:
                            print(f"    ↳ ⚠️ Serper search returned status {resp.status_code}", flush=True)
                    except Exception as err:
                        logger.debug("Serper search failed: %s, falling back to public search", err)
                        print(f"    ↳ ⚠️ Serper search error: {err}. Falling back to public search...", flush=True)

                # 2. Fallback to public search if raw_items empty
                if not raw_items:
                    print(f"    ↳ Dispatched DuckDuckGo fallback query...", flush=True)
                    raw_items = await self._fetch_duckduckgo_results(client, q_str, limit=criteria.limit)
                    print(f"    ↳ Received {len(raw_items)} organic results from DuckDuckGo", flush=True)

                # Process results into candidate companies
                for rank, item in enumerate(raw_items, start=1):
                    raw_link = item.get("link", "")
                    if not raw_link:
                        continue

                    raw_domain = normalize_domain(raw_link)
                    domain = company_host(raw_domain)
                    if not domain:
                        continue

                    if is_junk_domain(domain):
                        print(f"    ↳ ⛔ Filtered out aggregator/directory domain: '{domain}'", flush=True)
                        continue

                    if domain in seen_domains:
                        print(f"    ↳ ⏭️ Skipping already-seen domain in this run: '{domain}'", flush=True)
                        continue
                    seen_domains.add(domain)

                    # Check if company already exists in state
                    existing = await self.state.get_company_by_domain(domain)
                    is_existing = existing is not None
                    b_name = business_name(item.get("title", ""), domain)

                    # Determine target type (Startup vs Agency)
                    detected_type = criteria.target_type
                    snippet_lower = (item.get("snippet", "") + " " + item.get("title", "")).lower()
                    if "agency" in snippet_lower or "studio" in snippet_lower or "consultancy" in snippet_lower:
                        detected_type = "agency"
                    elif criteria.target_type in ("startup", "agency"):
                        detected_type = criteria.target_type
                    else:
                        detected_type = "startup"

                    cand_industry = criteria.industries[0] if criteria.industries else ("Digital Agency" if detected_type == "agency" else "Technology")
                    cand_location = criteria.locations[0] if criteria.locations else "Remote"
                    cand_size = criteria.company_size_tier if criteria.company_size_tier else ""

                    cand = DiscoveredCandidate(
                        domain=domain,
                        name=existing.name if existing and existing.name else b_name,
                        website=raw_link if not existing else (existing.website or raw_link),
                        title=item.get("title", ""),
                        snippet=item.get("snippet", ""),
                        source_url=raw_link,
                        query=q_str,
                        rank=rank,
                        is_existing=is_existing,
                        company_id=existing.id if existing else "",
                        target_type=detected_type,
                        industry=cand_industry,
                        location=cand_location,
                        size=cand_size,
                    )

                    # Persist company record in database only if criteria.save_to_db is True
                    if not is_existing:
                        if criteria.save_to_db:
                            print(f"    ↳ ✅ Accepted & Saved to DB: '{cand.name}' ({domain}) [{detected_type.upper()}]", flush=True)
                            company_record = Company(
                                domain=domain,
                                name=cand.name,
                                website=cand.website,
                                description=cand.snippet[:400],
                                source="company_discovery",
                                source_url=raw_link,
                                notes=f"Discovered via query: {q_str[:200]}",
                                industry=cand_industry,
                                location=cand_location,
                                size=cand_size,
                            )
                            cid = await self.state.add_company(company_record)
                            cand.company_id = cid
                        else:
                            print(f"    ↳ ⚡ Staged temporary candidate (not saved to DB): '{cand.name}' ({domain}) [{detected_type.upper()}]", flush=True)
                            cand.company_id = f"staged_{domain.replace('.', '_')}"
                    else:
                        print(f"    ↳ 🔄 Existing company verified: '{cand.name}' ({domain}) -> ID: {existing.id}", flush=True)
                        cand.company_id = existing.id

                    # 3. Optional Auto-Enrichment (bounded timeout to prevent proxy gateway timeouts)
                    if criteria.auto_enrich:
                        print(f"      ↳ ⚡ Auto-enriching {cand.name} ({cand.website})...", flush=True)
                        try:
                            try:
                                enrich_coro = self.enricher.enrich_url(cand.website, persist=criteria.save_to_db)
                            except TypeError:
                                enrich_coro = self.enricher.enrich_url(cand.website)
                            res = await asyncio.wait_for(enrich_coro, timeout=8.0)
                            cand.enrichment_result = res
                            print(f"      ↳ ⚡ Auto-enrichment complete: {len(res.people)} decision-makers found", flush=True)
                        except Exception as e_err:
                            logger.debug("Auto-enrichment error for %s: %s", cand.website, e_err)
                            print(f"      ↳ ⚡ Auto-enrichment timeout/skip: {e_err}", flush=True)

                    candidates.append(cand)
                    if len(candidates) >= criteria.limit:
                        print(f"  ↳ Target limit of {criteria.limit} reached.", flush=True)
                        break

        print(f"\n[✨ ICP DISCOVERY COMPLETE] Discovered {len(candidates)} companies total.\n", flush=True)
        return candidates
