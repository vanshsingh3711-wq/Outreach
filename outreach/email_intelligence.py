"""Person-specific email discovery and deliverability verification with dual scoring.

Maintains two strictly independent confidence scores:
1. Person-to-Email Match Confidence (0.0 to 1.0): How strongly evidence ties this person to this mailbox.
2. Email Deliverability Status: Technical mailbox validity (verified / risky / invalid / unknown / guess).

Never attributes generic role mailboxes (info@, sales@, support@) as an individual's personal email.
Never marks an email as verified via LLM guesswork or MX lookup alone.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from outreach.integrations.email_finder import (
    DEFAULT_PATTERN,
    PATTERN_BUILDERS,
    ROLE_LOCALS,
    build_email,
    classify_mx,
    derive_pattern,
    get_mx_host,
    infer_pattern_from_email,
    verify_hunter,
    verify_reoon,
    verify_zerobounce,
    verify_email_smtp,
)
from outreach.models.prospect import Prospect
from outreach.state import StateManager

logger = logging.getLogger("outreach.email_intelligence")

# Match confidence constants based on empirical evidence hierarchy
CONFIDENCE_DIRECT_PUBLISHED = 1.0     # Published directly alongside person's name
CONFIDENCE_COMPANY_PATTERN = 0.85     # Proven pattern derived from verified staff
CONFIDENCE_EXTERNAL_DISCOVERY = 0.70  # Third-party discovery API
CONFIDENCE_PATTERN_GUESS = 0.40       # Default fallback pattern guess
CONFIDENCE_ROLE_ADDRESS = 0.0         # General mailbox (never a personal email)


@dataclass
class EmailCandidate:
    """A candidate email address for a specific person with dual-confidence scoring."""
    email: str
    first_name: str
    last_name: str
    domain: str
    match_confidence: float               # 0.0 to 1.0 (Identity match)
    deliverability_status: str = "guess"  # verified, risky, invalid, unknown, guess
    discovery_method: str = "pattern_guess" # direct_published, company_pattern, external_provider, pattern_guess
    pattern: str = ""
    verification_provider: str = "none"   # reoon, zerobounce, hunter, smtp, none
    source_url: str = ""
    verified_at: Optional[datetime] = None

    @property
    def is_verified(self) -> bool:
        return self.deliverability_status == "verified"

    @property
    def is_sendable(self) -> bool:
        """Deliverable and tied to the person with reasonable match confidence."""
        return self.deliverability_status in ("verified", "risky") and self.match_confidence >= 0.60


def is_role_mailbox(email: str) -> bool:
    """True if email is a generic company inbox (info@, support@, sales@, etc.)."""
    local = (email or "").partition("@")[0].lower().strip()
    return local in ROLE_LOCALS


class EmailIntelligenceService:
    """Discovers, generates, and verifies person-specific emails with dual scoring."""

    def __init__(self, state: StateManager | None = None, env: Any = None):
        self.state = state
        self.env = env
        # Local verification cache: (email.lower()) -> (status, provider, timestamp)
        self._cache: dict[str, tuple[str, str, datetime]] = {}

    async def verify_candidate(
        self, candidate: EmailCandidate, mx_type: str = ""
    ) -> EmailCandidate:
        """Verify deliverability through configured providers without hallucinating verification."""
        email = candidate.email.strip().lower()
        if not email or "@" not in email:
            candidate.deliverability_status = "invalid"
            return candidate

        # Check in-memory cache
        if email in self._cache:
            status, provider, ts = self._cache[email]
            candidate.deliverability_status = status
            candidate.verification_provider = provider
            candidate.verified_at = ts
            return candidate

        if self.env is None:
            try:
                from outreach.config import load_env
                self.env = load_env()
            except Exception:
                pass

        env_dict = self.env.model_dump() if hasattr(self.env, "model_dump") else (self.env or {})

        # Priority 1: Reoon
        reoon_key = (
            env_dict.get("reoon_api_key")
            or env_dict.get("REOON_API_KEY")
            or os.environ.get("REOON_API_KEY", "")
        )
        if reoon_key:
            try:
                res = await verify_reoon(email, reoon_key)
                if res and res.get("status"):
                    candidate.deliverability_status = res["status"]
                    candidate.verification_provider = "reoon"
                    candidate.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    self._cache[email] = (
                        candidate.deliverability_status,
                        candidate.verification_provider,
                        candidate.verified_at,
                    )
                    return candidate
            except Exception as exc:
                logger.debug("Reoon check failed for %s: %s", email, exc)

        # Priority 2: ZeroBounce
        zb_key = (
            env_dict.get("zerobounce_api_key")
            or env_dict.get("ZEROBOUNCE_API_KEY")
            or os.environ.get("ZEROBOUNCE_API_KEY", "")
        )
        if zb_key:
            try:
                res = await verify_zerobounce(email, zb_key)
                if res and res.get("status"):
                    candidate.deliverability_status = res["status"]
                    candidate.verification_provider = "zerobounce"
                    candidate.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    self._cache[email] = (
                        candidate.deliverability_status,
                        candidate.verification_provider,
                        candidate.verified_at,
                    )
                    return candidate
            except Exception as exc:
                logger.debug("ZeroBounce check failed for %s: %s", email, exc)

        # Priority 3: Hunter
        hunter_key = (
            env_dict.get("hunter_api_key")
            or env_dict.get("HUNTER_API_KEY")
            or os.environ.get("HUNTER_API_KEY", "")
        )
        if hunter_key:
            try:
                res = await verify_hunter(email, hunter_key)
                if res and res.get("status"):
                    candidate.deliverability_status = res["status"]
                    candidate.verification_provider = "hunter"
                    candidate.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    self._cache[email] = (
                        candidate.deliverability_status,
                        candidate.verification_provider,
                        candidate.verified_at,
                    )
                    return candidate
            except Exception as exc:
                logger.debug("Hunter check failed for %s: %s", email, exc)

        # Priority 4: SMTP check for self-hosted mail servers (never against Google / Microsoft)
        if mx_type not in ("google", "microsoft"):
            try:
                smtp_ok = await verify_email_smtp(email)
                if smtp_ok is True:
                    candidate.deliverability_status = "verified"
                    candidate.verification_provider = "smtp"
                elif smtp_ok is False:
                    candidate.deliverability_status = "invalid"
                    candidate.verification_provider = "smtp"
                else:
                    candidate.deliverability_status = "guess"
                    candidate.verification_provider = "none"
                candidate.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
                self._cache[email] = (
                    candidate.deliverability_status,
                    candidate.verification_provider,
                    candidate.verified_at,
                )
                return candidate
            except Exception as exc:
                logger.debug("SMTP verification failed for %s: %s", email, exc)

        # If no verifier is active, email remains an honest "guess"
        candidate.deliverability_status = "guess"
        candidate.verification_provider = "none"
        candidate.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
        return candidate

    async def discover_candidates_for_person(
        self,
        first_name: str,
        last_name: str,
        domain: str,
        published_emails: list[str] | None = None,
        known_staff: list[tuple[str, str, str]] | None = None,
        source_url: str = "",
        verify: bool = True,
    ) -> list[EmailCandidate]:
        """Generate, match-score, and verify candidate email addresses for a person."""
        clean_first = re.sub(r"[^a-zA-Z]", "", first_name or "").lower()
        clean_last = re.sub(r"[^a-zA-Z]", "", last_name or "").lower()
        clean_domain = domain.lower().removeprefix("www.").strip()

        if not clean_first or not clean_last or not clean_domain:
            return []

        # Classify MX
        mx_host = await get_mx_host(clean_domain)
        mx_type = classify_mx(mx_host or "")

        print(f"  [✉️ EMAIL INTELLIGENCE] Synthesizing address for {first_name} {last_name} (@{clean_domain})...", flush=True)
        print(f"    ↳ MX Host: {mx_host or 'None'} | MX Type: {mx_type}", flush=True)

        candidates: list[EmailCandidate] = []
        seen_emails: set[str] = set()

        # 1. Check if an address was published directly for this person
        if published_emails:
            for pub in published_emails:
                pub_clean = pub.strip().lower()
                if is_role_mailbox(pub_clean):
                    continue  # Strict anti-assignment guard
                # Check if published address matches person's name tokens
                local = pub_clean.partition("@")[0]
                if clean_first in local or (clean_last in local and len(clean_last) >= 3):
                    cand = EmailCandidate(
                        email=pub_clean,
                        first_name=first_name,
                        last_name=last_name,
                        domain=clean_domain,
                        match_confidence=CONFIDENCE_DIRECT_PUBLISHED,
                        discovery_method="direct_published",
                        source_url=source_url,
                    )
                    candidates.append(cand)
                    seen_emails.add(pub_clean)
                    print(f"    ↳ Found direct published address on website: {pub_clean}", flush=True)

        # 2. Derive company pattern from known staff or database
        pattern, pattern_source, _ = await derive_pattern(
            clean_domain,
            known_emails=known_staff,
            state=self.state,
            default_pattern=DEFAULT_PATTERN,
        )
        print(f"    ↳ Derived domain email pattern: '{pattern}' (source: {pattern_source})", flush=True)

        has_proven_pattern = pattern_source not in ("default", "default_after_hunter")

        # 3. Generate primary candidate from derived pattern
        primary_email = build_email(pattern, clean_first, clean_last, clean_domain)
        if primary_email and primary_email not in seen_emails and not is_role_mailbox(primary_email):
            cand = EmailCandidate(
                email=primary_email,
                first_name=first_name,
                last_name=last_name,
                domain=clean_domain,
                match_confidence=CONFIDENCE_COMPANY_PATTERN if has_proven_pattern else CONFIDENCE_PATTERN_GUESS,
                discovery_method="company_pattern" if has_proven_pattern else "pattern_guess",
                pattern=pattern,
                source_url=source_url,
            )
            candidates.append(cand)
            seen_emails.add(primary_email)

        # 4. Generate secondary common pattern candidates
        common_patterns = ["{f}.{l}", "{fi}{l}", "{f}"]
        for p in common_patterns:
            if p == pattern:
                continue
            alt_email = build_email(p, clean_first, clean_last, clean_domain)
            if alt_email and alt_email not in seen_emails and not is_role_mailbox(alt_email):
                cand = EmailCandidate(
                    email=alt_email,
                    first_name=first_name,
                    last_name=last_name,
                    domain=clean_domain,
                    match_confidence=CONFIDENCE_PATTERN_GUESS,
                    discovery_method="pattern_guess",
                    pattern=p,
                    source_url=source_url,
                )
                candidates.append(cand)
                seen_emails.add(alt_email)

        # 5. Verify candidates if requested
        if verify and mx_host:
            for cand in candidates:
                await self.verify_candidate(cand, mx_type=mx_type)
        elif not mx_host:
            for cand in candidates:
                cand.deliverability_status = "invalid"

        # Sort candidates: deliverability (verified first), then match confidence descending
        status_rank = {"verified": 1, "risky": 2, "guess": 3, "unknown": 4, "invalid": 5}
        candidates.sort(key=lambda c: (status_rank.get(c.deliverability_status, 4), -c.match_confidence))

        if candidates:
            best = candidates[0]
            print(f"    ↳ Primary Candidate: {best.email} | Status: {best.deliverability_status} | Method: {best.discovery_method} | Conf: {best.match_confidence:.2f}", flush=True)
        else:
            print(f"    ↳ ⚠️ No candidate address generated for {first_name} {last_name}", flush=True)

        return candidates
