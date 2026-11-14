"""End-to-End Hardening & Integration Test Suite for Outreacho AI Prospecting.

Verifies the complete pipeline from discovery to outbox queueing:
1. Filtered Company Discovery Engine (`FilteredDiscoveryEngine`)
2. SSRF-defended Single-Company URL Enrichment (`CompanyEnricher`)
3. Technical Decision-Maker Extraction & Role Prioritization (`DecisionMakerExtractor`)
4. Dual-Scoring Email Intelligence (`EmailIntelligenceService`)
5. Proposal Generation across 4 Opportunity Profiles (`ProposalGenerator`)
6. Optional DeepSeek AI Enhancement with Graceful Fallback
7. Strict Safety Gates (Zero-automated sends, outbox approval ladder)
"""

import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from sellbird.discovery_engine import DiscoveryCriteria, FilteredDiscoveryEngine, DiscoveryQueryBuilder
from sellbird.enrichment import CompanyEnricher, SSRFValidationError, validate_and_normalize_url
from sellbird.decision_makers import DecisionMakerExtractor, classify_role_priority
from sellbird.email_intelligence import EmailCandidate, EmailIntelligenceService
from sellbird.proposal_generator import ProposalGenerator
from sellbird.deepseek import DeepSeekClient, DeepSeekConfig
from sellbird.state import StateManager


MOCK_HOME_HTML = """
<!DOCTYPE html>
<html>
<head><title>Agentic Solutions — Enterprise AI Workflows</title></head>
<body>
  <h1>Building Production AI Agents & RAG Backends</h1>
  <p>We are a custom software development agency helping our clients automate complex workflows using LangGraph, FastAPI, and OpenAI. Review our case studies.</p>
  <p>We are actively hiring an Applied AI Engineer to join our team.</p>
  <a href="/about">About Us</a>
  <a href="/team">Leadership Team</a>
  <a href="/careers">Careers</a>
</body>
</html>
"""

MOCK_ABOUT_HTML = """
<!DOCTYPE html>
<html>
<body>
  <h2>About Agentic Solutions</h2>
  <p>Founded in 2023, our 15-person distributed engineering team builds robust AI architectures.</p>
  <p>We are fully remote across the United States and Europe.</p>
</body>
</html>
"""

MOCK_TEAM_HTML = """
<!DOCTYPE html>
<html>
<body>
  <h2>Our Leadership</h2>
  <div class="member">
    <h3>Dr. Evelyn Reed</h3>
    <p class="role">Co-Founder & Chief Technology Officer</p>
    <p class="bio">Evelyn oversees AI backend engineering and LangGraph multi-agent research.</p>
    <a href="https://linkedin.com/in/evelyn-reed-phd">LinkedIn</a>
    <a href="https://x.com/evelyn_ai">𝕏</a>
  </div>
  <div class="member">
    <h3>Jordan Hayes</h3>
    <p class="role">Founder & CEO</p>
    <p class="bio">Jordan drives company strategy and enterprise client partnerships.</p>
    <a href="https://linkedin.com/in/jordan-hayes-ai">LinkedIn</a>
  </div>
  <div class="advisor">
    <h3>Arthur Pendelton</h3>
    <p class="role">Board Advisor & Angel Investor</p>
  </div>
</body>
</html>
"""

MOCK_CAREERS_HTML = """
<!DOCTYPE html>
<html>
<body>
  <h2>Join Our Team</h2>
  <div class="job">
    <h3>Applied AI Engineer</h3>
    <p>We are hiring an Applied AI Engineer with deep experience in Python, LangGraph, and Qdrant.</p>
  </div>
</body>
</html>
"""


@pytest.mark.asyncio
async def test_ssrf_defense_hardening():
    """Verify SSRF validation strictly blocks dangerous internal and loopback destinations."""
    blocked_urls = [
        "http://localhost:8080/admin",
        "http://127.0.0.1:5555/api",
        "http://127.0.0.2/secret",
        "http://0.0.0.0/",
        "http://10.0.0.1/internal",
        "http://172.16.0.5/admin",
        "http://192.168.1.1/router",
        "http://169.254.169.254/latest/meta-data/",
        "file:///etc/passwd",
        "ftp://example.com/file",
        "gopher://evil.com/",
    ]
    for url in blocked_urls:
        with pytest.raises(SSRFValidationError):
            validate_and_normalize_url(url)

    # Valid public destinations must pass validation
    canonical, domain = validate_and_normalize_url("https://agentic-solutions.io")
    assert "agentic-solutions.io" in canonical
    assert domain == "agentic-solutions.io"

    canonical2, domain2 = validate_and_normalize_url("http://github.com/sellbird")
    assert "github.com" in canonical2
    assert domain2 == "github.com"


