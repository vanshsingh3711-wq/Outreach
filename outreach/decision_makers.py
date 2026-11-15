"""Technical decision-maker discovery, title normalization, and role prioritization.

Identifies founders, CTOs, VPs of Engineering, Engineering Managers, and AI leads
from company web pages and external sources, with strict evidence tracking,
anti-confusion guards (excluding former staff, investors, and clients), and
company-size aware dynamic ranking.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import unescape
from typing import Any
from urllib.parse import unquote, urljoin

from outreach.collectors.discover import normalize_domain
from outreach.collectors.people import (
    drop_quoted,
    fold_accents,
    nfc,
    split_person_name,
    title_names_other_org,
)

logger = logging.getLogger("outreach.decision_makers")

# ── Role Priority Categories ──────────────────────────────────────────
# Priority 1: Founders, Co-Founders, CEOs
P1_FOUNDER_CEO = re.compile(
    r"\b(?:co-?founder|founder|cofounder|ceo|chief executive officer|(?<!vice[- ])(?<!vice\s)president|managing director)\b",
    re.I,
)

# Priority 2: CTOs, Chief Technology Officers
P2_CTO = re.compile(
    r"\b(?:cto|chief technology officer|chief technical officer|chief technology and product officer)\b",
    re.I,
)

# Priority 3: VP of Engineering, Head of Engineering, Director of Engineering
P3_ENG_LEADERSHIP = re.compile(
    r"\b(?:vp of engineering|vice president of engineering|vp engineering|vice president engineering|"
    r"head of engineering|director of engineering|head of tech|director of tech|vp technology|"
    r"vice president technology|head of software|director of software)\b",
    re.I,
)

# Priority 4: Engineering Managers, Technical Leads, AI / ML Heads
P4_ENG_MANAGEMENT = re.compile(
    r"\b(?:engineering manager|eng manager|em\b|technical lead|tech lead|ai engineering lead|"
    r"head of ai|head of artificial intelligence|head of machine learning|head of ml|"
    r"lead ai engineer|ai lead|ml lead|software engineering manager|lead software engineer|"
    r"principal ai engineer|staff ai engineer|ai architect)\b",
    re.I,
)

# ── Negative Patterns (Exclusions) ────────────────────────────────────
# Former / departed staff
_FORMER_STAFF = re.compile(
    r"\b(?:former|past|ex-|alumni|retired|previously|in memory of|memoriam|late)\b",
    re.I,
)

# Non-operating roles: Advisors, Investors, Board Members
_ADVISOR_OR_INVESTOR = re.compile(
    r"\b(?:advisor|adviser|board member|board of directors|investor|angel investor|"
    r"venture partner|seed investor|board observer|advisory board|investors)\b",
    re.I,
)

# Non-decision-making or subordinate roles
_SUBORDINATE_ROLES = re.compile(
    r"\b(?:assistant to|executive assistant|assistant|intern|internship|receptionist|"
    r"office manager|sales rep|account executive|customer support|junior recruiter)\b",
    re.I,
)

# Social profile URL regexes
_LINKEDIN_PROFILE_RE = re.compile(
    r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/([a-zA-Z0-9_\-%]+)",
    re.I,
)
_TWITTER_PROFILE_RE = re.compile(
    r"https?://(?:www\.)?(?:twitter\.com|x\.com)/(?!home|share|intent|search|hashtag|privacy|terms|explore|login|signup|i/)([a-zA-Z0-9_]{1,30})\b",
    re.I,
)
_GITHUB_PROFILE_RE = re.compile(
    r"https?://(?:www\.)?github\.com/(?!features|pricing|enterprise|about|blog|explore|topics|orgs|site|marketplace)([a-zA-Z0-9_-]{1,39})\b",
    re.I,
)


@dataclass
class DecisionMakerConfig:
    """Configuration for decision-maker extraction and prioritization."""
    startup_size_threshold: int = 50
    min_confidence: float = 0.50
    exclude_advisors: bool = True
    exclude_former: bool = True
    max_people_per_company: int = 15


@dataclass
class DecisionMaker:
    first_name: str
    last_name: str
    title: str
    role_priority: int
    company_name: str = ""
    company_domain: str = ""
    linkedin_url: str = ""
    twitter_url: str = ""
    github_url: str = ""
    evidence_snippet: str = ""
    source_url: str = ""
    confidence: float = 0.8
    seniority: str = ""
    primary_email: str = ""
    email_status: str = ""
    email_match_confidence: float = 0.0
    email_candidates: list[Any] = field(default_factory=list)
    discovered_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


def normalize_technical_title(title: str) -> tuple[str, int, str]:
    """Analyze a title and return (normalized_title, default_priority, seniority).

    Returns:
        (canonical_clean_title, priority_level [1..4], seniority_tag)
    """
    clean = re.sub(r"\s+", " ", title or "").strip(" ,.-|–—")
    clean = unescape(clean)
    folded = fold_accents(clean).lower()

    if P2_CTO.search(folded):
        return clean, 2, "c_suite"
    if P3_ENG_LEADERSHIP.search(folded):
        return clean, 3, "vp"
    if P1_FOUNDER_CEO.search(folded):
        return clean, 1, "c_suite"
    if P4_ENG_MANAGEMENT.search(folded):
        return clean, 4, "manager"

    # Fallback checks
    if re.search(r"\b(chief|c-level)\b", folded):
        return clean, 2, "c_suite"
    if re.search(r"\b(director)\b", folded):
        return clean, 3, "director"
    if re.search(r"\b(lead|manager)\b", folded):
        return clean, 4, "lead"

    return clean, 4, "individual"


async def normalize_technical_title_async(
    title: str,
    company_name: str = "",
    use_ai: bool = True,
) -> tuple[str, int, str]:
    """Analyze a title using heuristic rules and optional DeepSeek AI for eccentric titles."""
    clean, base_prio, base_seniority = normalize_technical_title(title)
    if not use_ai:
        return clean, base_prio, base_seniority

    try:
        from outreach.deepseek import get_deepseek_client

        client = get_deepseek_client()
        if client.is_available():
            norm_res = await client.normalize_title(title, company_name)
            if norm_res and norm_res.get("normalized_title"):
                return (
                    str(norm_res["normalized_title"]),
                    int(norm_res.get("role_priority", base_prio)),
                    str(norm_res.get("seniority", base_seniority)),
                )
    except Exception as exc:
        logger.debug("DeepSeek title normalization skipped: %s", exc)

    return clean, base_prio, base_seniority


def classify_role_priority(
    title: str,
    company_size: str | int = "",
    config: DecisionMakerConfig | None = None,
) -> int:
    """Determine role priority taking company size into account.

    For small startups (<= 50 employees):
      Priority 1: Founders, Co-Founders, CEOs
      Priority 2: CTOs
      Priority 3: VP / Head of Engineering
      Priority 4: Engineering Managers / Leads

    For larger companies (> 50 employees):
      Priority 1: CTOs (direct technical sponsor)
      Priority 2: VP / Head of Engineering (functional engineering leader)
      Priority 3: Engineering Managers / Technical Leads (direct hiring manager)
      Priority 4: Founders / CEOs (often detached from contractor / junior hiring)
    """
    _, base_priority, _ = normalize_technical_title(title)

    # Determine if company is large
    is_large = False
    if isinstance(company_size, int):
        is_large = company_size > 50
    elif isinstance(company_size, str) and company_size:
        # Check patterns like "51-200", "201-500", "500+", "1000"
        m = re.search(r"(\d+)", company_size)
        if m:
            val = int(m.group(1))
            if val >= 50 or any(k in company_size for k in ("51-", "201-", "500+", "1000")):
                is_large = True

    if not is_large:
        return base_priority

    # Re-map for larger companies
    large_mapping = {
        2: 1,  # CTO -> P1
        3: 2,  # VP Eng -> P2
        4: 3,  # Eng Mgr -> P3
        1: 4,  # Founder/CEO -> P4
    }
    return large_mapping.get(base_priority, 4)


def is_excluded_person(
    title: str,
    context: str = "",
    domain: str = "",
    site_name: str = "",
    config: DecisionMakerConfig | None = None,
) -> bool:
    """Return True if person should be excluded (former employee, advisor, client)."""
    cfg = config or DecisionMakerConfig()
    combined = f"{title} {context}"

    if cfg.exclude_former and _FORMER_STAFF.search(combined):
        return True

    if cfg.exclude_advisors and _ADVISOR_OR_INVESTOR.search(combined):
        return True

    if _SUBORDINATE_ROLES.search(title):
        return True

    # Quoted client / external customer testimonial check
    if domain and title_names_other_org(title, domain, site_name):
        return True

    return False


class DecisionMakerExtractor:
    """Extracts, ranks, and validates technical decision-makers from company web pages."""

    def __init__(self, config: DecisionMakerConfig | None = None):
        self.config = config or DecisionMakerConfig()

    def extract_from_card(
        self,
        html_block: str,
        page_url: str,
        domain: str,
        site_name: str = "",
        company_size: str = "",
    ) -> DecisionMaker | None:
        """Extract a single DecisionMaker from an HTML card or section."""
        # Find LinkedIn, Twitter/X, and GitHub profile links if present
        linkedin_url = ""
        m_li = _LINKEDIN_PROFILE_RE.search(html_block)
        if m_li:
            linkedin_url = f"https://www.linkedin.com/in/{m_li.group(1)}"

        twitter_url = ""
        m_tw = _TWITTER_PROFILE_RE.search(html_block)
        if m_tw:
            twitter_url = f"https://x.com/{m_tw.group(1)}"

        github_url = ""
        m_gh = _GITHUB_PROFILE_RE.search(html_block)
        if m_gh:
            github_url = f"https://github.com/{m_gh.group(1)}"

        # Strip scripts, styles, and tags
        clean_text = re.sub(r"(?s)<script.*?</script>|<style.*?</style>", " ", html_block)
        text_lines = [re.sub(r"\s+", " ", l).strip() for l in re.sub(r"<[^>]+>", "\n", clean_text).split("\n")]
        text_lines = [l for l in text_lines if l]

        if not text_lines:
            return None

        # Look for name and title pair
        for i, line in enumerate(text_lines[:4]):
            split = split_person_name(line)
            if split:
                first, last = split
                # Look in adjacent lines for title
                candidate_titles = text_lines[i + 1 : i + 3]
                title = candidate_titles[0] if candidate_titles else ""

                if not title or len(title) > 90:
                    continue

                if is_excluded_person(
                    title,
                    context=" ".join(text_lines),
                    domain=domain,
                    site_name=site_name,
                    config=self.config,
                ):
                    return None

                clean_title, _, seniority = normalize_technical_title(title)
                priority = classify_role_priority(
                    clean_title, company_size=company_size, config=self.config
                )

                snippet = " — ".join(text_lines[:4])[:280]

                return DecisionMaker(
                    first_name=first,
                    last_name=last,
                    title=clean_title,
                    role_priority=priority,
                    company_name=site_name,
                    company_domain=domain,
                    linkedin_url=linkedin_url,
                    twitter_url=twitter_url,
                    github_url=github_url,
                    evidence_snippet=snippet,
                    source_url=page_url,
                    confidence=0.90 if linkedin_url else (0.85 if priority <= 2 else 0.75),
                    seniority=seniority,
                )

        return None

    def extract_from_page(
        self,
        url: str,
        html: str,
        domain: str,
        site_name: str = "",
        company_size: str = "",
    ) -> list[DecisionMaker]:
        """Extract all decision makers from a single page's HTML."""
        from outreach.collectors.profile import ProfileCollector

        results: list[DecisionMaker] = []
        seen_names: set[tuple[str, str]] = set()

        # 1. ProfileCollector structured detection
        collector = ProfileCollector(state=None)
        people_dicts = collector.detect_people(html, domain=domain, site_name=site_name)

        # Look for page-wide social profile URLs to correlate with names
        linkedin_map: dict[str, str] = {}
        for m in _LINKEDIN_PROFILE_RE.finditer(html):
            handle = m.group(1).lower()
            linkedin_map[handle] = f"https://www.linkedin.com/in/{m.group(1)}"

        twitter_map: dict[str, str] = {}
        for m in _TWITTER_PROFILE_RE.finditer(html):
            handle = m.group(1).lower()
            twitter_map[handle] = f"https://x.com/{m.group(1)}"

        github_map: dict[str, str] = {}
        for m in _GITHUB_PROFILE_RE.finditer(html):
            handle = m.group(1).lower()
            github_map[handle] = f"https://github.com/{m.group(1)}"

        for p in people_dicts:
            first = p.get("first_name", "").strip()
            last = p.get("last_name", "").strip()
            raw_title = p.get("title", "").strip()

            if not first or not last or not raw_title:
                continue

            key = (first.lower(), last.lower())
            if key in seen_names:
                continue

            if is_excluded_person(
                raw_title, context="", domain=domain, site_name=site_name, config=self.config
            ):
                continue

            clean_title, _, seniority = normalize_technical_title(raw_title)
            priority = classify_role_priority(
                clean_title, company_size=company_size, config=self.config
            )

            # Check if person's name matches any discovered social handle
            assigned_linkedin = ""
            for handle, full_li in linkedin_map.items():
                if (first.lower() in handle and last.lower() in handle) or (last.lower() in handle and len(last) >= 4):
                    assigned_linkedin = full_li
                    break

            assigned_twitter = ""
            for handle, full_tw in twitter_map.items():
                if (first.lower() in handle and last.lower() in handle) or (last.lower() in handle and len(last) >= 4):
                    assigned_twitter = full_tw
                    break

            assigned_github = ""
            for handle, full_gh in github_map.items():
                if (first.lower() in handle and last.lower() in handle) or (last.lower() in handle and len(last) >= 4):
                    assigned_github = full_gh
                    break

            evidence = f"{first} {last} | {clean_title}"
            dm = DecisionMaker(
                first_name=first,
                last_name=last,
                title=clean_title,
                role_priority=priority,
                company_name=site_name,
                company_domain=domain,
                linkedin_url=assigned_linkedin,
                twitter_url=assigned_twitter,
                github_url=assigned_github,
                evidence_snippet=evidence,
                source_url=url,
                confidence=0.88 if assigned_linkedin else (0.80 if priority <= 2 else 0.70),
                seniority=seniority,
            )
            seen_names.add(key)
            results.append(dm)

        # 2. Targeted regex card parsing for team containers with badges
        card_pattern = re.compile(
            r'(?is)<(?:div|li|section|article)[^>]*class=["\'][^"\']*(?:team|member|person|card|bio|leader)[^"\']*["\'][^>]*>(.*?)</(?:div|li|section|article)>'
        )
        for m in card_pattern.finditer(html):
            card_html = m.group(0)
            dm = self.extract_from_card(
                card_html,
                page_url=url,
                domain=domain,
                site_name=site_name,
                company_size=company_size,
            )
            if dm:
                key = (dm.first_name.lower(), dm.last_name.lower())
                existing = next((r for r in results if (r.first_name.lower(), r.last_name.lower()) == key), None)
                if not existing:
                    seen_names.add(key)
                    results.append(dm)
                else:
                    if not existing.linkedin_url and dm.linkedin_url:
                        existing.linkedin_url = dm.linkedin_url
                    if not existing.twitter_url and dm.twitter_url:
                        existing.twitter_url = dm.twitter_url
                    if not existing.github_url and dm.github_url:
                        existing.github_url = dm.github_url

        return results

    def extract_from_site_pages(
        self,
        pages: list[tuple[str, str]],
        domain: str,
        site_name: str = "",
        company_size: str = "",
    ) -> list[DecisionMaker]:
        """Aggregate, score, and rank decision-makers across all company pages."""
        merged: dict[tuple[str, str], DecisionMaker] = {}

        for url, html in pages:
            page_dms = self.extract_from_page(
                url, html, domain=domain, site_name=site_name, company_size=company_size
            )
            for dm in page_dms:
                key = (dm.first_name.lower(), dm.last_name.lower())
                if key not in merged:
                    merged[key] = dm
                else:
                    current = merged[key]
                    # Retain better priority and enrich LinkedIn / evidence
                    if dm.role_priority < current.role_priority:
                        current.role_priority = dm.role_priority
                        current.title = dm.title
                        current.seniority = dm.seniority
                    if not current.linkedin_url and dm.linkedin_url:
                        current.linkedin_url = dm.linkedin_url
                    if not current.twitter_url and dm.twitter_url:
                        current.twitter_url = dm.twitter_url
                    if not current.github_url and dm.github_url:
                        current.github_url = dm.github_url
                    if len(dm.evidence_snippet) > len(current.evidence_snippet):
                        current.evidence_snippet = dm.evidence_snippet

        decision_makers = list(merged.values())

        # Sort by role priority (1 first, then 2, 3, 4), then by confidence descending
        decision_makers.sort(key=lambda d: (d.role_priority, -d.confidence))

        return decision_makers[: self.config.max_people_per_company]

    @staticmethod
    def build_search_queries(domain: str) -> list[str]:
        """Generate targeted search-engine dorks to discover technical decision-makers."""
        clean_domain = normalize_domain(domain)
        return [
            f'{clean_domain} founder',
            f'{clean_domain} CTO',
            f'{clean_domain} "Chief Technology Officer"',
            f'{clean_domain} "VP of Engineering"',
            f'{clean_domain} "Head of Engineering"',
            f'{clean_domain} "Engineering Manager"',
            f'{clean_domain} "Head of AI"',
        ]


