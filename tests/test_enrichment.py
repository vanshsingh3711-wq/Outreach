"""Tests for single-company URL enrichment and SSRF protection."""

import json
import pytest
import pytest_asyncio
import httpx
from starlette.testclient import TestClient

from outreach.enrichment import (
    CompanyEnricher,
    EnrichmentResult,
    SSRFValidationError,
    validate_and_normalize_url,
    _check_ip_address_safety,
)
from outreach.models.company import Company
from outreach.state import StateManager


# ── SSRF Validation Tests ─────────────────────────────────────────────

def test_valid_urls():
    url, domain = validate_and_normalize_url("https://example.com")
    assert url == "https://example.com/"
    assert domain == "example.com"

    url, domain = validate_and_normalize_url("http://sub.domain.org/about")
    assert url == "http://sub.domain.org/about"
    assert domain == "sub.domain.org"

    # Auto-prepend https
    url, domain = validate_and_normalize_url("agency.io/team")
    assert url == "https://agency.io/team"
    assert domain == "agency.io"

    # URL with www is stripped for domain key
    url, domain = validate_and_normalize_url("https://www.startup.ai/")
    assert domain == "startup.ai"


def test_reject_unsupported_schemes():
    for bad in ("ftp://example.com", "file:///etc/passwd", "gopher://evil.com", "data:text/html,bad"):
        with pytest.raises(SSRFValidationError):
            validate_and_normalize_url(bad)


def test_reject_credentials_in_url():
    with pytest.raises(SSRFValidationError):
        validate_and_normalize_url("https://admin:secret@example.com")


def test_reject_localhost_destinations():
    for bad in ("http://localhost", "http://localhost:8000", "http://app.localhost", "https://localhost/"):
        with pytest.raises(SSRFValidationError):
            validate_and_normalize_url(bad)


def test_reject_private_and_loopback_ips():
    blocked = [
        "http://127.0.0.1",
        "http://127.0.0.2:8080",
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://172.31.255.255",
        "http://192.168.1.1",
        "http://169.254.169.254",   # AWS / GCP link-local metadata
        "http://0.0.0.0",
        "http://[::1]",
        "http://[fc00::1]",
        "http://[fe80::1]",
    ]
    for bad in blocked:
        with pytest.raises(SSRFValidationError):
            validate_and_normalize_url(bad)


def test_reject_internal_cloud_metadata_hostnames():
    with pytest.raises(SSRFValidationError):
        validate_and_normalize_url("http://metadata.google.internal")


def test_reject_invalid_ports():
    with pytest.raises(SSRFValidationError):
        validate_and_normalize_url("https://example.com:0")
    with pytest.raises(SSRFValidationError):
        validate_and_normalize_url("https://example.com:70000")


# ── Enrichment & Crawling Logic Tests ─────────────────────────────────

