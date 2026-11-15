"""Unit tests for filtered company discovery engine and query generation."""

import pytest
from httpx import ASGITransport, AsyncClient

from outreach.collectors.discover import PRESETS
from outreach.dashboard import app
from outreach.discovery_engine import (
    DiscoveredCandidate,
    DiscoveryCriteria,
    DiscoveryQueryBuilder,
    FilteredDiscoveryEngine,
    is_junk_domain,
)
from outreach.enrichment import CompanyEnricher, EnrichmentResult
from outreach.models.company import Company
from outreach.state import StateManager


def test_presets_extension():
    """Verify new AI & engineering discovery presets are registered."""
    assert "ai_startups" in PRESETS
    assert "software_agencies" in PRESETS
    assert "ai_hiring" in PRESETS
    assert "agent_products" in PRESETS
    assert "ai_contracts" in PRESETS


def test_query_builder_ai_startups_hiring_python_germany():
    """Verify query: 'AI startups hiring Python engineers in Germany'."""
    criteria = DiscoveryCriteria(
        industries=["AI startups"],
        roles=["Python engineer"],
        locations=["Germany"],
    )
    queries = DiscoveryQueryBuilder.build_queries(criteria)
    assert len(queries) >= 1
    q = queries[0]
    assert "AI startups" in q
    assert "Python engineer" in q
    assert '"Germany"' in q
    assert "-site:linkedin.com" in q
    assert "-site:indeed.com" in q


def test_query_builder_software_agencies_us():
    """Verify query: 'Software development agencies in the United States'."""
    criteria = DiscoveryCriteria(
        industries=["software development agency"],
        business_model="agency",
        locations=["United States"],
    )
    queries = DiscoveryQueryBuilder.build_queries(criteria)
    assert len(queries) >= 1
    q = queries[0]
    assert "software development agency" in q
    assert "our clients" in q
    assert '"United States"' in q
    assert "-site:clutch.co" in q


def test_query_builder_seed_funded_ai_companies():
    """Verify query: 'Seed-funded AI companies hiring Applied AI Engineers'."""
    criteria = DiscoveryCriteria(
        industries=["AI companies"],
        roles=["Applied AI Engineer"],
        funding_stage="Seed",
    )
    queries = DiscoveryQueryBuilder.build_queries(criteria)
    assert len(queries) >= 1
    q = queries[0]
    assert "AI companies" in q
    assert "Applied AI Engineer" in q
    assert "-site:linkedin.com" in q


def test_query_builder_langgraph_agent_products():
    """Verify query: 'Companies building LangGraph or agent-based products'."""
    criteria = DiscoveryCriteria(
        industries=["AI platform"],
        tech_stack=["LangGraph"],
    )
    queries = DiscoveryQueryBuilder.build_queries(criteria)
    assert len(queries) >= 1
    q = queries[0]
    assert "LangGraph" in q
    assert "product" in q or "platform" in q
    assert "-site:github.com" in q


def test_is_junk_domain():
    # Should be rejected (aggregators, job boards, gig platforms)
    assert is_junk_domain("linkedin.com") is True
    assert is_junk_domain("www.linkedin.com") is True
    assert is_junk_domain("clutch.co") is True
    assert is_junk_domain("upwork.com") is True
    assert is_junk_domain("fiverr.com") is True
    assert is_junk_domain("indeed.com") is True
    assert is_junk_domain("jobright.ai") is True
    assert is_junk_domain("remoteok.com") is True
    assert is_junk_domain("levels.fyi") is True
    assert is_junk_domain("boards.greenhouse.io") is True
    assert is_junk_domain("jobs.lever.co") is True
    assert is_junk_domain("crunchbase.com") is True

    # Real prospective company domains
    assert is_junk_domain("agentflow.ai") is False
    assert is_junk_domain("synthetica.de") is False
    assert is_junk_domain("customdevstudio.com") is False


def test_query_builder_startups_for_jobs():
    """Verify startups query excludes job boards and searches product/platform."""
    criteria = DiscoveryCriteria(
        target_type="startup",
        industries=["AI", "SaaS"],
        tech_stack=["Python", "Next.js"],
        locations=["United States"],
        company_size_tier="11-50",
        revenue_tier="Bootstrapped",
    )
    queries = DiscoveryQueryBuilder.build_queries(criteria)
    assert len(queries) >= 1
    q = queries[0]
    assert "AI startup" in q or "SaaS" in q
    assert "Python" in q
    assert '"United States"' in q
    assert '"11-50 employees"' in q
    assert '"Bootstrapped"' in q
    assert "-site:jobright.ai" in q
    assert "-site:indeed.com" in q
    assert "-site:upwork.com" in q


def test_query_builder_agencies_for_freelance():
    """Verify agencies query focuses on services, clients, and case studies."""
    criteria = DiscoveryCriteria(
        target_type="agency",
        industries=["digital agency"],
        tech_stack=["React"],
        locations=["Remote"],
        company_size_tier="1-10",
    )
    queries = DiscoveryQueryBuilder.build_queries(criteria)
    assert len(queries) >= 1
    q = queries[0]
    assert "software development agency" in q or "digital agency" in q
    assert "our clients" in q or "our work" in q or "case studies" in q
    assert "remote" in q
    assert "-site:upwork.com" in q