async def enrich_social_profiles_via_search(
    people: list[DecisionMaker],
    company_name: str,
    serper_api_key: str = "",
    max_lookups: int = 4,
) -> None:
    """Enrich missing LinkedIn, X/Twitter, or GitHub profiles using Serper search."""
    if not serper_api_key or not company_name or not people:
        return

    from outreach.public_http import public_http_client

    headers = {"X-API-KEY": serper_api_key, "Content-Type": "application/json"}
    lookups_done = 0

    try:
        async with public_http_client(timeout=8.0) as client:
            for p in people[:3]:  # Top priority decision makers
                if lookups_done >= max_lookups:
                    break

                # 1. Search LinkedIn if missing
                if not p.linkedin_url:
                    try:
                        q_li = f'site:linkedin.com/in "{p.full_name}" "{company_name}"'
                        r = await client.post(
                            "https://google.serper.dev/search",
                            headers=headers,
                            json={"q": q_li, "num": 1},
                        )
                        if r.status_code == 200:
                            for item in r.json().get("organic") or []:
                                link = item.get("link", "")
                                if "linkedin.com/in/" in link:
                                    p.linkedin_url = link
                                    break
                        lookups_done += 1
                    except Exception as err:
                        logger.debug("Serper LinkedIn search failed for %s: %s", p.full_name, err)

                # 2. Search X / Twitter if missing
                if not p.twitter_url and lookups_done < max_lookups:
                    try:
                        q_x = f'(site:x.com OR site:twitter.com) "{p.full_name}" "{company_name}"'
                        r = await client.post(
                            "https://google.serper.dev/search",
                            headers=headers,
                            json={"q": q_x, "num": 1},
                        )
                        if r.status_code == 200:
                            for item in r.json().get("organic") or []:
                                link = item.get("link", "")
                                m = _TWITTER_PROFILE_RE.search(link)
                                if m:
                                    p.twitter_url = f"https://x.com/{m.group(1)}"
                                    break
                        lookups_done += 1
                    except Exception as err:
                        logger.debug("Serper X search failed for %s: %s", p.full_name, err)
    except Exception as exc:
        logger.debug("Social search enrichment error: %s", exc)


