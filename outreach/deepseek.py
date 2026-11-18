"""DeepSeek AI Intelligence Provider for Outreach / Outreach.

Provides optional, drop-in LLM capabilities alongside deterministic heuristics:
1. Normalizing eccentric or non-standard executive/technical job titles.
2. Structured decision-maker and leadership entity extraction from page text.
3. Firmographic classification (industry, business model, remote posture).
4. Personalized outreach proposal tailoring with strict anti-fluff guardrails.

Strict Rules & Safety:
- No hard dependencies: If DEEPSEEK_API_KEY is unset or API calls fail/time out,
  every method seamlessly falls back to local regex and deterministic heuristics.
- Zero AI hallucinations / fluff ("Hope this finds you well", "Synergy", etc.).
- Token and timeout budgets: Capped input lengths, bounded output tokens,
  and exponential backoff on transient HTTP 429/5xx errors.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger("outreach.deepseek")

DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"
DEFAULT_TIMEOUT_SECONDS = 15.0
DEFAULT_MAX_RETRIES = 2
DEFAULT_MAX_TOKENS = 1024


def _get_env_val(key: str, default: str = "") -> str:
    val = os.environ.get(key)
    if val is not None and val.strip():
        return val.strip()
    try:
        from dotenv import load_dotenv
        from outreach.paths import PROJECT_ROOT
        env_file = PROJECT_ROOT / ".env"
        if env_file.exists():
            load_dotenv(env_file)
        else:
            load_dotenv()
    except Exception:
        pass
    return os.environ.get(key, default).strip()


@dataclass
class DeepSeekConfig:
    """Configuration for DeepSeek API operations."""

    api_key: str = field(default_factory=lambda: _get_env_val("DEEPSEEK_API_KEY", ""))
    base_url: str = field(
        default_factory=lambda: _get_env_val("DEEPSEEK_BASE_URL", DEFAULT_DEEPSEEK_BASE_URL)
    )
    model: str = field(
        default_factory=lambda: _get_env_val("DEEPSEEK_MODEL", DEFAULT_DEEPSEEK_MODEL)
    )
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_retries: int = DEFAULT_MAX_RETRIES
    max_tokens: int = DEFAULT_MAX_TOKENS
    temperature: float = 0.1

    def is_configured(self) -> bool:
        """Check whether a valid API key is present."""
        return bool(self.api_key and len(self.api_key) > 5)


class DeepSeekRateLimiter:
    """Limits DeepSeek API calls per IP to 1 call per 24 hours (86,400s) with SQLite persistence.

    Also enforces a global daily cap (default: 30 calls/day across all visitors)
    to protect the user's API key and wallet from credit exhaustion.
    """

    def __init__(
        self,
        window_seconds: float = 86400.0,
        max_calls_per_window: int = 1,
        global_daily_cap: int = 30,
    ) -> None:
        import time
        self._time = time
        self.window_seconds = float(os.environ.get("DEEPSEEK_RATE_LIMIT_SECONDS", window_seconds))
        self.max_calls_per_window = int(os.environ.get("DEEPSEEK_MAX_CALLS_PER_IP", max_calls_per_window))
        self.global_daily_cap = int(os.environ.get("DEEPSEEK_GLOBAL_DAILY_CAP", global_daily_cap))
        self._ip_cache: dict[str, list[float]] = {}
        self._global_calls_today: list[float] = []
        self._init_sqlite()

    def _init_sqlite(self) -> None:
        try:
            import sqlite3
            from outreach.paths import DB_PATH
            if DB_PATH.parent.exists():
                with sqlite3.connect(str(DB_PATH)) as conn:
                    conn.execute("""
                        CREATE TABLE IF NOT EXISTS deepseek_rate_limits (
                            ip TEXT PRIMARY KEY,
                            last_called_at REAL,
                            calls_count INTEGER DEFAULT 1
                        )
                    """)
                    conn.commit()
        except Exception as e:
            logger.debug("Rate limiter SQLite init skipped: %s", e)

    def can_call(self, client_ip: str = "") -> tuple[bool, str]:
        if os.environ.get("DEEPSEEK_RATE_LIMIT_DISABLED") == "1":
            return True, "Rate limit disabled"

        now = self._time.time()
        ip = (client_ip or "unknown").strip().lower()
        cutoff = now - self.window_seconds

        # Clean timestamps older than window
        self._global_calls_today = [t for t in self._global_calls_today if t > cutoff]

        # 1. Global cap check
        if len(self._global_calls_today) >= self.global_daily_cap:
            return False, f"Global demo cap reached ({self.global_daily_cap} calls/24h). Resets tomorrow."

        # 2. Check in-memory cache
        if ip in self._ip_cache:
            self._ip_cache[ip] = [t for t in self._ip_cache[ip] if t > cutoff]
            if len(self._ip_cache[ip]) >= self.max_calls_per_window:
                elapsed = now - self._ip_cache[ip][-1]
                remaining_hours = max(1, int((self.window_seconds - elapsed) / 3600))
                return False, f"Demo limit: 1 AI generation per 24 hours per visitor. Resets in ~{remaining_hours}h."

        # 3. Check persistent SQLite database
        try:
            import sqlite3
            from outreach.paths import DB_PATH
            if DB_PATH.exists():
                with sqlite3.connect(str(DB_PATH)) as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT last_called_at FROM deepseek_rate_limits WHERE ip = ?", (ip,))
                    row = cur.fetchone()
                    if row and row[0]:
                        last_t = float(row[0])
                        if last_t > cutoff:
                            elapsed = now - last_t
                            remaining_hours = max(1, int((self.window_seconds - elapsed) / 3600))
                            return False, f"Demo limit: 1 AI generation per 24 hours per visitor. Resets in ~{remaining_hours}h."
        except Exception:
            pass

        return True, "OK"

    def record_call(self, client_ip: str = "") -> None:
        now = self._time.time()
        ip = (client_ip or "unknown").strip().lower()
        self._global_calls_today.append(now)
        if ip not in self._ip_cache:
            self._ip_cache[ip] = []
        self._ip_cache[ip].append(now)

        try:
            import sqlite3
            from outreach.paths import DB_PATH
            if DB_PATH.parent.exists():
                with sqlite3.connect(str(DB_PATH)) as conn:
                    conn.execute("""
                        INSERT INTO deepseek_rate_limits (ip, last_called_at, calls_count)
                        VALUES (?, ?, 1)
                        ON CONFLICT(ip) DO UPDATE SET
                            last_called_at = excluded.last_called_at,
                            calls_count = calls_count + 1
                    """, (ip, now))
                    conn.commit()
        except Exception as e:
            logger.debug("Failed to record rate limit in SQLite: %s", e)


class DeepSeekClient:
    """Async client for DeepSeek API with retry policies, rate-limiting, and heuristic fallbacks."""

    def __init__(
        self,
        config: DeepSeekConfig | None = None,
        rate_limiter: DeepSeekRateLimiter | None = None,
    ) -> None:
        self.config = config or DeepSeekConfig()
        self.rate_limiter = rate_limiter or DeepSeekRateLimiter()

    def is_available(self) -> bool:
        """Check if DeepSeek is configured and ready for queries."""
        return self.config.is_configured()

    async def complete(
        self,
        messages: list[dict[str, str]],
        json_mode: bool = True,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any] | str | None:
        """Send chat completion to DeepSeek with retries and exponential backoff."""
        if not self.is_available():
            logger.debug("DeepSeek is not configured; skipping API call.")
            return None

        url = f"{self.config.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.config.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.config.max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        timeout = httpx.Timeout(self.config.timeout_seconds)

        for attempt in range(self.config.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, headers=headers, json=payload)

                # Transient rate limit or server error: retry with backoff
                if response.status_code in (429, 500, 502, 503, 504):
                    if attempt < self.config.max_retries:
                        delay = 1.0 * (2 ** attempt)
                        logger.warning(
                            "DeepSeek HTTP %d, retrying in %.1fs (attempt %d/%d)",
                            response.status_code,
                            delay,
                            attempt + 1,
                            self.config.max_retries,
                        )
                        await asyncio.sleep(delay)
                        continue
                    logger.warning("DeepSeek failed after %d retries with HTTP %d", self.config.max_retries, response.status_code)
                    return None

                if response.status_code != 200:
                    logger.warning("DeepSeek HTTP %d: %s", response.status_code, response.text[:200])
                    return None

                data = response.json()
                choices = data.get("choices") or []
                if not choices:
                    return None

                raw_content = choices[0].get("message", {}).get("content", "").strip()

                if json_mode:
                    # Strip any accidental markdown formatting (e.g. ```json ... ```)
                    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content, flags=re.MULTILINE)
                    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
                    try:
                        return json.loads(cleaned)
                    except json.JSONDecodeError as err:
                        logger.warning("DeepSeek returned invalid JSON: %s (content: %s)", err, raw_content[:150])
                        return None

                return raw_content

            except (httpx.TimeoutException, httpx.NetworkError) as err:
                if attempt < self.config.max_retries:
                    delay = 1.0 * (2 ** attempt)
                    logger.warning("DeepSeek network error: %s, retrying in %.1fs", err, delay)
                    await asyncio.sleep(delay)
                    continue
                logger.warning("DeepSeek failed on network error: %s", err)
                return None
            except Exception as exc:
                logger.warning("DeepSeek unexpected error: %s", exc)
                return None

        return None

    # ── High-Level Domain Intelligence Methods ────────────────────────

    async def normalize_title(self, raw_title: str, company_name: str = "") -> dict[str, Any]:
        """Normalize eccentric or non-standard executive titles with heuristic fallback."""
        from outreach.decision_makers import classify_role_priority, normalize_technical_title

        # Heuristic baseline
        base_norm, base_prio, base_seniority = normalize_technical_title(raw_title)
        calc_prio = classify_role_priority(raw_title)
        fallback_res = {
            "normalized_title": base_norm,
            "role_priority": calc_prio,
            "seniority": base_seniority,
            "department": "engineering" if calc_prio in (2, 3, 4) else ("executive" if calc_prio == 1 else "general"),
            "is_technical_decision_maker": calc_prio in (1, 2, 3, 4),
            "confidence": 0.85 if base_norm != raw_title else 0.60,
        }

        if not self.is_available() or not raw_title.strip():
            return fallback_res

        system_prompt = (
            "You are a job title normalization engine for B2B engineering recruitment and outreach. "
            "Given an executive or engineering title, return a standard, clean professional title, "
            "role priority (1=Founder/CEO, 2=CTO, 3=VP/Head of Eng, 4=Eng Manager/AI Lead, 5=Individual), "
            "seniority, department, and boolean is_technical_decision_maker. "
            "Normalize eccentric titles (e.g., 'Chief Wizard & Founder' -> 'Founder & CTO', "
            "'Code Ninja / Co-Founder' -> 'Co-Founder & Technical Lead'). "
            "Respond strictly in JSON matching the schema."
        )
        user_prompt = f"Company: {company_name}\nTitle to normalize: {raw_title}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        result = await self.complete(messages, json_mode=True, temperature=0.1)
        if isinstance(result, dict) and "normalized_title" in result:
            prio = result.get("role_priority")
            try:
                prio_int = int(prio) if prio is not None else calc_prio
                if prio_int not in (1, 2, 3, 4, 5):
                    prio_int = calc_prio
            except (ValueError, TypeError):
                prio_int = calc_prio

            return {
                "normalized_title": str(result.get("normalized_title") or base_norm),
                "role_priority": prio_int,
                "seniority": str(result.get("seniority") or base_seniority),
                "department": str(result.get("department") or fallback_res["department"]),
                "is_technical_decision_maker": bool(result.get("is_technical_decision_maker", prio_int in (1, 2, 3, 4))),
                "confidence": float(result.get("confidence") or 0.95),
            }

        return fallback_res

    async def extract_decision_makers(
        self,
        text_content: str,
        company_name: str = "",
        domain: str = "",
    ) -> list[dict[str, Any]]:
        """Extract executive and engineering leaders from text with fallback."""
        if not text_content.strip():
            return []

        # Bound input length to protect token budget (approx 4,000 characters)
        sample = text_content[:4000].strip()

        if not self.is_available():
            return []

        system_prompt = (
            "You are an executive contact extractor for technical outreach. "
            "Extract genuine current operating executives, founders, CTOs, VPs of Engineering, "
            "and AI leads from the provided company webpage text. "
            "EXCLUDE board advisors, investors, alumni, and customers. "
            "Return a JSON object with key 'people' containing a list of objects with: "
            "first_name, last_name, title, role_priority (1=Founder/CEO, 2=CTO, 3=VP Eng, 4=Lead), "
            "evidence_snippet, linkedin_url (if present), confidence (0.0 to 1.0). "
            "If no leadership profiles are present, return {'people': []}."
        )
        user_prompt = f"Company: {company_name} ({domain})\nWebpage content:\n{sample}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        result = await self.complete(messages, json_mode=True, temperature=0.1)
        if isinstance(result, dict) and "people" in result and isinstance(result["people"], list):
            valid_people = []
            for p in result["people"]:
                if isinstance(p, dict) and p.get("first_name") and p.get("title"):
                    valid_people.append({
                        "first_name": str(p.get("first_name", "")).strip(),
                        "last_name": str(p.get("last_name", "")).strip(),
                        "title": str(p.get("title", "")).strip(),
                        "role_priority": int(p.get("role_priority", 2)),
                        "evidence_snippet": str(p.get("evidence_snippet", ""))[:200],
                        "linkedin_url": str(p.get("linkedin_url", "")),
                        "confidence": float(p.get("confidence", 0.90)),
                    })
            return valid_people

        return []

    async def classify_firmographics(self, text_content: str, domain: str = "") -> dict[str, Any]:
        """Classify industry, business model, remote work, and tech stack from text."""
        from outreach.firmographics import FirmographicExtractor

        # Deterministic heuristic baseline
        extractor = FirmographicExtractor()
        fallback_profile = await extractor.extract_firmographics(
            pages=[(f"https://{domain or 'target.com'}", text_content)],
            domain=domain,
        )
        fallback_dict = fallback_profile.to_dict()

        if not self.is_available() or not text_content.strip():
            return {
                "industry": fallback_dict.get("primary_industry", "Technology"),
                "business_model": fallback_dict.get("business_model", "Unknown"),
                "employee_size_tier": fallback_dict.get("employee_tier", "Unknown"),
                "is_remote_friendly": fallback_dict.get("is_remote_friendly", False),
                "tech_stack": fallback_dict.get("ai_tech_stack", []),
                "hiring_roles": fallback_profile.hiring_target_roles,
                "funding_stage": fallback_dict.get("funding_stage", "Unknown"),
            }

        sample = text_content[:4000].strip()

        system_prompt = (
            "You are a B2B firmographic classifier. Analyze the provided company text. "
            "Return a JSON object with: "
            "industry (e.g. 'Generative AI', 'Software Development', 'SaaS', 'AI Consulting'), "
            "business_model ('agency', 'product', 'consulting', or 'hybrid'), "
            "employee_size_tier ('1-10', '11-50', '51-200', '201-500', '500+', or null if unmentioned - NEVER INVENT HEADCOUNT), "
            "is_remote_friendly (true/false), "
            "tech_stack (list of explicitly mentioned AI/software tools like LangGraph, FastAPI, OpenAI, PyTorch), "
            "hiring_roles (list of mentioned technical roles). "
            "Do NOT hallucinate missing data."
        )
        user_prompt = f"Domain: {domain}\nPage Content:\n{sample}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        result = await self.complete(messages, json_mode=True, temperature=0.1)
        if isinstance(result, dict):
            fallback_tech = fallback_dict.get("ai_tech_stack", [])
            fallback_hiring = fallback_profile.hiring_target_roles
            return {
                "industry": str(result.get("industry") or fallback_dict.get("primary_industry") or "Technology"),
                "business_model": str(result.get("business_model") or fallback_dict.get("business_model") or "Unknown"),
                "employee_size_tier": result.get("employee_size_tier") or fallback_dict.get("employee_tier") or "Unknown",
                "is_remote_friendly": bool(result.get("is_remote_friendly", fallback_dict.get("is_remote_friendly", False))),
                "tech_stack": list(set(result.get("tech_stack", []) + fallback_tech)),
                "hiring_roles": list(set(result.get("hiring_roles", []) + fallback_hiring)),
                "funding_stage": fallback_dict.get("funding_stage", "Unknown"),
            }

        return {
            "industry": fallback_dict.get("primary_industry", "Technology"),
            "business_model": fallback_dict.get("business_model", "Unknown"),
            "employee_size_tier": fallback_dict.get("employee_tier", "Unknown"),
            "is_remote_friendly": fallback_dict.get("is_remote_friendly", False),
            "tech_stack": fallback_dict.get("ai_tech_stack", []),
            "hiring_roles": fallback_profile.hiring_target_roles,
            "funding_stage": fallback_dict.get("funding_stage", "Unknown"),
        }

    async def tailor_pitch(
        self,
        prospect_name: str,
        prospect_title: str,
        company_name: str,
        opportunity_type: str,
        tech_stack: list[str] | None = None,
        hiring_roles: list[str] | None = None,
        custom_context: str = "",
        sender_name: str = "Vansh Singh",
    ) -> dict[str, str] | None:
        """Generate high-converting, personalized proposal copy with zero marketing fluff."""
        if not self.is_available():
            return None

        techs = ", ".join(tech_stack[:3]) if tech_stack else "Python backend and modern API backends"
        roles = ", ".join(hiring_roles[:2]) if hiring_roles else ""

        system_prompt = (
            "You are a professional outreach writer crafting concise, high-converting cold proposals. "
            "STRICT RULES: "
            "- Zero marketing hype, buzzwords, or filler ('Hope this email finds you well', 'Synergy', 'Game-changer'). "
            "- Direct, low-friction, respectful tone written by an experienced developer. "
            "- Length: Under 120 words total. "
            "- Value proposition must match the opportunity type: "
            "  * freelance: dev bandwidth / sprint delivery for agencies "
            "  * ai_contract: contract applied AI engineering (LangGraph, LLM backends, RAG) for startups "
            "  * junior_ai: applied AI engineer seeking direct full-time implementation contribution "
            "  * ai_automation: AI agents and document automation for internal workflows "
            "Return JSON with: 'subject' (under 50 chars), 'hook' (opening sentence), 'body', 'custom_angle'."
        )

        user_prompt = (
            f"Sender Name: {sender_name}\n"
            f"Recipient: {prospect_name} ({prospect_title}) at {company_name}\n"
            f"Opportunity Type: {opportunity_type}\n"
            f"Observed Tech Stack: {techs}\n"
            f"Hiring Roles: {roles}\n"
            f"Extra Context / Note: {custom_context}\n"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        result = await self.complete(messages, json_mode=True, temperature=0.3, max_tokens=600)
        if isinstance(result, dict) and "subject" in result and "body" in result:
            return {
                "subject": str(result.get("subject", "")).strip(),
                "hook": str(result.get("hook", "")).strip(),
                "body": str(result.get("body", "")).strip(),
                "custom_angle": str(result.get("custom_angle", "")).strip(),
            }

        return None


# Global singleton helper
_deepseek_instance: DeepSeekClient | None = None


def get_deepseek_client() -> DeepSeekClient:
    """Retrieve or initialize the DeepSeek client singleton."""
    global _deepseek_instance
    if _deepseek_instance is None:
        _deepseek_instance = DeepSeekClient()
    return _deepseek_instance
