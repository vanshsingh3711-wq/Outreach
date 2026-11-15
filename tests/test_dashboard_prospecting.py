"""Tests for AI Prospecting endpoints in Outreach Dashboard."""

import asyncio
import sqlite3
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import outreach.config as outreach_config
import outreach.dashboard as dash
from outreach.signals import seed_signal_catalog
from outreach.state import StateManager

ORIGIN = "http://127.0.0.1:5555"
CONFIG = SimpleNamespace(
    icp=SimpleNamespace(industries=["artificial intelligence"], titles=["CTO", "Founder"],
                        hiring_signals=["Applied AI Engineer"]),
    compliance=SimpleNamespace(do_not_contact=[]),
)


@pytest.fixture
def env(tmp_path, monkeypatch):
    (tmp_path / "data").mkdir()
    db = tmp_path / "data" / "outreach.db"
    monkeypatch.setattr(dash, "ENV_FILE", tmp_path / ".env")
    monkeypatch.setattr(dash, "DB_PATH", db)
    monkeypatch.setattr(dash, "PID_FILE", tmp_path / "data" / "outreach.pid")
    monkeypatch.setattr(dash, "LOG_FILE", tmp_path / "data" / "outreach.log")
    monkeypatch.setattr(outreach_config, "load_config", lambda *a, **k: CONFIG)
    dash.token_store.configure(tmp_path / "data" / "dashboard-token")

    async def _init():
        state = StateManager(db_path=str(db))
        await state.init_db()
        await seed_signal_catalog(state)
    asyncio.run(_init())

    with sqlite3.connect(db) as c:
        c.execute(
            "INSERT INTO companies (id, name, domain, website, industry, location, source) "
            "VALUES ('c1', 'Cognitive Labs', 'cognitivelab.ai', 'https://cognitivelab.ai', 'Generative AI', 'San Francisco', 'url_enrichment')"
        )
        c.execute(
            "INSERT INTO prospects (id, company_id, first_name, last_name, title, email, "
            "email_status, email_verified, linkedin_url, score, personalization_notes, status) "
            "VALUES ('p1', 'c1', 'Alex', 'Rivera', 'Co-Founder & CTO', 'alex@cognitivelab.ai', "
            "'verified', 1, 'https://linkedin.com/in/alex-rivera', 95, 'Found on about page | match_confidence: 0.95', 'new')"
        )
        c.execute(
            "INSERT INTO prospects (id, company_id, first_name, last_name, title, email, "
            "email_status, email_verified, linkedin_url, score, personalization_notes, status) "
            "VALUES ('p2', 'c1', 'Devon', 'Vance', 'Lead AI Engineer', 'devon@cognitivelab.ai', "
            "'risky', 0, '', 65, 'Found on team page | match_confidence: 0.70', 'new')"
        )
        c.execute(
            "INSERT INTO observations (id, company_id, prospect_id, signal_code, value_text) "
            "VALUES ('o1', 'c1', '', 'TECH_STACK', 'LangGraph')"
        )
        c.execute(
            "INSERT INTO observations (id, company_id, prospect_id, signal_code, value_text) "
            "VALUES ('o2', 'c1', '', 'HIRING_ROLE', 'Applied AI Engineer')"
        )

    return {"token": dash.token_store.get()}


@pytest.fixture
def client(env):
    with TestClient(dash.app, base_url=ORIGIN,
                    headers={"Authorization": f"Bearer {env['token']}"}) as c:
        yield c


def test_get_decision_makers(client):
    r = client.get("/api/prospecting/decision-makers")
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["count"] == 2
    dms = data["decision_makers"]
    assert any(d["first_name"] == "Alex" and d["role_priority"] == 1 for d in dms)
    assert any(d["first_name"] == "Devon" for d in dms)


def test_get_decision_makers_filtered(client):
    # Filter by deliverability
    r = client.get("/api/prospecting/decision-makers?deliverability=verified")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 1
    assert data["decision_makers"][0]["first_name"] == "Alex"

    # Filter by search
    r = client.get("/api/prospecting/decision-makers?search=Devon")
    assert r.status_code == 200
    assert r.json()["count"] == 1
    assert r.json()["decision_makers"][0]["first_name"] == "Devon"


def test_export_decision_makers_csv(client):
    r = client.get("/api/prospecting/decision-makers?format=csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    text = r.text
    assert "Alex" in text
    assert "alex@cognitivelab.ai" in text
    assert "Cognitive Labs" in text


def test_draft_proposal_endpoint(client):
    r = client.post(
        "/api/prospecting/draft-proposal",
        json={"prospect_id": "p1", "opportunity_type": "ai_contract", "use_ai": False},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    draft = data["draft"]
    assert draft["opportunity_type"] == "ai_contract"
    assert "Alex" in draft["prospect_name"]
    assert "alex@cognitivelab.ai" in draft["recipient_email"]
    assert "Cognitive Labs" in draft["subject"] or "Cognitive Labs" in draft["body"]
    assert "LangGraph" in draft["tech_stack"]


def test_draft_proposal_not_found(client):
    r = client.post(
        "/api/prospecting/draft-proposal",
        json={"prospect_id": "nonexistent"},
    )
    assert r.status_code == 404


def test_approve_outreach_endpoint(client):
    r = client.post(
        "/api/prospecting/approve-outreach",
        json={
            "prospect_id": "p1",
            "to_email": "alex@cognitivelab.ai",
            "subject": "Contract AI engineering for Cognitive Labs",
            "body": "Hi Alex,\n\nReaching out about AI contract engineering.",
            "queue_status": "pending_review",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["status"] == "pending_review"
    assert data["outbox_id"]

    # Verify prospect status updated to queued
    dm_res = client.get("/api/prospecting/decision-makers?search=Alex")
    assert dm_res.json()["decision_makers"][0]["status"] == "queued"


def test_get_ai_status(client):
    r = client.get("/api/prospecting/ai-status")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "deepseek"
    assert "configured" in data
    assert "model" in data


def test_save_lead_endpoint(client):
    r = client.post(
        "/api/prospecting/save-lead",
        json={
            "domain": "staged-startup.io",
            "name": "Staged Startup",
            "website": "https://staged-startup.io",
            "description": "Next-gen developer tooling platform.",
            "industry": "Developer Tools",
            "location": "San Francisco, CA",
            "size": "11-50",
            "people": [
                {
                    "first_name": "Sarah",
                    "last_name": "Connor",
                    "title": "Founder & CEO",
                    "email": "sarah@staged-startup.io",
                    "email_status": "verified",
                    "email_verified": True,
                    "linkedin_url": "https://linkedin.com/in/sarah-connor",
                }
            ],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["company_id"]
    assert data["saved_prospects"] == 1

    # Verify it now appears in decision-makers
    dm_res = client.get("/api/prospecting/decision-makers?search=Sarah")
    assert dm_res.status_code == 200
    assert dm_res.json()["count"] == 1
    assert dm_res.json()["decision_makers"][0]["first_name"] == "Sarah"


def test_save_leads_batch_endpoint(client):
    r = client.post(
        "/api/prospecting/save-leads-batch",
        json={
            "leads": [
                {
                    "domain": "batch-agency1.com",
                    "name": "Batch Agency One",
                    "industry": "Agencies & Dev Studios",
                    "people": [
                        {"first_name": "John", "last_name": "Doe", "title": "Partner", "email": "john@batch1.com"}
                    ],
                },
                {
                    "domain": "batch-agency2.com",
                    "name": "Batch Agency Two",
                    "industry": "Agencies & Dev Studios",
                    "people": [],
                },
            ]
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["saved_count"] == 2