@pytest.mark.asyncio
async def test_full_prospecting_pipeline_end_to_end(tmp_path, monkeypatch):
    """End-to-end integration test from URL crawl to decision-makers, email scoring, and outbox."""
    domain = "agentic-solutions.io"
    base_url = f"https://{domain}"

    # Initialize isolated test database
    db_file = tmp_path / "test_e2e.db"
    state = StateManager(db_path=str(db_file))
    await state.init_db()

    # 1. Mock safe fetching across pages
    async def mock_safe_fetch(client, url):
        u = str(url).rstrip("/")
        if u.endswith("/about"):
            return MOCK_ABOUT_HTML
        elif u.endswith("/team"):
            return MOCK_TEAM_HTML
        elif u.endswith("/careers"):
            return MOCK_CAREERS_HTML
        elif u in (base_url, base_url.rstrip("/")):
            return MOCK_HOME_HTML
        return ""

    # 2. Mock Email Finding & Verification
    async def mock_discover_candidates(self, first_name, last_name, domain, published_emails=None, source_url="", verify=True):
        email = f"{first_name.lower()}.{last_name.lower()}@{domain}"
        return [
            EmailCandidate(
                email=email,
                first_name=first_name,
                last_name=last_name,
                domain=domain,
                match_confidence=0.95,
                deliverability_status="verified",
                discovery_method="pattern_derivation",
                verification_provider="smtp",
            )
        ]

    enricher = CompanyEnricher(state)
    monkeypatch.setattr(enricher, "_safe_fetch", mock_safe_fetch)
    monkeypatch.setattr(EmailIntelligenceService, "discover_candidates_for_person", mock_discover_candidates)

    result = await enricher.enrich_url(base_url)

    # Verify Enrichment Result
    assert not result.error
    assert result.company.domain == domain
    assert result.company.name == "Agentic Solutions"

    # Verify Firmographics
    firmo = result.firmographics
    assert "Generative AI" in firmo["primary_industry"] or "Artificial Intelligence" in firmo["primary_industry"]
    assert firmo["business_model"] == "agency"
    assert firmo["is_remote_friendly"] is True
    assert "LangGraph" in firmo["ai_tech_stack"]
    assert "Applied AI Engineer" in firmo["hiring_target_roles"]

    # Verify Decision-Makers
    assert len(result.people) >= 2
    cto = next((p for p in result.people if "CTO" in p.title or "Chief Technology Officer" in p.title), None)
    ceo = next((p for p in result.people if "CEO" in p.title or "Founder" in p.title), None)
    advisor = next((p for p in result.people if "Advisor" in p.title), None)

    assert cto is not None
    assert cto.first_name == "Evelyn"
    assert cto.last_name == "Reed"
    assert cto.role_priority in (1, 2)
    assert cto.primary_email == "evelyn.reed@agentic-solutions.io"
    assert cto.email_status == "verified"
    assert cto.email_match_confidence >= 0.85
    assert cto.linkedin_url == "https://www.linkedin.com/in/evelyn-reed-phd"
    assert cto.twitter_url == "https://x.com/evelyn_ai"

    assert ceo is not None
    assert ceo.first_name == "Jordan"
    assert ceo.last_name == "Hayes"

    # Non-operating board advisors must be excluded
    assert advisor is None

    # Verify prospects were written to the database
    prospects = await state.get_contacts_for_company(result.company.id)
    assert len(prospects) >= 2
    evelyn_p = next(p for p in prospects if p.first_name == "Evelyn")
    assert evelyn_p.email == "evelyn.reed@agentic-solutions.io"
    assert evelyn_p.email_status == "verified"
    assert evelyn_p.status == "new"

    # 3. Test Proposal Drafting across all 4 Opportunity Profiles
    for opp in ("freelance", "ai_contract", "junior_ai", "ai_automation"):
        draft = ProposalGenerator.generate_draft(
            first_name=evelyn_p.first_name,
            last_name=evelyn_p.last_name,
            title=evelyn_p.title,
            company="Agentic Solutions",
            domain=domain,
            opportunity_type=opp,
            tech_stack=firmo["ai_tech_stack"],
            hiring_roles=firmo["hiring_target_roles"],
        )
        assert "Evelyn" in draft.body
        assert "Agentic Solutions" in draft.subject or "Agentic Solutions" in draft.body
        # Strict anti-fluff verification
        assert "hope this finds you well" not in draft.body.lower()
        assert "synergy" not in draft.body.lower()
        assert "game changer" not in draft.body.lower()

    # 4. Strict Safety Gate: Zero Automated Sends Verification
    # Initial outbox must be completely empty
    initial_outbox = await state.get_outbox()
    assert len(initial_outbox) == 0

    # Create reviewed proposal
    ai_contract_draft = ProposalGenerator.generate_draft(
        first_name=evelyn_p.first_name,
        last_name=evelyn_p.last_name,
        title=evelyn_p.title,
        company="Agentic Solutions",
        domain=domain,
        opportunity_type="ai_contract",
        tech_stack=firmo["ai_tech_stack"],
    )

    # Human Review Gate: user approves draft to outbox
    outbox_id = await state.add_outbox_item(
        prospect_id=evelyn_p.id,
        to_email=evelyn_p.email,
        subject=ai_contract_draft.subject,
        body=ai_contract_draft.body,
        send_at="2026-11-14T12:00:00Z",
        status="pending_review",
        kind="prospecting",
    )
    assert outbox_id is not None

    # Verify draft is in outbox under pending_review
    pending = await state.get_outbox(status="pending_review")
    assert len(pending) == 1
    assert pending[0]["id"] == outbox_id
    assert pending[0]["status"] == "pending_review"
    assert pending[0]["to_email"] == "evelyn.reed@agentic-solutions.io"

    # Automated sender agents MUST NOT send pending_review items
    # (Only status='approved' can be claimed/sent)
    approved_before = await state.get_outbox(status="approved")
    assert len(approved_before) == 0

    # Human explicitly approves proposal
    approved_count = await state.approve_outbox(outbox_id)
    assert approved_count == 1

    # Now it transitions to approved
    item = await state.get_outbox_item(outbox_id)
    assert item["status"] == "approved"
    assert item["approved_by"] == "you"

    # Now it is available in approved outbox
    approved_after = await state.get_outbox(status="approved")
    assert len(approved_after) == 1
    assert approved_after[0]["id"] == outbox_id