@pytest.mark.asyncio
async def test_enrich_company_success(monkeypatch, tmp_path):
    db_path = tmp_path / "test_enrich.db"
    state = StateManager(db_path=str(db_path))
    await state.init_db()

    # Mock HTML pages
    home_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Acme AI - Next-Gen Autonomous Systems</title>
        <meta property="og:site_name" content="Acme AI" />
        <meta name="description" content="We build cutting edge AI agents and RAG pipelines." />
    </head>
    <body>
        <nav>
            <a href="/about">About Us</a>
            <a href="/team">Leadership Team</a>
            <a href="/careers">Careers (We're Hiring)</a>
        </nav>
        <h1>Welcome to Acme AI</h1>
        <script src="https://assets.website-files.com/script.js" data-wf-domain="acme.ai"></script>
    </body>
    </html>
    """

    team_html = """
    <!DOCTYPE html>
    <html>
    <head><title>Leadership - Acme AI</title></head>
    <body>
        <div class="team-card">
            <h3>Sarah Connor</h3>
            <p>Founder & CEO</p>
            <p>Email: sarah@acme.ai</p>
        </div>
        <div class="team-card">
            <h3>John Matrix</h3>
            <p>Chief Technology Officer</p>
            <p>Email: john.matrix@acme.ai</p>
        </div>
    </body>
    </html>
    """

    careers_html = """
    <!DOCTYPE html>
    <html>
    <head><title>Careers at Acme AI</title></head>
    <body>
        <h2>Open Engineering Positions</h2>
        <p>We are actively hiring Senior AI Engineers and Python Backend Developers.</p>
    </body>
    </html>
    """

    async def mock_get(client, url):
        u = str(url)
        if "/team" in u:
            return team_html
        elif "/careers" in u:
            return careers_html
        return home_html

    import outreach.email_intelligence as ei_mod
    async def mock_mx(domain):
        return "aspmx.l.google.com"
    monkeypatch.setattr(ei_mod, "get_mx_host", mock_mx)

    enricher = CompanyEnricher(state)
    monkeypatch.setattr(enricher, "_safe_fetch", mock_get)

    result = await enricher.enrich_url("https://acme.ai")

    assert result.error == ""
    assert result.is_new is True
    assert result.company.domain == "acme.ai"
    assert result.company.name == "Acme AI"
    assert "cutting edge AI agents" in result.company.description
    assert "Webflow" in result.company.tech_stack
    assert result.hiring_detected is True
    assert len(result.pages_crawled) >= 1

    # Check discovered people
    assert len(result.people) >= 2
    names = {f"{p.first_name} {p.last_name}" for p in result.people}
    assert "Sarah Connor" in names
    assert "John Matrix" in names

    # Verify priorities
    ceo = next(p for p in result.people if "Sarah" in p.first_name)
    assert ceo.role_priority == 1
    cto = next(p for p in result.people if "John" in p.first_name)
    assert cto.role_priority == 2

    # Check discovered emails
    assert "sarah@acme.ai" in result.emails or "john.matrix@acme.ai" in result.emails

    # Verify database persistence
    saved_co = await state.get_company_by_domain("acme.ai")
    assert saved_co is not None
    assert saved_co.name == "Acme AI"
    contacts = await state.get_contacts_for_company(saved_co.id)
    assert len(contacts) >= 2


@pytest.mark.asyncio
async def test_enrich_existing_company_updates_record(monkeypatch, tmp_path):
    db_path = tmp_path / "test_enrich_update.db"
    state = StateManager(db_path=str(db_path))
    await state.init_db()

    # Pre-insert existing company
    orig_company = Company(
        domain="beta.io",
        name="Old Name",
        website="https://beta.io",
        industry="SaaS",
    )
    orig_id = await state.add_company(orig_company)

    updated_home_html = """
    <html>
    <head>
        <title>Beta Technologies Inc</title>
        <meta property="og:site_name" content="Beta Technologies" />
        <meta name="description" content="Updated company description for Beta." />
    </head>
    <body>
        <script src="https://static.hotjar.com/c/hotjar.js"></script>
    </body>
    </html>
    """

    async def mock_get(client, url):
        return updated_home_html

    import outreach.email_intelligence as ei_mod
    async def mock_mx(domain):
        return "aspmx.l.google.com"
    monkeypatch.setattr(ei_mod, "get_mx_host", mock_mx)

    enricher = CompanyEnricher(state)
    monkeypatch.setattr(enricher, "_safe_fetch", mock_get)

    result = await enricher.enrich_url("https://beta.io")
    assert result.is_new is False
    assert result.company.id == orig_id
    assert "Beta Technologies" in result.company.name

    # Verify DB has updated values and preserved industry
    saved = await state.get_company(orig_id)
    assert "Beta Technologies" in saved.name
    assert saved.description == "Updated company description for Beta."
    assert saved.industry == "SaaS"
    assert "Hotjar" in saved.tech_stack


# ── Dashboard API Route Tests ─────────────────────────────────────────

def test_api_enrich_url_route(tmp_path, monkeypatch):
    from outreach.dashboard import app, token_store

    async def mock_fetch(self, client, url):
        return """
        <html>
        <head>
            <title>Test Corp</title>
            <meta property="og:site_name" content="Test Corp" />
        </head>
        <body><p>Hello world</p></body>
        </html>
        """

    monkeypatch.setattr(CompanyEnricher, "_safe_fetch", mock_fetch)

    headers = {"Authorization": f"Bearer {token_store.get()}"}
    client = TestClient(app, base_url="http://127.0.0.1:5555", headers=headers)

    # 1. Successful enrichment call
    resp = client.post("/api/prospecting/enrich-url", json={"url": "https://testcorp.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["company"]["domain"] == "testcorp.com"

    # 2. Reject SSRF url
    resp_ssrf = client.post("/api/prospecting/enrich-url", json={"url": "http://127.0.0.1:8080"})
    assert resp_ssrf.status_code == 400
    assert "Security restriction" in resp_ssrf.json()["error"]

    # 3. Missing url
    resp_bad = client.post("/api/prospecting/enrich-url", json={})
    assert resp_bad.status_code == 400


def test_cli_enrich_command(capsys, monkeypatch):
    import argparse
    from outreach.cli import cmd_enrich
    from outreach.enrichment import DiscoveredPerson

    async def mock_enrich(self, raw_url):
        return EnrichmentResult(
            company=Company(
                id="c_cli",
                domain="clicorp.com",
                name="CLI Corp",
                website="https://clicorp.com",
                description="Desc",
                tech_stack=["Next.js"],
            ),
            is_new=True,
            canonical_url="https://clicorp.com/",
            pages_crawled=["https://clicorp.com/"],
            people=[DiscoveredPerson(first_name="Jane", last_name="Doe", title="CTO", role_priority=2)],
            emails=["jane@clicorp.com"],
            hiring_detected=True,
        )

    monkeypatch.setattr(CompanyEnricher, "enrich_url", mock_enrich)

    args = argparse.Namespace(url="https://clicorp.com")
    cmd_enrich(args)

    captured = capsys.readouterr().out
    assert "Enriching company website: https://clicorp.com" in captured
    assert "CLI Corp" in captured
    assert "Next.js" in captured
    assert "Jane Doe | CTO (Priority 2)" in captured
    assert "jane@clicorp.com" in captured
