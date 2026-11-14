"""Firmographic Intelligence and Company Filtering Engine.

Extracts company size, revenue, location, funding, business model (agency vs product),
industry classification, and AI/engineering hiring signals from website content,
JSON-LD schemas, and ATS job feeds.

Strict Rules:
- Private company revenue and employee counts are never hallucinated or invented.
- Missing revenue or employee numbers explicitly default to None / "Unknown", NEVER 0.
- Every observation retains value, source URL, confidence, timestamp, currency, and reported vs estimated status.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from outreach.collectors.ats import detect_board, read_board
from outreach.startups import funding_recency

logger = logging.getLogger("outreach.firmographics")

EMPLOYEE_TIERS = ["1-10", "11-50", "51-200", "201-500", "500+"]

REVENUE_TIERS = [
    "<$100K",
    "$100K-$500K",
    "$500K-$1M",
    "$1M-$5M",
    "$5M-$10M",
    "$10M-$50M",
    "$50M+",
]

INDUSTRIES = [
    "Artificial Intelligence",
    "Generative AI",
    "SaaS",
    "Software Development",
    "IT Services",
    "AI Consulting",
    "Fintech",
    "Technology",
    "Other",
]

FUNDING_STAGES = [
    "Bootstrapped",
    "Pre-seed",
    "Seed",
    "Series A",
    "Series B",
    "Series C+",
    "Unknown",
]

TARGET_HIRING_ROLES = {
    "Applied AI Engineer": re.compile(r"\bapplied\s+ai\s+engineer\b", re.I),
    "AI Backend Engineer": re.compile(
        r"\b(?:ai\s+backend\s+engineer|backend\s+(?:ai|llm)\s+engineer|ai\s+platform\s+engineer)\b",
        re.I,
    ),
    "AI Agent Engineer": re.compile(
        r"\b(?:ai\s+)?agent(?:\s+workflow)?\s+engineer\b|\bai\s+automation\s+engineer\b",
        re.I,
    ),
    "LLM Engineer": re.compile(
        r"\b(?:llm|large\s+language\s+model)\s+(?:engineer|developer)\b",
        re.I,
    ),
    "AI Engineer": re.compile(
        r"\b(?:artificial\s+intelligence|ai)\s+(?:software\s+)?engineer\b",
        re.I,
    ),
    "Machine Learning Engineer": re.compile(
        r"\b(?:machine\s+learning|ml)\s+(?:research\s+)?engineer\b",
        re.I,
    ),
    "Python Backend Engineer": re.compile(
        r"\b(?:python\s+(?:backend\s+)?(?:engineer|developer)|backend\s+python\s+developer|senior\s+python\s+engineer)\b",
        re.I,
    ),
    "Contract Developer": re.compile(
        r"\b(?:contract(?:or)?|freelance)\s+(?:python|ai|backend|software)?\s*(?:engineer|developer|architect)\b",
        re.I,
    ),
    "Software Engineer": re.compile(
        r"\b(?:software\s+(?:development\s+)?engineer|full[- ]?stack\s+(?:engineer|developer)|backend\s+engineer)\b",
        re.I,
    ),
}

AI_TECH_STACK_PATTERNS: dict[str, re.Pattern] = {
    "LangChain": re.compile(r"\blangchain\b", re.I),
    "LangGraph": re.compile(r"\blanggraph\b", re.I),
    "LlamaIndex": re.compile(r"\bllamaindex\b", re.I),
    "OpenAI": re.compile(r"\bopenai\b|api\.openai\.com", re.I),
    "Anthropic": re.compile(r"\banthropic\b|api\.anthropic\.com", re.I),
    "HuggingFace": re.compile(r"\bhugging\s*face\b|huggingface\.co", re.I),
    "PyTorch": re.compile(r"\bpytorch\b", re.I),
    "TensorFlow": re.compile(r"\btensorflow\b", re.I),
    "FastAPI": re.compile(r"\bfastapi\b", re.I),
    "Pinecone": re.compile(r"\bpinecone\b", re.I),
    "Qdrant": re.compile(r"\bqdrant\b", re.I),
    "Weaviate": re.compile(r"\bweaviate\b", re.I),
    "ChromaDB": re.compile(r"\bchromadb\b|\bchroma\s+vector\b", re.I),
    "Ollama": re.compile(r"\bollama\b", re.I),
    "vLLM": re.compile(r"\bvllm\b", re.I),
    "DeepSeek": re.compile(r"\bdeepseek\b", re.I),
    "Mistral": re.compile(r"\bmistral(?:\s+ai)?\b", re.I),
}


@dataclass
class FirmographicObservation:
    """Audit trail record for a single observed firmographic fact."""

    field: str
    value: Any
    formatted_value: str
    source_url: str = ""
    confidence: float = 0.0
    observation_date: str = ""
    currency: str = "USD"
    is_estimated: bool = False

    def to_dict(self) -> dict:
        return {
            "field": self.field,
            "value": self.value,
            "formatted_value": self.formatted_value,
            "source_url": self.source_url,
            "confidence": self.confidence,
            "observation_date": self.observation_date,
            "currency": self.currency,
            "is_estimated": self.is_estimated,
        }


@dataclass
class HiringSignalObservation:
    """Individual open role or hiring signal detected."""

    role_title: str
    target_role_category: str
    department: str = ""
    location: str = ""
    is_remote: bool = False
    source_url: str = ""
    observed_at: str = ""

    def to_dict(self) -> dict:
        return {
            "role_title": self.role_title,
            "target_role_category": self.target_role_category,
            "department": self.department,
            "location": self.location,
            "is_remote": self.is_remote,
            "source_url": self.source_url,
            "observed_at": self.observed_at,
        }


@dataclass
class FirmographicProfile:
    """Complete firmographic intelligence profile for a company."""

    # Company Size
    employee_count: int | None = None
    employee_tier: str = "Unknown"  # "1-10", "11-50", "51-200", "201-500", "500+", "Unknown"
    employee_count_is_estimated: bool = False

    # Revenue
    revenue_amount: float | None = None
    revenue_currency: str = "USD"
    revenue_tier: str = "Unknown"  # "<$100K", "$100K-$500K", ..., "Unknown"
    revenue_is_estimated: bool = False

    # Location
    city: str = ""
    state: str = ""
    country: str = ""
    region: str = ""
    formatted_location: str = ""
    is_remote_friendly: bool = False

    # Industry & Model
    primary_industry: str = "Technology"
    industries: list[str] = field(default_factory=list)
    business_model: str = "Unknown"  # "agency", "product", "consulting", "hybrid", "Unknown"

    # Funding
    funding_stage: str = "Unknown"  # "Bootstrapped", "Seed", "Series A", ..., "Unknown"
    funding_amount: str = ""
    funding_date: str = ""
    is_recent_funding: bool = False

    # Founded & Age
    founded_year: int | None = None
    company_age: int | None = None

    # Hiring
    is_hiring: bool = False
    active_job_count: int = 0
    hiring_target_roles: list[str] = field(default_factory=list)
    hiring_signals: list[HiringSignalObservation] = field(default_factory=list)

    # Tech Stack
    ai_tech_stack: list[str] = field(default_factory=list)

    # Observations Audit Trail
    observations: list[FirmographicObservation] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "employee_count": self.employee_count,
            "employee_tier": self.employee_tier,
            "employee_count_is_estimated": self.employee_count_is_estimated,
            "revenue_amount": self.revenue_amount,
            "revenue_currency": self.revenue_currency,
            "revenue_tier": self.revenue_tier,
            "revenue_is_estimated": self.revenue_is_estimated,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "region": self.region,
            "formatted_location": self.formatted_location,
            "is_remote_friendly": self.is_remote_friendly,
            "primary_industry": self.primary_industry,
            "industries": self.industries,
            "business_model": self.business_model,
            "funding_stage": self.funding_stage,
            "funding_amount": self.funding_amount,
            "funding_date": self.funding_date,
            "is_recent_funding": self.is_recent_funding,
            "founded_year": self.founded_year,
            "company_age": self.company_age,
            "is_hiring": self.is_hiring,
            "active_job_count": self.active_job_count,
            "hiring_target_roles": self.hiring_target_roles,
            "hiring_signals": [s.to_dict() for s in self.hiring_signals],
            "ai_tech_stack": self.ai_tech_stack,
            "observations": [o.to_dict() for o in self.observations],
        }


def classify_employee_tier(count: int | None) -> str:
    """Map numeric headcount to standard tier."""
    if count is None:
        return "Unknown"
    if count <= 10:
        return "1-10"
    if count <= 50:
        return "11-50"
    if count <= 200:
        return "51-200"
    if count <= 500:
        return "201-500"
    return "500+"


def classify_revenue_tier(amount: float | None, currency: str = "USD") -> str:
    """Map revenue to standard tier."""
    if amount is None:
        return "Unknown"
    if amount < 100_000:
        return "<$100K"
    if amount <= 500_000:
        return "$100K-$500K"
    if amount <= 1_000_000:
        return "$500K-$1M"
    if amount <= 5_000_000:
        return "$1M-$5M"
    if amount <= 10_000_000:
        return "$5M-$10M"
    if amount <= 50_000_000:
        return "$10M-$50M"
    return "$50M+"


def parse_employee_count_from_text(text: str) -> tuple[int | None, bool]:
    """Parse employee headcount from text, returning (count, is_estimated)."""
    # 1. Range pattern first: "10-50 employees", "20 to 40 engineers"
    m_range = re.search(
        r"\b(\d{1,5})\s*[-–to]\s*(\d{1,5})\s*(?:employees|team\s+members|people|engineers|staff)\b",
        text,
        re.I,
    )
    if m_range:
        try:
            low = int(m_range.group(1))
            high = int(m_range.group(2))
            mid = (low + high) // 2
            return mid, True
        except ValueError:
            pass

    # 2. Exact "team of X", "X employees", "X team members"
    m_exact = re.search(
        r"\b(?:team\s+of|we\s+are|company\s+of|over|more\s+than)?\s*(\d{1,5})\s*(?:\+\s*)?(?:employees|team\s+members|people|engineers|staff)\b",
        text,
        re.I,
    )
    if m_exact:
        try:
            val = int(m_exact.group(1))
            if 1 <= val <= 50000:
                is_est = "over" in m_exact.group(0).lower() or "+" in m_exact.group(0)
                return val, is_est
        except ValueError:
            pass

    return None, False


def parse_revenue_from_text(text: str) -> tuple[float | None, str, bool]:
    """Parse explicit stated revenue or ARR from text, returning (amount, currency, is_estimated)."""
    m = re.search(
        r"([$€£])\s*(\d+(?:\.\d+)?)\s*(k|m|b|million|billion)?\s*(?:in\s+)?(?:annual(?:ly)?|arr|revenue|recurring\s+revenue)\b",
        text,
        re.I,
    )
    if not m:
        m = re.search(
            r"\b(?:arr|annual\s+revenue)\s*(?:of|is|:)?\s*([$€£])\s*(\d+(?:\.\d+)?)\s*(k|m|b|million|billion)?\b",
            text,
            re.I,
        )

    if m:
        curr_symbol = m.group(1)
        curr = "USD" if curr_symbol == "$" else ("EUR" if curr_symbol == "€" else "GBP")
        try:
            num = float(m.group(2))
            multiplier = (m.group(3) or "").lower()
            if multiplier in ("k",):
                num *= 1_000
            elif multiplier in ("m", "million"):
                num *= 1_000_000
            elif multiplier in ("b", "billion"):
                num *= 1_000_000_000
            return num, curr, False
        except (ValueError, TypeError):
            pass

    return None, "USD", False


def detect_funding_stage(text: str) -> tuple[str, str, str]:
    """Extract funding stage, amount, and date from text."""
    # Pre-seed / Seed
    if re.search(r"\bpre[- ]seed\b", text, re.I):
        m_amt = re.search(r"([$€£]\s*\d+(?:\.\d+)?\s*(?:[KkMm]|million)?)", text)
        amt = m_amt.group(1) if m_amt else ""
        return "Pre-seed", amt, ""

    if re.search(r"\bseed\s+(?:round|funding|stage|investment)\b|\braised\s+(?:a\s+)?seed\b", text, re.I):
        m_amt = re.search(r"([$€£]\s*\d+(?:\.\d+)?\s*(?:[KkMm]|million)?)", text)
        amt = m_amt.group(1) if m_amt else ""
        return "Seed", amt, ""

    # Series A, B, C+
    m_series = re.search(r"\bseries\s+([A-G])\b", text, re.I)
    if m_series:
        letter = m_series.group(1).upper()
        stage = f"Series {letter}" if letter in ("A", "B") else "Series C+"
        m_amt = re.search(r"([$€£]\s*\d+(?:\.\d+)?\s*(?:[KkMm]|million)?)", text)
        amt = m_amt.group(1) if m_amt else ""
        return stage, amt, ""

    # Bootstrapped
    if re.search(r"\bbootstrapped\b|\bself[- ]funded\b|\bzero\s+funding\b", text, re.I):
        return "Bootstrapped", "", ""

    return "Unknown", "", ""


def detect_business_model(text: str, tech_stack: list[str] | None = None) -> str:
    """Determine whether the company is an agency/consultancy, product/SaaS, or hybrid."""
    low = text.lower()
    agency_score = 0
    product_score = 0

    agency_terms = [
        "digital agency", "software development agency", "development shop", "web agency",
        "our clients", "client projects", "case studies", "services we offer",
        "hire us", "hire our team", "contract development", "custom software development",
        "staff augmentation", "consultancy", "consulting services", "bespoke development",
    ]
    for term in agency_terms:
        if term in low:
            agency_score += 1

    product_terms = [
        "pricing", "monthly subscription", "saas", "sign up for free",
        "try for free", "start free trial", "book a demo", "our platform",
        "product features", "api documentation", "cloud platform",
    ]
    for term in product_terms:
        if term in low:
            product_score += 1

    if agency_score >= 2 and product_score == 0:
        return "agency"
    if product_score >= 2 and agency_score == 0:
        return "product"
    if agency_score >= 1 and "agency" in low:
        return "agency"
    if product_score >= 1 and ("saas" in low or "pricing" in low):
        return "product"
    if agency_score > 0 and product_score > 0:
        return "hybrid"

    return "Unknown"


def detect_industry(text: str, site_name: str = "", tech_stack: list[str] | None = None) -> tuple[str, list[str]]:
    """Classify primary industry and list matching categories."""
    low = (text + " " + site_name).lower()
    matched = []

    if re.search(r"\b(?:generative\s+ai|genai|llms?|foundational\s+models)\b", low):
        matched.append("Generative AI")
    if re.search(r"\b(?:artificial\s+intelligence|\bai\b|machine\s+learning|\bml\b|nlp|computer\s+vision)\b", low):
        matched.append("Artificial Intelligence")
    if re.search(r"\b(?:ai\s+consulting|ai\s+advisory|ai\s+solutions\s+partner)\b", low):
        matched.append("AI Consulting")
    if re.search(r"\b(?:saas|software\s+as\s+a\s+service|cloud[- ]based\s+platform)\b", low):
        matched.append("SaaS")
    if re.search(r"\b(?:software\s+(?:development|engineering)|custom\s+software|app\s+development)\b", low):
        matched.append("Software Development")
    if re.search(r"\b(?:it\s+services|it\s+consulting|managed\s+services)\b", low):
        matched.append("IT Services")
    if re.search(r"\b(?:fintech|financial\s+technology|payments|banking\s+tech)\b", low):
        matched.append("Fintech")

    primary = "Technology"
    if "Generative AI" in matched:
        primary = "Generative AI"
    elif "Artificial Intelligence" in matched:
        primary = "Artificial Intelligence"
    elif "AI Consulting" in matched:
        primary = "AI Consulting"
    elif "SaaS" in matched:
        primary = "SaaS"
    elif "Software Development" in matched:
        primary = "Software Development"
    elif "IT Services" in matched:
        primary = "IT Services"
    elif "Fintech" in matched:
        primary = "Fintech"
    elif matched:
        primary = matched[0]

    return primary, matched or [primary]


def detect_location(html: str) -> dict[str, Any]:
    """Extract location data (city, state, country, region, is_remote) from HTML and schema."""
    out = {
        "city": "",
        "state": "",
        "country": "",
        "region": "",
        "formatted_location": "",
        "is_remote_friendly": False,
    }

    # 1. Remote friendly check
    if re.search(r"\b(?:fully\s+remote|remote[- ]first|distributed\s+team|100%\s+remote|work\s+from\s+anywhere|remote\s+friendly)\b", html, re.I):
        out["is_remote_friendly"] = True

    # 2. Extract from JSON-LD schema
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S):
        try:
            data = json.loads(m.group(1))
            items = data if isinstance(data, list) else [data]
            for item in items:
                addr = item.get("address")
                if isinstance(addr, dict):
                    out["city"] = addr.get("addressLocality") or out["city"]
                    out["state"] = addr.get("addressRegion") or out["state"]
                    out["country"] = addr.get("addressCountry") or out["country"]
                elif isinstance(addr, str):
                    out["formatted_location"] = addr
        except Exception:
            continue

    # 3. Footer / text pattern extraction if empty
    if not (out["city"] or out["country"] or out["formatted_location"]):
        m_loc = re.search(
            r"\b(?:Headquartered|Based|Offices?)\s+(?:in|at)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?(?:,\s*[A-Z][a-zA-Z\s]+)?)\b",
            html,
            re.I,
        )
        if m_loc:
            cand = m_loc.group(1).strip()
            parts = [p.strip() for p in cand.split(",") if p.strip()]
            if len(parts) == 1:
                out["country"] = parts[0]
            elif len(parts) >= 2:
                out["city"] = parts[0]
                out["country"] = parts[-1]

    parts = [p for p in [out["city"], out["state"], out["country"]] if p]
    if parts and not out["formatted_location"]:
        out["formatted_location"] = ", ".join(parts)

    return out


def detect_founded_year(text: str) -> int | None:
    """Extract year founded from text."""
    m = re.search(r"\b(?:founded|est(?:ablished)?|since)\s*(?:in\s*)?(\d{4})\b", text, re.I)
    if m:
        try:
            year = int(m.group(1))
            current_year = datetime.now(timezone.utc).year
            if 1950 <= year <= current_year:
                return year
        except ValueError:
            pass
    return None


def detect_ai_tech_stack(html: str) -> list[str]:
    """Detect AI tools, libraries, frameworks, and vector DBs."""
    found = set()
    for name, pattern in AI_TECH_STACK_PATTERNS.items():
        if pattern.search(html):
            found.add(name)
    return sorted(found)


class FirmographicExtractor:
    """Main extractor that processes site snapshots and ATS feeds."""

    async def extract_firmographics(
        self,
        pages: list[tuple[str, str]],  # (url, html)
        domain: str = "",
        client: httpx.AsyncClient | None = None,
    ) -> FirmographicProfile:
        """Extract complete firmographic intelligence across crawled pages."""
        profile = FirmographicProfile()
        now_iso = datetime.now(timezone.utc).isoformat()
        current_year = datetime.now(timezone.utc).year

        all_text = " ".join(html for _, html in pages)
        home_url = pages[0][0] if pages else f"https://{domain}"

        # 1. AI Tech Stack
        for u, html in pages:
            for tech in detect_ai_tech_stack(html):
                if tech not in profile.ai_tech_stack:
                    profile.ai_tech_stack.append(tech)
        profile.ai_tech_stack.sort()

        # 2. Company Size / Headcount
        # Check schema first
        for u, html in pages:
            for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S):
                try:
                    data = json.loads(m.group(1))
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        num = item.get("numberOfEmployees")
                        if isinstance(num, dict) and "value" in num:
                            profile.employee_count = int(num["value"])
                            profile.employee_tier = classify_employee_tier(profile.employee_count)
                            profile.observations.append(
                                FirmographicObservation(
                                    field="employee_count",
                                    value=profile.employee_count,
                                    formatted_value=profile.employee_tier,
                                    source_url=u,
                                    confidence=0.95,
                                    observation_date=now_iso,
                                    is_estimated=False,
                                )
                            )
                            break
                        elif isinstance(num, (int, str)) and str(num).isdigit():
                            profile.employee_count = int(num)
                            profile.employee_tier = classify_employee_tier(profile.employee_count)
                            profile.observations.append(
                                FirmographicObservation(
                                    field="employee_count",
                                    value=profile.employee_count,
                                    formatted_value=profile.employee_tier,
                                    source_url=u,
                                    confidence=0.95,
                                    observation_date=now_iso,
                                    is_estimated=False,
                                )
                            )
                            break
                except Exception:
                    continue
            if profile.employee_count is not None:
                break

        # If not in schema, parse from text
        if profile.employee_count is None:
            for u, html in pages:
                count, is_est = parse_employee_count_from_text(html)
                if count is not None:
                    profile.employee_count = count
                    profile.employee_count_is_estimated = is_est
                    profile.employee_tier = classify_employee_tier(count)
                    profile.observations.append(
                        FirmographicObservation(
                            field="employee_count",
                            value=count,
                            formatted_value=profile.employee_tier,
                            source_url=u,
                            confidence=0.75 if not is_est else 0.60,
                            observation_date=now_iso,
                            is_estimated=is_est,
                        )
                    )
                    break

        # 3. Revenue
        for u, html in pages:
            rev_amt, curr, is_est = parse_revenue_from_text(html)
            if rev_amt is not None:
                profile.revenue_amount = rev_amt
                profile.revenue_currency = curr
                profile.revenue_is_estimated = is_est
                profile.revenue_tier = classify_revenue_tier(rev_amt, curr)
                profile.observations.append(
                    FirmographicObservation(
                        field="revenue",
                        value=rev_amt,
                        formatted_value=profile.revenue_tier,
                        source_url=u,
                        confidence=0.80,
                        observation_date=now_iso,
                        currency=curr,
                        is_estimated=is_est,
                    )
                )
                break

        # 4. Location & Remote
        for u, html in pages:
            if re.search(r"\b(?:fully\s+remote|remote[- ]first|distributed\s+team|100%\s+remote|work\s+from\s+anywhere|remote\s+friendly)\b", html, re.I):
                profile.is_remote_friendly = True

            if not profile.formatted_location:
                loc_data = detect_location(html)
                if loc_data["city"] or loc_data["country"] or loc_data["formatted_location"]:
                    profile.city = loc_data["city"]
                    profile.state = loc_data["state"]
                    profile.country = loc_data["country"]
                    profile.region = loc_data["region"]
                    profile.formatted_location = loc_data["formatted_location"]
                    profile.observations.append(
                        FirmographicObservation(
                            field="location",
                            value=profile.formatted_location,
                            formatted_value=profile.formatted_location,
                            source_url=u,
                            confidence=0.85,
                            observation_date=now_iso,
                        )
                    )

        # 5. Business Model (Agency vs Product)
        profile.business_model = detect_business_model(all_text, profile.ai_tech_stack)
        if profile.business_model != "Unknown":
            profile.observations.append(
                FirmographicObservation(
                    field="business_model",
                    value=profile.business_model,
                    formatted_value=profile.business_model.capitalize(),
                    source_url=home_url,
                    confidence=0.80,
                    observation_date=now_iso,
                )
            )

        # 6. Industry
        primary_ind, ind_list = detect_industry(all_text)
        profile.primary_industry = primary_ind
        profile.industries = ind_list
        profile.observations.append(
            FirmographicObservation(
                field="industry",
                value=primary_ind,
                formatted_value=primary_ind,
                source_url=home_url,
                confidence=0.85,
                observation_date=now_iso,
            )
        )

        # 7. Funding
        stage, amt, f_date = detect_funding_stage(all_text)
        profile.funding_stage = stage
        profile.funding_amount = amt
        profile.funding_date = f_date
        if stage != "Unknown":
            recency = funding_recency(f_date)
            profile.is_recent_funding = recency == "recent" or (stage in ("Pre-seed", "Seed") and not f_date)
            profile.observations.append(
                FirmographicObservation(
                    field="funding",
                    value=f"{stage} {amt}".strip(),
                    formatted_value=stage,
                    source_url=home_url,
                    confidence=0.80,
                    observation_date=now_iso,
                )
            )

        # 8. Founded Year
        f_year = detect_founded_year(all_text)
        if f_year:
            profile.founded_year = f_year
            profile.company_age = current_year - f_year
            profile.observations.append(
                FirmographicObservation(
                    field="founded_year",
                    value=f_year,
                    formatted_value=str(f_year),
                    source_url=home_url,
                    confidence=0.90,
                    observation_date=now_iso,
                )
            )

        # 9. Hiring Signals (ATS + Inline Careers Pages)
        # Check for ATS board on any page
        ats_roles: list[dict] = []
        if client:
            for u, html in pages:
                board = detect_board(html)
                if board:
                    try:
                        roles = await read_board(board, client)
                        if roles:
                            ats_roles.extend(roles)
                            break
                    except Exception as err:
                        logger.debug("Failed reading ATS board %s: %s", board, err)

        # Process open roles
        hiring_signals: list[HiringSignalObservation] = []
        target_role_names: set[str] = set()

        if ats_roles:
            profile.is_hiring = True
            profile.active_job_count = len(ats_roles)
            for r in ats_roles:
                title = r.get("title", "")
                r_loc = r.get("location", "")
                r_dept = r.get("department", "")
                is_rem = "remote" in title.lower() or "remote" in r_loc.lower()

                # Match against target AI/engineering categories
                for cat_name, pat in TARGET_HIRING_ROLES.items():
                    if pat.search(title):
                        target_role_names.add(cat_name)
                        hiring_signals.append(
                            HiringSignalObservation(
                                role_title=title,
                                target_role_category=cat_name,
                                department=r_dept,
                                location=r_loc,
                                is_remote=is_rem,
                                source_url=r.get("url", home_url),
                                observed_at=now_iso,
                            )
                        )
                        break

        # Fallback: scan HTML pages for job titles if no ATS roles were fetched
        if not hiring_signals:
            for u, html in pages:
                is_career_page = re.search(r"/(careers?|jobs?|join-us|open-positions)", u, re.I) is not None
                if is_career_page or "hiring" in html.lower():
                    profile.is_hiring = True
                    for cat_name, pat in TARGET_HIRING_ROLES.items():
                        m_role = pat.search(html)
                        if m_role:
                            target_role_names.add(cat_name)
                            matched_str = m_role.group(0).strip().title()
                            hiring_signals.append(
                                HiringSignalObservation(
                                    role_title=matched_str,
                                    target_role_category=cat_name,
                                    source_url=u,
                                    observed_at=now_iso,
                                )
                            )

        profile.hiring_signals = hiring_signals
        profile.hiring_target_roles = sorted(target_role_names)
        if target_role_names:
            profile.observations.append(
                FirmographicObservation(
                    field="hiring_signals",
                    value=list(target_role_names),
                    formatted_value=", ".join(sorted(target_role_names)),
                    source_url=home_url,
                    confidence=0.85,
                    observation_date=now_iso,
                )
            )

        return profile


@dataclass
class FirmographicFilter:
    """Filter criteria used to qualify or reject companies."""

    # Size
    employee_tiers: list[str] = field(default_factory=list)  # e.g. ["1-10", "11-50"]
    min_employees: int | None = None
    max_employees: int | None = None

    # Revenue
    revenue_tiers: list[str] = field(default_factory=list)
    min_revenue: float | None = None
    max_revenue: float | None = None
    currency: str = "USD"

    # Location
    countries: list[str] = field(default_factory=list)
    states: list[str] = field(default_factory=list)
    cities: list[str] = field(default_factory=list)
    remote_only: bool = False

    # Industry & Business Model
    industries: list[str] = field(default_factory=list)
    business_models: list[str] = field(default_factory=list)  # ["agency", "product", "consulting"]

    # Funding
    funding_stages: list[str] = field(default_factory=list)
    require_recent_funding: bool = False

    # Hiring
    require_hiring: bool = False
    hiring_roles: list[str] = field(default_factory=list)  # target role categories

    # Tech Stack
    required_ai_tech: list[str] = field(default_factory=list)

    def matches(self, profile: FirmographicProfile) -> tuple[bool, list[str]]:
        """Evaluate if profile satisfies all filter criteria.

        Returns (is_match, reasons).
        """
        reasons = []

        # 1. Employee Size filter
        if self.employee_tiers:
            if profile.employee_tier not in self.employee_tiers:
                return False, [f"Employee tier '{profile.employee_tier}' not in allowed: {self.employee_tiers}"]
            reasons.append(f"Size tier matches: {profile.employee_tier}")

        if self.min_employees is not None:
            if profile.employee_count is None or profile.employee_count < self.min_employees:
                return False, [f"Headcount {profile.employee_count} is below min {self.min_employees}"]
            reasons.append(f"Headcount >= {self.min_employees}")

        if self.max_employees is not None:
            if profile.employee_count is not None and profile.employee_count > self.max_employees:
                return False, [f"Headcount {profile.employee_count} exceeds max {self.max_employees}"]
            if profile.employee_count is not None:
                reasons.append(f"Headcount <= {self.max_employees}")

        # 2. Revenue filter
        if self.revenue_tiers:
            if profile.revenue_tier not in self.revenue_tiers:
                return False, [f"Revenue tier '{profile.revenue_tier}' not in allowed: {self.revenue_tiers}"]
            reasons.append(f"Revenue tier matches: {profile.revenue_tier}")

        if self.min_revenue is not None:
            if profile.revenue_amount is None or profile.revenue_amount < self.min_revenue:
                return False, [f"Revenue {profile.revenue_amount} is below min {self.min_revenue}"]
            reasons.append(f"Revenue >= {self.min_revenue}")

        if self.max_revenue is not None:
            if profile.revenue_amount is not None and profile.revenue_amount > self.max_revenue:
                return False, [f"Revenue {profile.revenue_amount} exceeds max {self.max_revenue}"]
            if profile.revenue_amount is not None:
                reasons.append(f"Revenue <= {self.max_revenue}")

        # 3. Location filter
        if self.remote_only and not profile.is_remote_friendly:
            return False, ["Company is not marked as remote-friendly"]

        if self.countries:
            match_c = any(c.lower() in profile.country.lower() or c.lower() in profile.formatted_location.lower()
                          for c in self.countries)
            if not match_c:
                return False, [f"Country '{profile.country}' does not match required: {self.countries}"]
            reasons.append(f"Country matches: {profile.country}")

        if self.cities:
            match_city = any(c.lower() in profile.city.lower() or c.lower() in profile.formatted_location.lower()
                             for c in self.cities)
            if not match_city:
                return False, [f"City '{profile.city}' does not match required: {self.cities}"]
            reasons.append(f"City matches: {profile.city}")

        # 4. Industry filter
        if self.industries:
            match_ind = any(i.lower() in [ind.lower() for ind in profile.industries] or i.lower() == profile.primary_industry.lower()
                            for i in self.industries)
            if not match_ind:
                return False, [f"Industry '{profile.primary_industry}' does not match required: {self.industries}"]
            reasons.append(f"Industry matches: {profile.primary_industry}")

        # 5. Business Model filter (Agency vs Product)
        if self.business_models:
            if profile.business_model.lower() not in [m.lower() for m in self.business_models]:
                return False, [f"Business model '{profile.business_model}' does not match: {self.business_models}"]
            reasons.append(f"Business model matches: {profile.business_model}")

        # 6. Funding filter
        if self.funding_stages:
            if profile.funding_stage not in self.funding_stages:
                return False, [f"Funding stage '{profile.funding_stage}' does not match: {self.funding_stages}"]
            reasons.append(f"Funding stage matches: {profile.funding_stage}")

        if self.require_recent_funding and not profile.is_recent_funding:
            return False, ["Recent funding required but not observed"]

        # 7. Hiring filter
        if self.require_hiring and not profile.is_hiring:
            return False, ["Hiring activity required but not detected"]

        if self.hiring_roles:
            match_roles = any(r.lower() in [hr.lower() for hr in profile.hiring_target_roles]
                              for r in self.hiring_roles)
            if not match_roles:
                return False, [f"Target hiring roles {profile.hiring_target_roles} do not include any required: {self.hiring_roles}"]
            reasons.append(f"Hiring target roles match: {profile.hiring_target_roles}")

        # 8. Tech Stack filter
        if self.required_ai_tech:
            for tech in self.required_ai_tech:
                if tech.lower() not in [t.lower() for t in profile.ai_tech_stack]:
                    return False, [f"Required AI technology '{tech}' not found in {profile.ai_tech_stack}"]
            reasons.append(f"Required AI tech found: {self.required_ai_tech}")

        return True, reasons