async def discover_executives_via_linkedin_search(
    company_name: str,
    domain: str,
    serper_api_key: str,
    limit: int = 3,
) -> list[DecisionMaker]:
    """Discover real human executives and decision-makers using Google Serper LinkedIn search."""
    if not serper_api_key or not company_name:
        return []

    from outreach.collectors.people import split_person_name
    from outreach.public_http import public_http_client

    headers = {"X-API-KEY": serper_api_key, "Content-Type": "application/json"}
    q = f'site:linkedin.com/in ("Founder" OR "Co-Founder" OR "CEO" OR "CTO" OR "VP" OR "Head of" OR "Managing Director") "{company_name}"'

    results: list[DecisionMaker] = []
    seen_names: set[tuple[str, str]] = set()

    try:
        async with public_http_client(timeout=10.0) as client:
            resp = await client.post("https://google.serper.dev/search", headers=headers, json={"q": q, "num": limit + 4})
            if resp.status_code != 200:
                return []

            data = resp.json()
            for item in data.get("organic") or []:
                link = item.get("link", "")
                if "linkedin.com/in/" not in link:
                    continue

                title = item.get("title", "")
                subtitle = item.get("subtitle", "")
                snippet = item.get("snippet", "")

                # Clean name: remove suffixes, nicknames in parens
                raw_name = title.split(" - ")[0].split(" | ")[0].split(" – ")[0].strip()
                raw_name = re.sub(r"\(.*?\)", "", raw_name)
                raw_name = re.sub(r"[^\w\s\-\x27]", "", raw_name).strip()
                name_parts = split_person_name(raw_name)
                if not name_parts:
                    continue
                first, last = name_parts
                name_key = (first.lower(), last.lower())
                if name_key in seen_names:
                    continue
                seen_names.add(name_key)

                # Extract title
                role = ""
                if len(title.split(" - ")) > 1:
                    role = title.split(" - ")[1].split(" | ")[0].split("@")[0].strip()
                elif subtitle and "·" in subtitle:
                    parts = subtitle.split("·")
                    role = parts[1].strip() if len(parts) > 1 else parts[0].strip()

                clean_title, _, seniority = normalize_technical_title(role or "Executive")
                priority = classify_role_priority(clean_title)

                loc = ""
                if subtitle and "·" in subtitle:
                    loc = subtitle.split("·")[0].strip()

                evidence = f"LinkedIn: {clean_title} at {company_name}"
                if loc:
                    evidence += f" ({loc})"
                if snippet:
                    evidence += f" — {snippet[:150]}"

                dm = DecisionMaker(
                    first_name=first,
                    last_name=last,
                    title=clean_title,
                    role_priority=priority,
                    company_name=company_name,
                    company_domain=domain,
                    linkedin_url=link,
                    source_url=link,
                    evidence_snippet=evidence[:280],
                    confidence=0.92,
                    seniority=seniority,
                )
                results.append(dm)
                if len(results) >= limit:
                    break
    except Exception as exc:
        logger.debug("LinkedIn executive discovery error for %s: %s", company_name, exc)

    return results



