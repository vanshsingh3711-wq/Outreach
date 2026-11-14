"""Unit tests for ProposalGenerator."""

import pytest
from sellbird.proposal_generator import ProposalDraft, ProposalGenerator, OPPORTUNITY_LABELS


def test_proposal_generator_freelance():
    draft = ProposalGenerator.generate_draft(
        first_name="Alex",
        last_name="Mercer",
        title="CEO",
        company="PixelCraft Studio",
        domain="pixelcraft.io",
        opportunity_type="freelance",
        tech_stack=["Python", "FastAPI", "OpenAI"],
        sender_name="Vansh Singh",
    )
    assert isinstance(draft, ProposalDraft)
    assert draft.opportunity_type == "freelance"
    assert "PixelCraft Studio" in draft.subject
    assert "Alex" in draft.body
    assert "freelance developer" in draft.body
    assert "FastAPI" in draft.body or "Python" in draft.body
    assert "Vansh Singh" in draft.body
    # Verify strict anti-hype copy
    assert "Hope this finds you well" not in draft.body
    assert "game changer" not in draft.body.lower()
    assert "synergy" not in draft.body.lower()


def test_proposal_generator_ai_contract():
    draft = ProposalGenerator.generate_draft(
        first_name="Sarah",
        last_name="Connor",
        title="CTO",
        company="CognitiveLab",
        domain="cognitivelab.ai",
        opportunity_type="ai_contract",
        tech_stack=["LangGraph", "Qdrant", "Anthropic"],
        sender_name="Vansh Singh",
        custom_angle="Saw your recent launch of the multi-agent workbench.",
    )
    assert draft.opportunity_type == "ai_contract"
    assert "CognitiveLab" in draft.subject
    assert "LangGraph" in draft.body
    assert "P.S. Saw your recent launch" in draft.body
    assert "contract applied AI engineering" in draft.body


def test_proposal_generator_junior_ai():
    draft = ProposalGenerator.generate_draft(
        first_name="David",
        last_name="Kim",
        title="VP of Engineering",
        company="Nexus AI",
        domain="nexusai.com",
        opportunity_type="junior_ai",
        hiring_roles=["Applied AI Engineer"],
        tech_stack=["PyTorch", "FastAPI"],
    )
    assert draft.opportunity_type == "junior_ai"
    assert "David" in draft.subject
    assert "Applied AI Engineer" in draft.subject or "Applied AI Engineer" in draft.body
    assert "full-time engineering opportunity" in draft.body


def test_proposal_generator_ai_automation():
    draft = ProposalGenerator.generate_draft(
        first_name="Elena",
        last_name="Rostova",
        title="Operations Director",
        company="LogiFlow",
        domain="logiflow.net",
        opportunity_type="ai_automation",
        tech_stack=["LangChain", "OpenAI"],
    )
    assert draft.opportunity_type == "ai_automation"
    assert "AI agent & automation workflows" in draft.subject
    assert "production AI automations" in draft.body


def test_proposal_generator_fallback_opportunity():
    draft = ProposalGenerator.generate_draft(
        first_name="Marcus",
        company="OmniCorp",
        opportunity_type="unknown_type",
    )
    # Defaults to ai_contract
    assert draft.opportunity_type == "ai_contract"
    assert "OmniCorp" in draft.company_name


def test_proposal_generator_empty_names():
    draft = ProposalGenerator.generate_draft(
        first_name="",
        company="",
        domain="deepflow.io",
        opportunity_type="freelance",
    )
    assert "Hi there" in draft.body
    assert "Deepflow" in draft.company_name

