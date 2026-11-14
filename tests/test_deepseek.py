"""Unit tests for DeepSeek AI Intelligence integration."""

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from sellbird.deepseek import (
    DeepSeekClient,
    DeepSeekConfig,
    get_deepseek_client,
)
from sellbird.proposal_generator import ProposalGenerator


def test_deepseek_config_defaults():
    cfg = DeepSeekConfig(api_key="")
    assert cfg.is_configured() is False
    assert cfg.model == "deepseek-chat"
    assert "deepseek.com" in cfg.base_url

    configured = DeepSeekConfig(api_key="sk-test-deepseek-key-12345")
    assert configured.is_configured() is True


def test_deepseek_client_unconfigured():
    client = DeepSeekClient(DeepSeekConfig(api_key=""))
    assert client.is_available() is False


@pytest.mark.asyncio
async def test_complete_when_unconfigured():
    client = DeepSeekClient(DeepSeekConfig(api_key=""))
    res = await client.complete([{"role": "user", "content": "hello"}])
    assert res is None


@pytest.mark.asyncio
async def test_complete_success_json():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key"))
    mock_response = httpx.Response(
        200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps({"normalized_title": "Founder & CTO", "role_priority": 1})
                    }
                }
            ],
            "usage": {"prompt_tokens": 50, "completion_tokens": 20},
        },
        request=httpx.Request("POST", "https://api.deepseek.com/chat/completions"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await client.complete([{"role": "user", "content": "normalize"}], json_mode=True)
        assert isinstance(res, dict)
        assert res["normalized_title"] == "Founder & CTO"
        assert res["role_priority"] == 1


@pytest.mark.asyncio
async def test_complete_markdown_wrapped_json():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key"))
    wrapped = "```json\n{\"industry\": \"Generative AI\", \"business_model\": \"product\"}\n```"
    mock_response = httpx.Response(
        200,
        json={"choices": [{"message": {"content": wrapped}}]},
        request=httpx.Request("POST", "https://api.deepseek.com/chat/completions"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await client.complete([{"role": "user", "content": "classify"}], json_mode=True)
        assert isinstance(res, dict)
        assert res["industry"] == "Generative AI"
        assert res["business_model"] == "product"


@pytest.mark.asyncio
async def test_complete_retry_on_rate_limit():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key", max_retries=1))
    req = httpx.Request("POST", "https://api.deepseek.com/chat/completions")
    resp_429 = httpx.Response(429, request=req)
    resp_200 = httpx.Response(
        200,
        json={"choices": [{"message": {"content": json.dumps({"ok": True})}}]},
        request=req,
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [resp_429, resp_200]
        res = await client.complete([{"role": "user", "content": "retry"}], json_mode=True)
        assert res == {"ok": True}
        assert mock_post.call_count == 2


@pytest.mark.asyncio
async def test_normalize_title_with_deepseek():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key"))
    mock_json = {
        "normalized_title": "Founder & CTO",
        "role_priority": 1,
        "seniority": "executive",
        "department": "engineering",
        "is_technical_decision_maker": True,
        "confidence": 0.95,
    }

    with patch.object(client, "complete", new_callable=AsyncMock) as mock_comp:
        mock_comp.return_value = mock_json
        res = await client.normalize_title("Chief Wizard & Founder", "CognitiveLab")
        assert res["normalized_title"] == "Founder & CTO"
        assert res["role_priority"] == 1
        assert res["is_technical_decision_maker"] is True


@pytest.mark.asyncio
async def test_normalize_title_heuristic_fallback():
    # When unconfigured, falls back to deterministic regex
    client = DeepSeekClient(DeepSeekConfig(api_key=""))
    res = await client.normalize_title("VP of Engineering", "PixelCraft")
    assert "VP of Engineering" in res["normalized_title"]
    assert res["role_priority"] in (2, 3)
    assert res["is_technical_decision_maker"] is True


@pytest.mark.asyncio
async def test_extract_decision_makers():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key"))
    mock_people = {
        "people": [
            {
                "first_name": "Marcus",
                "last_name": "Vance",
                "title": "Co-Founder & CTO",
                "role_priority": 1,
                "evidence_snippet": "Marcus leads core AI research and engineering.",
                "linkedin_url": "https://linkedin.com/in/marcus-vance",
                "confidence": 0.95,
            }
        ]
    }

    with patch.object(client, "complete", new_callable=AsyncMock) as mock_comp:
        mock_comp.return_value = mock_people
        people = await client.extract_decision_makers("Meet our leadership: Marcus Vance is CTO.", "OmniAI")
        assert len(people) == 1
        assert people[0]["first_name"] == "Marcus"
        assert people[0]["role_priority"] == 1


@pytest.mark.asyncio
async def test_classify_firmographics():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key"))
    mock_firmo = {
        "industry": "Generative AI",
        "business_model": "product",
        "employee_size_tier": "11-50",
        "is_remote_friendly": True,
        "tech_stack": ["LangGraph", "FastAPI", "Qdrant"],
        "hiring_roles": ["Applied AI Engineer"],
    }

    with patch.object(client, "complete", new_callable=AsyncMock) as mock_comp:
        mock_comp.return_value = mock_firmo
        firmo = await client.classify_firmographics("We build multi-agent AI systems with LangGraph.", "omni.ai")
        assert firmo["industry"] == "Generative AI"
        assert firmo["business_model"] == "product"
        assert "LangGraph" in firmo["tech_stack"]
        assert firmo["is_remote_friendly"] is True


@pytest.mark.asyncio
async def test_tailor_pitch_and_proposal_generator_integration():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key"))
    mock_pitch = {
        "subject": "AI agent engineering bandwidth for OmniAI?",
        "hook": "Saw what you're building with LangGraph at OmniAI.",
        "body": "Hi Marcus,\n\nSaw your team's work on LangGraph multi-agent pipelines.",
        "custom_angle": "LangGraph multi-agent workflows",
    }

    with patch("sellbird.deepseek.get_deepseek_client", return_value=client):
        with patch.object(client, "tailor_pitch", new_callable=AsyncMock) as mock_tp:
            mock_tp.return_value = mock_pitch
            draft = await ProposalGenerator.generate_draft_async(
                first_name="Marcus",
                last_name="Vance",
                title="CTO",
                company="OmniAI",
                domain="omni.ai",
                opportunity_type="ai_contract",
                tech_stack=["LangGraph"],
                use_ai=True,
            )
            assert "Marcus" in draft.prospect_name
            assert draft.subject == "AI agent engineering bandwidth for OmniAI?"
            assert "LangGraph" in draft.body


@pytest.mark.asyncio
async def test_proposal_generator_fallback_when_ai_fails():
    client = DeepSeekClient(DeepSeekConfig(api_key="sk-valid-key"))

    with patch("sellbird.deepseek.get_deepseek_client", return_value=client):
        with patch.object(client, "tailor_pitch", new_callable=AsyncMock) as mock_tp:
            # Simulate DeepSeek failure / timeout
            mock_tp.return_value = None
            draft = await ProposalGenerator.generate_draft_async(
                first_name="Elena",
                last_name="Rostova",
                title="VP of Engineering",
                company="NexusLab",
                domain="nexuslab.ai",
                opportunity_type="freelance",
                tech_stack=["FastAPI", "Python"],
                use_ai=True,
            )
            # Seamless fallback to deterministic template
            assert "NexusLab" in draft.subject
            assert "Elena" in draft.body
            assert "freelance developer" in draft.body