@pytest.mark.asyncio
async def test_deepseek_integration_with_proposal_generator_e2e():
    """Verify DeepSeek client enhances proposal drafts with graceful fallback on failure."""
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-test-key"))

    mock_ai_response = {
        "subject": "LangGraph multi-agent engineering for Agentic Solutions",
        "hook": "Saw Evelyn's focus on enterprise LangGraph workflows.",
        "body": "Hi Evelyn,\n\nReaching out regarding your LangGraph multi-agent pipelines.",
        "custom_angle": "LangGraph expertise",
    }

    with patch("sellbird.deepseek.get_deepseek_client", return_value=client):
        # 1. Test when DeepSeek API succeeds
        with patch.object(client, "tailor_pitch", new_callable=AsyncMock) as mock_tailor:
            mock_tailor.return_value = mock_ai_response
            draft = await ProposalGenerator.generate_draft_async(
                first_name="Evelyn",
                title="CTO",
                company="Agentic Solutions",
                opportunity_type="ai_contract",
                tech_stack=["LangGraph"],
                use_ai=True,
            )
            assert draft.subject == "LangGraph multi-agent engineering for Agentic Solutions"
            assert "LangGraph" in draft.body

        # 2. Test when DeepSeek API fails or times out
        with patch.object(client, "tailor_pitch", new_callable=AsyncMock) as mock_tailor:
            mock_tailor.return_value = None  # API timeout / failure
            draft_fallback = await ProposalGenerator.generate_draft_async(
                first_name="Evelyn",
                title="CTO",
                company="Agentic Solutions",
                opportunity_type="ai_contract",
                tech_stack=["LangGraph"],
                use_ai=True,
            )
            # Deterministic template takes over smoothly
            assert "Agentic Solutions" in draft_fallback.company_name
            assert "Evelyn" in draft_fallback.body
            assert "contract applied AI engineering" in draft_fallback.body


