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
from bs4 import BeautifulSoup

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
    "-site:startupblink.com -site:dealroom.co -site:pitchbook.com "
    "-site:cbinsights.com -site:owler.com -site:betalist.com "
    "-site:ibm.com -site:stripe.com -site:adyen.com -site:mastercard.com "
    "-site:visa.com -site:paypal.com -site:microsoft.com -site:google.com "
    "-site:amazon.com -site:apple.com -site:oracle.com -site:salesforce.com "
    "-site:jpmorgan.com -site:goldmansachs.com -site:bankofamerica.com "
    '-"apply now" -"job description" -"job opening" -"apply for this role" '
    '-"Fortune 500" -multinational -"case study" -"case studies" -rankings -ranking -directory -listicle'
)


@dataclass
class DiscoveryCriteria:
    """Filter criteria used to generate targeted discovery queries."""

    target_type: str = "all"      # "startup" (for jobs), "agency" (for freelance), "all"
    source_platform: str = "all"  # "all", "yc", "wellfound", "hackernews", "ashby", "producthunt", "eustartups", "peerlist"
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
    source_platform: str = "Global Web"

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
            "source_platform": self.source_platform,
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

        # 2. Specific Platform Routing (Startups & Agency Directories)
        plat = (criteria.source_platform or "").lower().strip()
        if plat in ("yc", "ycombinator"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                    tech_part = f'"{techs[0]}"' if techs and techs[0] else ""
                    q1 = f'site:ycombinator.com/companies ("{ind}") ("developer" OR "engineer" OR "software") {tech_part} {loc_part}'
                    q2 = f'site:workatastartup.com/companies ("{ind}") ("software engineer" OR "developer") {loc_part}'
                    queries.extend([cls._clean_query(q1), cls._clean_query(q2)])
            return queries[:5]

        if plat in ("wellfound", "angellist"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                    q1 = f'site:wellfound.com/company ("{ind}") ("seed" OR "series a") ("hiring" OR "developer" OR "engineer") {loc_part}'
                    q2 = f'site:wellfound.com/company ("{ind} startup") ("developer" OR "jobs" OR "careers") {loc_part}'
                    queries.extend([cls._clean_query(q1), cls._clean_query(q2)])
            return queries[:5]

        if plat in ("hn", "hackernews"):
            tech_part = f'("{techs[0]}")' if techs and techs[0] else ""
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                    q = f'site:news.ycombinator.com "Ask HN: Who is hiring?" ("{ind}" OR "startup") {tech_part} {loc_part} ("developer" OR "engineer")'
                    queries.append(cls._clean_query(q))
            return queries[:5]

        if plat in ("ashby", "lever", "ats"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                    q1 = f'site:jobs.ashbyhq.com ("software engineer" OR "developer" OR "founding engineer") ("{ind}") {loc_part}'
                    q2 = f'site:jobs.lever.co ("software engineer" OR "developer") ("{ind}") {loc_part}'
                    queries.extend([cls._clean_query(q1), cls._clean_query(q2)])
            return queries[:5]

        if plat in ("producthunt", "ph"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ""
                    q1 = f'site:producthunt.com/products ("{ind}") ("pricing" OR "platform" OR "developer") {loc_part}'
                    q2 = f'site:producthunt.com/posts ("{ind}") ("launch" OR "product") {loc_part}'
                    queries.extend([cls._clean_query(q1), cls._clean_query(q2)])
            return queries[:5]

        if plat in ("eustartups", "europe"):
            for ind in industries:
                q1 = f'site:eu-startups.com ("{ind}") ("seed" OR "series a" OR "funding" OR "startup")'
                queries.append(cls._clean_query(q1))
            return queries[:5]

        if plat in ("peerlist",):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ""
                    q = f'site:peerlist.io ("{ind}") ("project" OR "startup" OR "hiring") {loc_part}'
                    queries.append(cls._clean_query(q))
            return queries[:5]

        # Specific Agency Platforms (Clutch.co, GoodFirms, DesignRush, The Manifest, HN Freelancer, Agency Spotter, Upwork)
        if plat in ("clutch", "clutch.co"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                    tech_part = f'"{techs[0]}"' if techs and techs[0] else ""
                    q1 = f'site:clutch.co/profile ("{ind}" OR "software development" OR "custom software") {tech_part} {loc_part}'
                    q2 = f'site:clutch.co/developers ("{ind}" OR "web development") {tech_part} {loc_part}'
                    queries.extend([cls._clean_query(q1), cls._clean_query(q2)])
            return queries[:5]

        if plat in ("goodfirms", "goodfirms.co"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ""
                    q = f'site:goodfirms.co/company ("{ind}" OR "software development" OR "web developers") {loc_part}'
                    queries.append(cls._clean_query(q))
            return queries[:5]

        if plat in ("designrush", "designrush.com"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ""
                    q = f'site:designrush.com/agency ("software development" OR "web development" OR "{ind}") {loc_part}'
                    queries.append(cls._clean_query(q))
            return queries[:5]

        if plat in ("manifest", "themanifest", "themanifest.com"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ""
                    q1 = f'site:themanifest.com/company ("software development" OR "web development" OR "{ind}") {loc_part}'
                    q2 = f'site:themanifest.com ("software development" OR "web development" OR "{ind}") ("agency" OR "company") {loc_part}'
                    queries.extend([cls._clean_query(q1), cls._clean_query(q2)])
            return queries[:5]

        if plat in ("hn_freelance", "seeking_freelancer", "freelance_hn"):
            tech_part = f'("{techs[0]}")' if techs and techs[0] else ""
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                    q = f'site:news.ycombinator.com "Ask HN: Seeking Freelancer" ("{ind}" OR "software" OR "developer" OR "engineer") {tech_part} {loc_part}'
                    queries.append(cls._clean_query(q))
            return queries[:5]

        if plat in ("agencyspotter", "agency_spotter"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ""
                    q = f'site:agencyspotter.com ("{ind}" OR "software development" OR "web development") {loc_part}'
                    queries.append(cls._clean_query(q))
            return queries[:5]

        if plat in ("upwork_agencies", "upwork"):
            for ind in industries:
                for loc in locations:
                    loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ""
                    q = f'site:upwork.com/agencies ("software development" OR "web development" OR "{ind}") {loc_part}'
                    queries.append(cls._clean_query(q))
            return queries[:5]

        # 3. Target Type Routing
        is_agency_mode = criteria.target_type == "agency" or criteria.business_model == "agency"
        is_startup_mode = criteria.target_type == "startup" or criteria.business_model == "product"
        is_both = (criteria.target_type == "all" and criteria.business_model not in ("agency", "product"))

        for ind in industries:
            for loc in locations:
                loc_part = f'"{loc}"' if loc and loc.lower() != "remote" else ("remote" if loc.lower() == "remote" else "")
                tech_part = f'"{techs[0]}"' if techs and techs[0] else ""

                size_part = ""
                if criteria.company_size_tier in ("1-10", "11-50"):
                    size_part = '("seed funded" OR "seed round" OR "series A" OR "early-stage" OR "founding team")'
                elif criteria.company_size_tier == "51-200":
                    size_part = '("series A" OR "series B" OR "growth stage")'
                elif criteria.company_size_tier:
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
                        q_tech = f'("{ind}") ({tech_part}) ("product" OR "platform" OR "pricing") {size_part} {loc_part} {DEFAULT_EXCLUSIONS}'
                        queries.append(cls._clean_query(q_tech))
                    elif rev_part:
                        q_fund = f'("{ind} startup" OR "{ind} company") {rev_part} {size_part} {loc_part} {DEFAULT_EXCLUSIONS}'
                        queries.append(cls._clean_query(q_fund))
                    else:
                        q_plat = f'("{ind} startup" OR "{ind} SaaS" OR "{ind} platform") ("pricing" OR "customers" OR "solutions") {size_part} {loc_part} {DEFAULT_EXCLUSIONS}'
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


# Additional agency, software directory, job board, and marketplace junk patterns
ADDITIONAL_JUNK_PATTERNS = tuple(re.compile(p, re.I) for p in (
    r"(^|\.)(clutch|goodfirms|designrush|sortlist|topdevelopers|themanifest)\.",
    r"(^|\.)(g2|capterra|softwareadvice|trustradius|sourceforge)\.",
    r"(^|\.)(jobright|levels|remoteok|weworkremotely|simplyhired|dice|monster|careerbuilder)\.",
    r"(^|\.)(boards\.greenhouse|jobs\.lever|apply\.workable|jobs\.ashbyhq)\.",
    r"(^|\.)(fiverr|freelancer|toptal|guru|upwork)\.",
    r"(^|\.)(ibm|stripe|adyen|mastercard|visa|paypal|microsoft|google|amazon|apple|oracle|salesforce|cisco|intel|meta|facebook|netflix|accenture|deloitte|mckinsey|jpmorgan|goldman|wellsfargo|chase|citigroup|bankofamerica)\.",
    r"(^|\.)(angelinvestor|angelinvestorsnetwork|venturecapital|techstars|ycombinator)\.",
    r"(^|\.)(startupblink|startupgenome|dealroom|pitchbook|cbinsights|owler|betalist|seedtable|failory|explodingtopics|topstartups|builtin[a-z]*|f6s|4dayweek|getleadwave|mikesonders)\.",
    r"(^|\.)(varyence|revenuebase|remotesource|wfh|jobgether)\.",
    r"(^|\.)(jobot|fractionaljobs|jackandjill|jobmesh|mediabistro|matcha|elixirforum|f5hiringsolutions|athenaleaders|revenuefast)\.",
    r"(^|\.)(jobs\.|careers\.|talent\.|recruiting\.|staffing\.|forum\.|community\.)",
    r"(^|\.)(sequoia|sequoiacap|a16z|accel|benchmark|bessemer|greylock|kleinerperkins)\.",
    r"(^|\.)(nagarro|infosys|tcs|wipro|cognizant|hcltech|capgemini)\.",
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


def is_investor_or_vc(name: str, title: str = "", snippet: str = "") -> bool:
    """Return True if the entity is an investment fund, venture capital, or accelerator."""
    combined = f"{name} {title} {snippet}".lower()

    # Check name for VC/fund indicators
    if re.search(
        r"\b(ventures|venture capital|capital partners|seed fund|growth fund|angel network|investors network|investor network|collective)\b",
        name.lower(),
    ):
        return True

    # Check for direct VC self-identification in snippet
    if re.search(
        r"\b(we invest in|investing in pre-seed|investing in seed|venture capital firm|seed-stage fund|early stage fund|early-stage fund|vc fund|backing founders|accelerator program|venture studio)\b",
        combined,
    ):
        if not re.search(r"\b(our platform|our software|we build|all-in-one platform|developer platform)\b", snippet.lower()):
            return True

    return False


def clean_company_name(name: str) -> str:
    """Strip hiring prefixes, funding headlines, and platform artifact suffixes from company names."""
    if not name:
        return ""

    # Drop Cloudflare / Captcha artifacts
    if re.search(r"\b(checking your browser|just a moment|attention required|security check|access denied|cloudflare)\b", name, re.I):
        return ""

    # Extract startup name from news headlines like "HR & Fintech Platform RemotePass Secures $5.5M"
    m_fund = re.search(r"(?:Platform|Startup|Company|App)\s+([A-Za-z0-9\.\-]+)\s+(?:Secures|Raises|Closes|Snaps|Gains)", name, re.I)
    if m_fund:
        name = m_fund.group(1).strip()

    cleaned = re.sub(r"^(?:Jobs at|Careers at|Working at|Join|About|About Our|Welcome to)\s+", "", name, flags=re.I).strip()
    cleaned = re.sub(r"\s*\((?:YC\s*)?[A-Za-z0-9\s]+\)$", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"\s+(?:Careers|Jobs|Hiring|Funding Rounds?|Company Overview)$", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"\s+(?:Secures|Raises|Closes|Announces)\s+.*$", "", cleaned, flags=re.I).strip()
    return cleaned


def parse_platform_candidate(link: str, title: str, snippet: str) -> dict | None:
    """Extract candidate startup information from platform-specific URLs."""
    # 1. Y Combinator & Work at a Startup
    m_yc = re.search(r"ycombinator\.com/companies/([a-zA-Z0-9_\-]+)", link)
    if not m_yc:
        m_yc = re.search(r"workatastartup\.com/companies/([a-zA-Z0-9_\-]+)", link)
    if m_yc:
        slug = m_yc.group(1).lower()
        if slug in ("jobs", "companies", "apply", "industry", "all", "w24", "s24", "w25"):
            return None
        # Drop purely numeric slugs or single character artifacts (e.g. 12249)
        if slug.isdigit() or len(slug) < 2:
            return None

        slug_name = slug.replace("-", " ").title()
        m_name = re.search(r"^(?:Jobs\s+at|Careers\s+at)?\s*([A-Za-z0-9\.\s]+?)(?:\s*\([A-Za-z0-9\s]+\))?\s*(?:\||:|-|—)", title, re.I)
        name = clean_company_name(m_name.group(1).strip() if m_name else slug_name)
        if not name or len(name) < 2 or name.lower() in ("a startup", "work at a startup", "y combinator", "startup"):
            name = slug_name

        if is_investor_or_vc(name, title, snippet):
            return None
        return {
            "source_platform": "Y Combinator",
            "name": name,
            "domain": f"{slug}.com",
            "website": f"https://www.ycombinator.com/companies/{slug}",
        }

    # 2. Ashby ATS
    m_ash = re.search(r"jobs\.ashbyhq\.com/([a-zA-Z0-9_\-]+)", link)
    if m_ash:
        slug = m_ash.group(1).lower()
        if slug.isdigit() or len(slug) < 2:
            return None
        m_name = re.search(r"(?:at|@)\s+([A-Za-z0-9\.\s]+?)(?:\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
        name = clean_company_name(m_name.group(1).strip() if m_name else slug.capitalize())
        if is_investor_or_vc(name, title, snippet):
            return None
        return {
            "source_platform": "Ashby ATS",
            "name": name,
            "domain": f"{slug}.com",
            "website": f"https://jobs.ashbyhq.com/{slug}",
        }

    # 3. Lever ATS
    m_lev = re.search(r"jobs\.lever\.co/([a-zA-Z0-9_\-]+)", link)
    if m_lev:
        slug = m_lev.group(1).lower()
        if slug.isdigit() or len(slug) < 2:
            return None
        m_name = re.search(r"(?:at|@)\s+([A-Za-z0-9\.\s]+?)(?:\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
        name = clean_company_name(m_name.group(1).strip() if m_name else slug.capitalize())
        if is_investor_or_vc(name, title, snippet):
            return None
        return {
            "source_platform": "Lever ATS",
            "name": name,
            "domain": f"{slug}.com",
            "website": f"https://jobs.lever.co/{slug}",
        }

    # 4. Wellfound (AngelList)
    m_wf = re.search(r"wellfound\.com/company/([a-zA-Z0-9_\-]+)", link)
    if m_wf:
        slug = m_wf.group(1).lower()
        clean_slug = re.sub(r"-\d+$", "", slug)
        if clean_slug.isdigit() or len(clean_slug) < 2:
            return None
        if re.search(r"\b(leading-.*-startup|stealth|confidential|top-tier-.*)\b", slug):
            return None
        m_name = re.search(r"^([A-Za-z0-9\.\s]+?)(?:\s+Careers|\s+Funding|\s*:|\s*\|)", title, re.I)
        name = clean_company_name(m_name.group(1).strip() if m_name else clean_slug.capitalize())
        if is_investor_or_vc(name, title, snippet):
            return None
        return {
            "source_platform": "Wellfound",
            "name": name,
            "domain": f"{clean_slug}.com",
            "website": f"https://wellfound.com/company/{slug}",
        }

    # 5. Product Hunt
    m_ph = re.search(r"producthunt\.com/products/([a-zA-Z0-9_\-]+)", link)
    if not m_ph:
        m_ph = re.search(r"producthunt\.com/posts/([a-zA-Z0-9_\-]+)", link)
    if m_ph:
        slug = m_ph.group(1).lower()
        m_name = re.search(r"^([A-Za-z0-9\.\s]+?)(?:\s*:|\s*\|)", title)
        name = clean_company_name(m_name.group(1).strip() if m_name else slug.capitalize())
        if is_investor_or_vc(name, title, snippet):
            return None
        return {
            "source_platform": "Product Hunt",
            "name": name,
            "domain": f"{slug}.com",
            "website": f"https://www.producthunt.com/products/{slug}",
        }

    # 6. Peerlist
    m_peer = re.search(r"peerlist\.io/([a-zA-Z0-9_\-]+)", link)
    if m_peer:
        slug = m_peer.group(1).lower()
        if slug not in ("jobs", "projects", "company"):
            name = clean_company_name(slug.capitalize())
            if is_investor_or_vc(name, title, snippet):
                return None
            return {
                "source_platform": "Peerlist",
                "name": name,
                "domain": f"{slug}.com",
                "website": link,
            }

    # 7. Hacker News (Ask HN: Who is hiring?)
    if "news.ycombinator.com" in link:
        m_url = re.search(r"https?://(?:www\.)?([a-zA-Z0-9\.\-]+\.[a-z]{2,})", snippet)
        if m_url:
            raw_d = m_url.group(1).lower()
            name = clean_company_name(raw_d.split(".")[0].capitalize())
            if is_investor_or_vc(name, title, snippet):
                return None
            return {
                "source_platform": "Hacker News",
                "name": name,
                "domain": raw_d,
                "website": f"https://{raw_d}",
            }

    # 8. EU-Startups
    if "eu-startups.com" in link:
        m_eu = re.search(r"(?:startup|fintech|ai)\s+([A-Za-z0-9]+)\s+(?:raises|snaps|closes|secures)", title, re.I)
        if m_eu:
            s_name = clean_company_name(m_eu.group(1).strip())
            if is_investor_or_vc(s_name, title, snippet):
                return None
            return {
                "source_platform": "EU-Startups",
                "name": s_name,
                "domain": f"{s_name.lower()}.com",
                "website": link,
            }

    # 9. Clutch.co Agencies
    m_clutch = re.search(r"clutch\.co/profile/([a-zA-Z0-9_\-]+)", link)
    if not m_clutch:
        m_clutch = re.search(r"clutch\.co/(?:web-developers|developers|agencies)/([a-zA-Z0-9_\-]+)", link)
    if m_clutch:
        raw_slug = m_clutch.group(1).lower()
        # Drop directory, category rankings, frameworks, and generic listing artifacts
        if re.search(r"\b(resources|press|about|leaders|reviews|pricing|login|web-developers|developers|agencies|rankings|framework|reactjs|angular|vuejs|python|django|laravel)\b", raw_slug):
            return None
        # Clean trailing duplicate numbers from Clutch URLs (e.g. naxtech-1 -> naxtech, remote-office-0 -> remote-office)
        clean_slug = re.sub(r"-\d+$", "", raw_slug)
        if clean_slug.isdigit() or len(clean_slug) < 2:
            return None

        slug_name = clean_slug.replace("-", " ").title()
        m_name = re.search(r"^(?:Top\s+.*?-\s+)?([A-Za-z0-9\.\s]+?)(?:\s+Reviews|\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
        name = clean_company_name(m_name.group(1).strip() if m_name else slug_name)
        
        # Discard ranking and directory titles (e.g. "Oct 2026 Rankings")
        if not name or len(name) < 2 or re.search(r"\b(clutch|reviews|rankings|top developers|best developers|directory)\b", name, re.I):
            name = slug_name
        if re.search(r"\b(rankings|directory)\b", name, re.I):
            return None

        # Preferred domain: test without hyphens if applicable, or fallback to cleaned slug
        preferred_domain = f"{clean_slug}.com"
        return {
            "source_platform": "Clutch.co",
            "name": name,
            "domain": preferred_domain,
            "website": f"https://clutch.co/profile/{raw_slug}",
        }

    # 10. GoodFirms Agencies
    m_gf = re.search(r"goodfirms\.co/company/([a-zA-Z0-9_\-]+)", link)
    if m_gf:
        slug = m_gf.group(1).lower()
        if slug not in ("companies", "directory", "about", "write-a-review") and not slug.isdigit() and len(slug) >= 2:
            slug_name = slug.replace("-", " ").title()
            m_name = re.search(r"^([A-Za-z0-9\.\s]+?)(?:\s+Reviews|\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
            name = clean_company_name(m_name.group(1).strip() if m_name else slug_name)
            if not name or len(name) < 2:
                name = slug_name
            return {
                "source_platform": "GoodFirms",
                "name": name,
                "domain": f"{slug}.com",
                "website": f"https://www.goodfirms.co/company/{slug}",
            }

    # 11. DesignRush Agencies
    m_dr = re.search(r"designrush\.com/agency/(?:profile/)?([a-zA-Z0-9_\-]+)", link)
    if m_dr:
        slug = m_dr.group(1).lower()
        if slug not in ("profile", "search", "best-designs", "awards", "trends") and not slug.isdigit() and len(slug) >= 2:
            slug_name = slug.replace("-", " ").title()
            m_name = re.search(r"^([A-Za-z0-9\.\s]+?)(?:\s+Reviews|\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
            name = clean_company_name(m_name.group(1).strip() if m_name else slug_name)
            if not name or len(name) < 2:
                name = slug_name
            return {
                "source_platform": "DesignRush",
                "name": name,
                "domain": f"{slug}.com",
                "website": link,
            }

    # 12. The Manifest
    m_tm = re.search(r"themanifest\.com/company/([a-zA-Z0-9_\-]+)", link)
    if m_tm:
        slug = m_tm.group(1).lower()
        if slug not in ("companies", "directory", "about") and not slug.isdigit() and len(slug) >= 2:
            slug_name = slug.replace("-", " ").title()
            m_name = re.search(r"^([A-Za-z0-9\.\s]+?)(?:\s+Reviews|\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
            name = clean_company_name(m_name.group(1).strip() if m_name else slug_name)
            if not name or len(name) < 2:
                name = slug_name
            return {
                "source_platform": "The Manifest",
                "name": name,
                "domain": f"{slug}.com",
                "website": link,
            }

    # 13. Agency Spotter
    m_as = re.search(r"agencyspotter\.com/([a-zA-Z0-9_\-]+)", link)
    if m_as:
        slug = m_as.group(1).lower()
        if slug not in ("search", "top", "agency", "blog", "about", "portfolio") and not slug.isdigit() and len(slug) >= 2:
            slug_name = slug.replace("-", " ").title()
            m_name = re.search(r"^([A-Za-z0-9\.\s]+?)(?:\s+Reviews|\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
            name = clean_company_name(m_name.group(1).strip() if m_name else slug_name)
            return {
                "source_platform": "Agency Spotter",
                "name": name,
                "domain": f"{slug}.com",
                "website": link,
            }

    # 14. Upwork Agencies
    m_up = re.search(r"upwork\.com/agencies/([a-zA-Z0-9_\-]+)", link)
    if m_up:
        m_name = re.search(r"^([A-Za-z0-9\.\s]+?)(?:\s*—|\s*-\s*|\s*\||\s*$)", title, re.I)
        name = clean_company_name(m_name.group(1).strip() if m_name else "Upwork Agency")
        slug = re.sub(r"[^a-zA-Z0-9]", "", name.lower())
        if len(slug) >= 2:
            return {
                "source_platform": "Upwork Agencies",
                "name": name,
                "domain": f"{slug}.com",
                "website": link,
            }

    # 15. Hacker News: Seeking Freelancer
    if "news.ycombinator.com" in link and ("seeking freelancer" in title.lower() or "seeking freelancer" in snippet.lower()):
        m_url = re.search(r"https?://(?:www\.)?([a-zA-Z0-9\.\-]+\.[a-z]{2,})", snippet)
        if m_url:
            raw_d = m_url.group(1).lower()
            name = clean_company_name(raw_d.split(".")[0].capitalize())
            return {
                "source_platform": "HN: Seeking Freelancer",
                "name": name,
                "domain": raw_d,
                "website": f"https://{raw_d}",
            }

    return None


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

    async def _fetch_yc_structured_companies(
        self,
        client: httpx.AsyncClient,
        criteria: DiscoveryCriteria,
    ) -> list[DiscoveredCandidate]:
        """Directly query Y Combinator / Work at a Startup structured hiring database."""
        print(f"  [🚀 DIRECT YC INGESTION] Querying Y Combinator live database...", flush=True)
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        candidates: list[DiscoveredCandidate] = []
        seen_slugs: set[str] = set()

        search_terms = criteria.industries or ["tech"]
        if criteria.custom_query:
            search_terms = [criteria.custom_query] + search_terms

        for term in search_terms:
            if len(candidates) >= criteria.limit:
                break
            url = f"https://www.workatastartup.com/jobs?query={urllib.parse.quote(term)}"
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    div = soup.find("div", {"data-page": True})
                    if div:
                        page_data = json.loads(div["data-page"])
                        jobs = page_data.get("props", {}).get("jobs", [])
                        for j in jobs:
                            slug = j.get("companySlug")
                            if not slug or slug in seen_slugs or slug.isdigit() or len(slug) < 2:
                                continue
                            seen_slugs.add(slug)

                            c_name = j.get("companyName") or slug.replace("-", " ").title()
                            c_domain = f"{slug}.com"
                            c_website = f"https://www.ycombinator.com/companies/{slug}"
                            role_title = j.get("title") or "Software Engineer"
                            salary = j.get("salary")
                            salary_str = f" ({salary})" if salary else ""
                            one_liner = j.get("companyOneLiner") or ""
                            batch = j.get("companyBatch")
                            batch_str = f" · YC {batch}" if batch else ""
                            location = j.get("location") or "Remote"

                            snippet = f"{role_title}{salary_str} · {one_liner}{batch_str}".strip()

                            cand = DiscoveredCandidate(
                                domain=c_domain,
                                name=c_name,
                                website=c_website,
                                title=f"🚀 Hiring: {role_title}",
                                snippet=snippet,
                                source_url=c_website,
                                query=f"YC:{term}",
                                rank=len(candidates) + 1,
                                target_type="startup",
                                industry=term.capitalize() if term.lower() != "tech" else "Fintech",
                                location=location,
                                size=criteria.company_size_tier or "11-50",
                                source_platform="Y Combinator",
                            )
                            candidates.append(cand)
                            print(f"    ↳ ✅ [YC Direct] {c_name} ({c_domain}): {role_title}{salary_str}", flush=True)
                            if len(candidates) >= criteria.limit:
                                break
            except Exception as e:
                print(f"    ↳ ⚠️ WorkAtAStartup direct query failed for '{term}': {e}", flush=True)
                import traceback
                traceback.print_exc()
                logger.debug("WorkAtAStartup direct query failed for '%s': %s", term, e)

        # Fallback to hiringCompanies if jobs were fewer than limit
        if len(candidates) < criteria.limit:
            try:
                resp = await client.get("https://www.workatastartup.com/companies", headers=headers)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    div = soup.find("div", {"data-page": True})
                    if div:
                        page_data = json.loads(div["data-page"])
                        hiring = page_data.get("props", {}).get("hiringCompanies", [])
                        for co in hiring:
                            path = co.get("path") or ""
                            slug = path.removeprefix("/companies/").strip()
                            if not slug or slug in seen_slugs or slug.isdigit() or len(slug) < 2:
                                continue
                            seen_slugs.add(slug)
                            c_name = co.get("name") or slug.replace("-", " ").title()
                            c_domain = f"{slug}.com"
                            c_website = f"https://www.ycombinator.com/companies/{slug}"

                            cand = DiscoveredCandidate(
                                domain=c_domain,
                                name=c_name,
                                website=c_website,
                                title="🚀 Actively Hiring Tech Startup",
                                snippet=f"{c_name} is actively hiring engineers across engineering, product, and AI.",
                                source_url=c_website,
                                query="YC:Hiring",
                                rank=len(candidates) + 1,
                                target_type="startup",
                                industry="Tech",
                                location="Remote",
                                size=criteria.company_size_tier or "11-50",
                                source_platform="Y Combinator",
                            )
                            candidates.append(cand)
                            print(f"    ↳ ✅ [YC Direct Company] {c_name} ({c_domain})", flush=True)
                            if len(candidates) >= criteria.limit:
                                break
            except Exception as e:
                logger.debug("WorkAtAStartup companies query failed: %s", e)

        print(f"  [✅ YC DIRECT INGESTION COMPLETE] Retrieved {len(candidates)} verified YC companies.", flush=True)
        return candidates

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
            # 1. Direct Structured Ingestion for Y Combinator (Solution 1)
            plat = (criteria.source_platform or "").lower().strip()
            if plat in ("yc", "ycombinator"):
                yc_raw = await self._fetch_yc_structured_companies(client, criteria)
                for cand in yc_raw:
                    if len(candidates) >= criteria.limit:
                        break
                    if cand.domain in seen_domains:
                        continue
                    seen_domains.add(cand.domain)

                    existing = await self.state.get_company_by_domain(cand.domain)
                    is_existing = existing is not None
                    cand.is_existing = is_existing
                    if existing:
                        cand.company_id = existing.id
                    elif criteria.save_to_db:
                        company_record = Company(
                            domain=cand.domain,
                            name=cand.name,
                            website=cand.website,
                            description=cand.snippet[:400],
                            source="yc_direct_discovery",
                            source_url=cand.source_url,
                            notes="Discovered via Y Combinator Structured Feed",
                            industry=cand.industry,
                            location=cand.location,
                            size=cand.size,
                        )
                        cand.company_id = await self.state.add_company(company_record)
                    else:
                        cand.company_id = f"staged_{cand.domain.replace('.', '_')}"

                    if criteria.auto_enrich:
                        print(f"      ↳ ⚡ Auto-enriching {cand.name} ({cand.website})...", flush=True)
                        try:
                            res = await asyncio.wait_for(
                                self.enricher.enrich_url(cand.website, persist=criteria.save_to_db),
                                timeout=8.0
                            )
                            cand.enrichment_result = res
                        except Exception as e_err:
                            logger.debug("Auto-enrichment error for %s: %s", cand.website, e_err)

                    candidates.append(cand)

                print(f"[✨ ICP DISCOVERY COMPLETE] Discovered {len(candidates)} verified YC companies total.\n", flush=True)
                return candidates[:criteria.limit]

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

                    title_lower = item.get("title", "").lower()
                    snippet_lower = (item.get("snippet", "") + " " + title_lower).lower()

                    # Check if result is from a recognized platform (YC, Ashby, Lever, Wellfound, Product Hunt, etc.)
                    plat_ent = parse_platform_candidate(raw_link, item.get("title", ""), item.get("snippet", ""))
                    if plat_ent:
                        source_platform = plat_ent["source_platform"]
                        domain = plat_ent["domain"]
                        b_name = plat_ent["name"]
                        website = plat_ent["website"]
                    else:
                        source_platform = "Global Web"
                        raw_domain = normalize_domain(raw_link)
                        domain = company_host(raw_domain)
                        if not domain:
                            continue

                        # If newsroom or PR subdomain, canonicalize to root company domain
                        if domain.startswith("newsroom.") or domain.startswith("pr."):
                            domain = re.sub(r"^(newsroom|pr)\.", "", domain)
                            website = f"https://{domain}"
                        else:
                            website = raw_link

                        b_name = business_name(item.get("title", ""), domain)

                        if is_junk_domain(domain):
                            print(f"    ↳ ⛔ Filtered out aggregator/directory/job board domain: '{domain}'", flush=True)
                            continue

                        # Filter out job boards, blog posts, case-studies, rankings, and forum threads
                        raw_link_lower = raw_link.lower()
                        if any(junk_path in raw_link_lower for junk_path in (
                            "/jobs/", "/job/", "/careers/", "/career/", "/details/", "/new-job/",
                            "/job-search/", "/openings/", "/vacancy/", "/positions/",
                            "/blog", "/blogs", "/grow/", "/playbook/", "/insights/", "/guides/", "/resources/",
                            "/product/studio/trial", "/free-trial", "/trial/", "/download/",
                            "/case-study", "/case-studies", "/ranking", "/rankings", "/top-",
                            "/list-of", "/companies-like", "/vs-", "-vs-", "/alternatives-to",
                            "/reports/", "/investors/", "/sector/", "/academy/", "/news/",
                            "/article/", "/press-release/", "/t/", "/thread/", "/discussion/",
                            "/category/", "/tag/", "/topic/"
                        )):
                            print(f"    ↳ ⛔ Filtered out job post/article/case study path: '{raw_link}'", flush=True)
                            continue

                        # Filter out ranking listicle, job board, and case study titles
                        if any(bad in title_lower for bad in (
                            "case study", "case studies", "ranking", "rankings", "top 10",
                            "top 20", "top 50", "top 100", "list of", "directory", "database of",
                            "accelerator program", "portfolio companies", "investors and vc",
                            "vc funds", "recently funded startups", "crowdfund your", "job board",
                            "how to hire", "playbook", "first 100"
                        )):
                            print(f"    ↳ ⛔ Filtered out ranking/case study/guide title: '{item.get('title')}'", flush=True)
                            continue

                    # Filter out enterprise giants if user targeted small size (1-10 or 11-50)
                    if criteria.company_size_tier in ("1-10", "11-50"):
                        if any(corp in snippet_lower for corp in (
                            "fortune 500", "multinational corporation", "tens of thousands of employees",
                            "global enterprise", "nyse:", "nasdaq:", "publicly traded", "market cap"
                        )):
                            print(f"    ↳ ⛔ Filtered out enterprise giant by snippet: '{item.get('title')}'", flush=True)
                            continue

                    b_name = clean_company_name(b_name)
                    if not b_name or len(b_name) < 2:
                        print(f"    ↳ ⛔ Filtered out invalid/empty company name: '{b_name}'", flush=True)
                        continue

                    # If name is a purely generic SEO slogan (e.g. "Web Design & Custom Software Studio"), fall back to domain
                    if re.search(r"^(?:web design|software development|custom software|digital marketing|full stack|mobile app|product design)(?:\s+(?:studio|agency|services|company|solutions|firm|and|\&))", b_name, re.I):
                        stem_name = domain.split(".")[0].replace("-", " ").title()
                        if len(stem_name) >= 3:
                            b_name = stem_name

                    if is_investor_or_vc(b_name, item.get("title", ""), item.get("snippet", "")):
                        print(f"    ↳ ⛔ Filtered out VC/investor/fund: '{b_name}'", flush=True)
                        continue

                    if re.match(r"^(?:job board|founding engineer|software engineer|lead engineer|remote developer|trading associate)\b", b_name.lower()):
                        print(f"    ↳ ⛔ Filtered out job role string as company name: '{b_name}'", flush=True)
                        continue

                    if domain in seen_domains:
                        print(f"    ↳ ⏭️ Skipping already-seen domain in this run: '{domain}'", flush=True)
                        continue
                    seen_domains.add(domain)

                    # Check if company already exists in state
                    existing = await self.state.get_company_by_domain(domain)
                    is_existing = existing is not None

                    # Determine target type (Startup vs Agency)
                    detected_type = criteria.target_type
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
                        website=website if not existing else (existing.website or website),
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
                        source_platform=source_platform,
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
