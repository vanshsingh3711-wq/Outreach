"""Tests for person-specific email discovery, dual-scoring confidence, and deliverability verification."""

import pytest

from outreach.email_intelligence import (
    CONFIDENCE_COMPANY_PATTERN,
    CONFIDENCE_DIRECT_PUBLISHED,
    CONFIDENCE_PATTERN_GUESS,
    CONFIDENCE_ROLE_ADDRESS,
    EmailCandidate,
    EmailIntelligenceService,
    is_role_mailbox,
)


def test_is_role_mailbox_guard():
    # Role mailboxes must be recognized and guarded
    for role in (
        "info@acme.com",
        "support@acme.com",
        "contact@acme.com",
        "sales@acme.com",
        "careers@acme.com",
        "jobs@acme.com",
        "billing@acme.com",
        "help@acme.com",
        "admin@acme.com",
        "team@acme.com",
    ):
        assert is_role_mailbox(role) is True, f"Expected {role} to be recognized as role mailbox"

    # Personal mailboxes must not be flagged as role mailboxes
    for personal in (
        "john.doe@acme.com",
        "sarah@acme.com",
        "m.smith@acme.com",
        "davidk@acme.com",
    ):
        assert is_role_mailbox(personal) is False, f"Expected {personal} to be personal"


@pytest.mark.asyncio
async def test_direct_published_email_confidence():
    service = EmailIntelligenceService()
    published = ["sarah.connor@cyberdyne.ai", "info@cyberdyne.ai"]

    candidates = await service.discover_candidates_for_person(
        first_name="Sarah",
        last_name="Connor",
        domain="cyberdyne.ai",
        published_emails=published,
        verify=False,
    )

    assert len(candidates) >= 1
    # First candidate should be the directly published email
    direct = next(c for c in candidates if c.email == "sarah.connor@cyberdyne.ai")
    assert direct.match_confidence == CONFIDENCE_DIRECT_PUBLISHED
    assert direct.discovery_method == "direct_published"

    # Generic info@ address must NEVER be assigned to Sarah Connor
    assert not any(c.email == "info@cyberdyne.ai" for c in candidates)


@pytest.mark.asyncio
async def test_company_pattern_derived_confidence():
    service = EmailIntelligenceService()
    # Known staff proves pattern is {f}.{l}
    known_staff = [
        ("jane.doe@techcorp.io", "Jane", "Doe"),
        ("michael.smith@techcorp.io", "Michael", "Smith"),
    ]

    candidates = await service.discover_candidates_for_person(
        first_name="David",
        last_name="Kim",
        domain="techcorp.io",
        known_staff=known_staff,
        verify=False,
    )

    assert len(candidates) >= 1
    primary = candidates[0]
    assert primary.email == "david.kim@techcorp.io"
    assert primary.match_confidence == CONFIDENCE_COMPANY_PATTERN
    assert primary.discovery_method == "company_pattern"


@pytest.mark.asyncio
async def test_fallback_guess_confidence():
    service = EmailIntelligenceService()
    # No known staff or published emails
    candidates = await service.discover_candidates_for_person(
        first_name="Alex",
        last_name="Rivera",
        domain="newstartup.dev",
        verify=False,
    )

    assert len(candidates) >= 1
    for c in candidates:
        assert c.match_confidence == CONFIDENCE_PATTERN_GUESS
        assert c.discovery_method == "pattern_guess"


@pytest.mark.asyncio
async def test_dual_score_independence(monkeypatch):
    """Verify that identity match confidence and deliverability status remain independent."""
    service = EmailIntelligenceService()

    # Case A: High identity confidence (1.0), but deliverability is invalid/bounced
    cand_direct = EmailCandidate(
        email="elena@ancientfirm.com",
        first_name="Elena",
        last_name="Rostova",
        domain="ancientfirm.com",
        match_confidence=CONFIDENCE_DIRECT_PUBLISHED,  # 1.0
        deliverability_status="invalid",
    )
    assert cand_direct.match_confidence == 1.0
    assert cand_direct.deliverability_status == "invalid"
    assert cand_direct.is_sendable is False  # Cannot send invalid email even if identity match is 100%

    # Case B: Low identity confidence (0.40 guess), but deliverability is verified via provider
    cand_guess = EmailCandidate(
        email="john@cloudhost.com",
        first_name="John",
        last_name="Doe",
        domain="cloudhost.com",
        match_confidence=CONFIDENCE_PATTERN_GUESS,  # 0.40
        deliverability_status="verified",
    )
    assert cand_guess.match_confidence == 0.40
    assert cand_guess.deliverability_status == "verified"
    # Even though mailbox exists, identity match is low, so not sendable under strict safety
    assert cand_guess.is_sendable is False


@pytest.mark.asyncio
async def test_verification_caching(monkeypatch):
    service = EmailIntelligenceService(env={"REOON_API_KEY": "dummy_key"})

    call_count = 0

    async def mock_reoon(email, key):
        nonlocal call_count
        call_count += 1
        return {"status": "verified"}

    import outreach.email_intelligence as mod
    monkeypatch.setattr(mod, "verify_reoon", mock_reoon)

    cand1 = EmailCandidate(
        email="test@verifieddomain.com",
        first_name="Test",
        last_name="User",
        domain="verifieddomain.com",
        match_confidence=0.85,
    )

    # First lookup calls Reoon
    res1 = await service.verify_candidate(cand1, mx_type="google")
    assert res1.deliverability_status == "verified"
    assert res1.verification_provider == "reoon"
    assert call_count == 1

    # Second lookup for same address must use cache and avoid calling Reoon again
    cand2 = EmailCandidate(
        email="test@verifieddomain.com",
        first_name="Test",
        last_name="User",
        domain="verifieddomain.com",
        match_confidence=0.85,
    )
    res2 = await service.verify_candidate(cand2, mx_type="google")
    assert res2.deliverability_status == "verified"
    assert call_count == 1  # No second API call!