@pytest.mark.asyncio
async def test_filtered_discovery_execution_and_deduplication(monkeypatch, tmp_path):
    db_path = tmp_path / "test_disc.db"
    state = StateManager(db_path=str(db_path))
    await state.init_db()

    engine = FilteredDiscoveryEngine(state)

    # Mock search items
    mock_search_items = [
        {
            "link": "https://neuro-agent.ai/about",
            "title": "NeuroAgent AI - Autonomous Enterprise Agents",
            "snippet": "We build generative AI agents for enterprise automation.",
        },
        {
            "link": "https://www.linkedin.com/company/neuro-agent",
            "title": "NeuroAgent | LinkedIn",
            "snippet": "LinkedIn profile of NeuroAgent.",
        },
        {
            "link": "https://neuro-agent.ai/careers",
            "title": "Careers at NeuroAgent AI",
            "snippet": "Join our AI engineering team.",
        },
        {
            "link": "https://codecrafters-agency.com",
            "title": "CodeCrafters | Custom Software & AI Development Agency",
            "snippet": "Custom software development agency delivering high-scale systems.",
        },
    ]

    async def mock_fetch_ddg(client, q_str, limit=20):
        return mock_search_items

    monkeypatch.setattr(engine, "_fetch_duckduckgo_results", mock_fetch_ddg)

    criteria = DiscoveryCriteria(
        industries=["AI startups"],
        roles=["AI Engineer"],
        limit=5,
    )

    candidates = await engine.discover_companies(criteria, provider="fallback")

    # Should discover neuro-agent.ai and codecrafters-agency.com (linkedin rejected, duplicate neuro-agent.ai filtered)
    assert len(candidates) == 2
    domains = [c.domain for c in candidates]
    assert "neuro-agent.ai" in domains
    assert "codecrafters-agency.com" in domains
    assert all(not c.is_existing for c in candidates)

    # Verify saved in database
    saved_co = await state.get_company_by_domain("neuro-agent.ai")
    assert saved_co is not None
    assert saved_co.source == "company_discovery"

    # Re-running discovery marks existing
    candidates_second = await engine.discover_companies(criteria, provider="fallback")
    assert len(candidates_second) == 2
    assert all(c.is_existing for c in candidates_second)


@pytest.mark.asyncio
async def test_filtered_discovery_with_auto_enrichment(monkeypatch, tmp_path):
    db_path = tmp_path / "test_disc_enrich.db"
    state = StateManager(db_path=str(db_path))
    await state.init_db()

    enricher = CompanyEnricher(state)
    engine = FilteredDiscoveryEngine(state, enricher=enricher)

    mock_items = [
        {
            "link": "https://ai-frontier.io",
            "title": "AI Frontier - LLM Platform",
            "snippet": "Next-gen LLM workflows.",
        }
    ]

    async def mock_fetch_ddg(client, q_str, limit=20):
        return mock_items

    async def mock_enrich(url, persist=True):
        co = Company(domain="ai-frontier.io", name="AI Frontier", website=url, industry="Artificial Intelligence")
        return EnrichmentResult(
            company=co,
            is_new=True,
            canonical_url=url,
            people=[],
            hiring_detected=True,
            firmographics={"business_model": "product", "funding_stage": "Seed"},
        )

    monkeypatch.setattr(engine, "_fetch_duckduckgo_results", mock_fetch_ddg)
    monkeypatch.setattr(enricher, "enrich_url", mock_enrich)

    criteria = DiscoveryCriteria(
        industries=["Generative AI"],
        auto_enrich=True,
        limit=2,
    )

    candidates = await engine.discover_companies(criteria, provider="fallback")
    assert len(candidates) == 1
    cand = candidates[0]
    assert cand.domain == "ai-frontier.io"
    assert cand.enrichment_result is not None
    assert cand.enrichment_result.company.name == "AI Frontier"


def test_api_discover_companies_endpoint(monkeypatch):
    from starlette.testclient import TestClient
    from outreach.dashboard import token_store

    mock_candidates = [
        DiscoveredCandidate(
            domain="apex-ai.io",
            name="Apex AI",
            website="https://apex-ai.io",
            title="Apex AI - Agents",
            snippet="Enterprise agent workflows",
            source_url="https://apex-ai.io",
            query="AI startups",
            rank=1,
            is_existing=False,
            company_id="cid-123",
        )
    ]

    async def mock_discover(self, criteria, provider="auto"):
        return mock_candidates

    monkeypatch.setattr(FilteredDiscoveryEngine, "discover_companies", mock_discover)

    headers = {"Authorization": f"Bearer {token_store.get()}"}
    client = TestClient(app, base_url="http://127.0.0.1:5555", headers=headers)

    resp = client.post(
        "/api/prospecting/discover",
        json={
            "industries": ["Artificial Intelligence"],
            "roles": ["Applied AI Engineer"],
            "locations": ["Germany"],
            "limit": 5,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["count"] == 1
    assert data["companies"][0]["domain"] == "apex-ai.io"