@pytest.mark.asyncio
async def test_filtered_discovery_engine_e2e(tmp_path, monkeypatch):
    """Verify Filtered Company Discovery Engine builds queries, queries providers, deduplicates, and persists."""
    db_file = tmp_path / "test_discovery_e2e.db"
    state = StateManager(db_path=str(db_file))
    await state.init_db()

    engine = FilteredDiscoveryEngine(state)

    criteria = DiscoveryCriteria(
        industries=["AI startups"],
        roles=["Applied AI Engineer"],
        tech_stack=["LangGraph", "FastAPI"],
        locations=["San Francisco"],
        limit=5,
    )

    # 1. Query Builder Verification
    queries = DiscoveryQueryBuilder.build_queries(criteria)
    assert len(queries) >= 1
    assert any("Applied AI Engineer" in q for q in queries)
    assert any("LangGraph" in q for q in queries)
    assert any("San Francisco" in q for q in queries)
    assert any("-site:linkedin.com" in q for q in queries)

    # 2. Mock search provider response
    mock_search_results = [
        {
            "link": "https://agentic-solutions.io/about",
            "title": "Agentic Solutions - Enterprise AI Workflows",
            "snippet": "We build multi-agent LLM systems in San Francisco.",
        },
        {
            "link": "https://frontier-ai.co",
            "title": "Frontier AI - Autonomous Agents",
            "snippet": "Frontier AI is hiring Applied AI Engineers in SF.",
        },
        {
            "link": "https://linkedin.com/jobs/view/12345",
            "title": "Job on LinkedIn",
            "snippet": "Junk domain that should be rejected by normalization.",
        },
    ]

    async def mock_search(client, query, limit=10):
        return mock_search_results

    monkeypatch.setattr(engine, "_fetch_duckduckgo_results", mock_search)

    # Discover candidates
    candidates = await engine.discover_companies(criteria, provider="auto")

    # 3. Assertions on Discovered Candidates
    assert len(candidates) == 2
    domains = [c.domain for c in candidates]
    assert "agentic-solutions.io" in domains
    assert "frontier-ai.co" in domains
    # Aggregator / job board filtered out
    assert "linkedin.com" not in domains

    # Verify both were saved to DB
    c1 = await state.get_company_by_domain("agentic-solutions.io")
    c2 = await state.get_company_by_domain("frontier-ai.co")
    assert c1 is not None
    assert c2 is not None
    assert c1.source == "company_discovery"

    # 4. Rediscovery flags is_existing=True
    rediscover = await engine.discover_companies(criteria, provider="auto")
    assert len(rediscover) == 2
    assert all(c.is_existing for c in rediscover)


def test_proposal_generation_anti_fluff_and_opportunity_profiles():
    """Verify distinct messaging and strict zero-fluff constraints across all 4 opportunity profiles."""
    profiles = {
        "freelance": ["agency", "engineering capacity", "sprint"],
        "ai_contract": ["contract", "applied AI", "deliverable"],
        "junior_ai": ["Junior", "Applied AI", "full-time"],
        "ai_automation": ["automation", "multi-agent", "workflow"],
    }

    fluff_forbidden = [
        "hope this email finds you well",
        "i hope you're doing well",
        "reaching out because i am passionate",
        "synergy",
        "thought leader",
        "game changer",
        "disrupt",
        "revolutionary",
    ]

    for opp_type, expected_keywords in profiles.items():
        draft = ProposalGenerator.generate_draft(
            first_name="Marcus",
            last_name="Vance",
            title="VP of Engineering",
            company="Frontier Tech",
            domain="frontier-tech.io",
            opportunity_type=opp_type,
            tech_stack=["LangGraph", "FastAPI", "Pinecone"],
            hiring_roles=["Applied AI Engineer"],
        )

        assert draft.opportunity_type == opp_type
        assert "Marcus" in draft.body
        assert "Frontier Tech" in draft.subject or "Frontier Tech" in draft.body
        assert len(draft.body) < 1400  # concise cold outreach

        # Check for core opportunity intent
        body_lower = draft.body.lower()
        assert any(k.lower() in body_lower for k in expected_keywords)

        # Check strict anti-fluff
        for forbidden in fluff_forbidden:
            assert forbidden not in body_lower, f"Forbidden fluff '{forbidden}' found in {opp_type} proposal!"


