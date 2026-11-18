"""Outreach Proposal and Inquiry Email Generator.

Generates tailored, human-style outreach drafts for:
1. Freelance software development (software agencies)
2. AI engineering contracts (startups & product companies)
3. Full-time junior/applied AI developer opportunities
4. AI automation, agentic workflows, and RAG backend systems

Strict Rules:
- No AI fluff ("Hope this finds you well", "In today's fast-paced digital world", "Synergy", "Game changer").
- Direct, relevant, low-friction value propositions.
- Zero automated sending: all drafts require explicit human review and approval.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
import re
from typing import Any

logger = logging.getLogger("outreach.proposal_generator")


@dataclass
class ProposalDraft:
    opportunity_type: str        # freelance, ai_contract, junior_ai, ai_automation
    prospect_name: str
    recipient_email: str
    recipient_title: str
    company_name: str
    subject: str
    body: str
    opportunity_label: str
    target_role: str = ""
    tech_stack: list[str] = field(default_factory=list)
    ai_generated: bool = False
    rate_limited: bool = False
    rate_limit_reason: str = ""


OPPORTUNITY_LABELS = {
    "freelance": "Freelance Software Development",
    "ai_contract": "AI Engineering Contract",
    "junior_ai": "Junior / Applied AI Developer",
    "ai_automation": "AI Automation, Agents & RAG",
}


class ProposalGenerator:
    """Generates personalized outreach proposals and employment/contract inquiries."""

    @classmethod
    def generate_draft(
        cls,
        first_name: str,
        last_name: str = "",
        title: str = "",
        company: str = "",
        domain: str = "",
        opportunity_type: str = "ai_contract",
        tech_stack: list[str] | None = None,
        hiring_roles: list[str] | None = None,
        business_model: str = "",
        sender_name: str = "Vansh Singh",
        custom_angle: str = "",
    ) -> ProposalDraft:
        """Create a targeted proposal draft matching the opportunity type."""
        fn = first_name.strip().title() or "there"
        co = company.strip() or (domain.split(".")[0].title() if domain else "your company")
        techs = tech_stack or []
        roles = hiring_roles or []

        # Highlight relevant tech if available
        ai_techs = [t for t in techs if t in (
            "LangGraph", "LangChain", "OpenAI", "Anthropic", "FastAPI",
            "Qdrant", "Pinecone", "Weaviate", "PyTorch", "vLLM", "DeepSeek",
        )]
        tech_mention = ", ".join(ai_techs[:3]) if ai_techs else "Python and modern API backends"

        opp = opportunity_type.lower()
        if opp not in OPPORTUNITY_LABELS:
            opp = "ai_contract"

        label = OPPORTUNITY_LABELS[opp]

        if opp == "freelance":
            subject = f"Dev bandwidth for client sprints at {co}?"
            body = (
                f"Hi {fn},\n\n"
                f"Noticed {co}'s engineering and client work. Reaching out in case your technical "
                f"team ever experiences bandwidth crunches or needs a reliable freelance developer for sprint delivery.\n\n"
                f"I specialize in Python backend engineering, clean API design, and full-stack software development ({tech_mention}). "
                f"If you ever take on projects where an extra pair of hands would help deliver ahead of deadline, "
                f"I'd love to be on your radar.\n\n"
                f"Would it be helpful if I sent over 2 quick project walkthroughs or code samples?\n\n"
                f"Best,\n"
                f"{sender_name}"
            )

        elif opp == "junior_ai":
            subject = f"{fn} — Applied AI Engineer inquiry ({co})"
            role_focus = roles[0] if roles else "AI backend engineering"
            body = (
                f"Hi {fn},\n\n"
                f"I've been following {co}'s work and saw that your team is actively building with modern AI technology.\n\n"
                f"I'm an applied AI engineer with strong hands-on experience building production Python backends, "
                f"LangGraph multi-agent workflows, and robust RAG pipelines ({tech_mention}). "
                f"I'm looking for my next full-time engineering opportunity where I can contribute directly to core AI implementation.\n\n"
                f"Are you open to a brief 10-minute conversation, or could you point me to the right engineering lead on the team?\n\n"
                f"Best,\n"
                f"{sender_name}"
            )

        elif opp == "ai_automation":
            subject = f"AI agent & automation workflows for {co}"
            body = (
                f"Hi {fn},\n\n"
                f"Reaching out because teams in your space often spend significant engineering and operations "
                f"time on repetitive internal data and customer workflows.\n\n"
                f"I specialize in building production AI automations—autonomous agent systems, document retrieval (RAG), "
                f"and custom AI backends ({tech_mention}) that integrate directly into existing production workflows.\n\n"
                f"If {co} is exploring ways to streamline operations or introduce agentic capabilities without adding overhead, "
                f"I'd be glad to share a couple of concrete ideas.\n\n"
                f"Worth a quick chat later this week?\n\n"
                f"Best,\n"
                f"{sender_name}"
            )

        else:  # ai_contract (default)
            subject = f"Contract AI engineering for {co}"
            body = (
                f"Hi {fn},\n\n"
                f"Saw what {co} is building with AI and wanted to reach out directly.\n\n"
                f"I specialize in contract applied AI engineering—specifically production LLM application backends, "
                f"LangGraph multi-agent systems, and vector search pipelines ({tech_mention}). "
                f"I help startups ship complex AI features quickly without the delay of a months-long recruiting cycle.\n\n"
                f"Given your current engineering roadmap, do you have any immediate contract development needs where an experienced AI backend engineer could jump in?\n\n"
                f"Happy to share a quick 2-minute demo or project repo if helpful.\n\n"
                f"Best,\n"
                f"{sender_name}"
            )

        if custom_angle:
            body = f"{body}\n\nP.S. {custom_angle}"

        return ProposalDraft(
            opportunity_type=opp,
            prospect_name=f"{first_name} {last_name}".strip(),
            recipient_email="",
            recipient_title=title,
            company_name=co,
            subject=subject,
            body=body,
            opportunity_label=label,
            target_role=roles[0] if roles else "",
            tech_stack=techs,
        )

    @classmethod
    async def generate_draft_async(
        cls,
        first_name: str,
        last_name: str = "",
        title: str = "",
        company: str = "",
        domain: str = "",
        opportunity_type: str = "ai_contract",
        tech_stack: list[str] | None = None,
        hiring_roles: list[str] | None = None,
        business_model: str = "",
        sender_name: str = "Vansh Singh",
        custom_angle: str = "",
        use_ai: bool = True,
        client_ip: str = "",
    ) -> ProposalDraft:
        """Create a targeted proposal draft, with optional DeepSeek AI enhancement if available."""
        # Baseline deterministic draft
        base_draft = cls.generate_draft(
            first_name=first_name,
            last_name=last_name,
            title=title,
            company=company,
            domain=domain,
            opportunity_type=opportunity_type,
            tech_stack=tech_stack,
            hiring_roles=hiring_roles,
            business_model=business_model,
            sender_name=sender_name,
            custom_angle=custom_angle,
        )

        if not use_ai:
            return base_draft

        try:
            from outreach.deepseek import get_deepseek_client

            client = get_deepseek_client()
            if not client.is_available():
                return base_draft

            # Rate limit check (max 1 DeepSeek call per IP per 24 hours)
            allowed, reason = client.rate_limiter.can_call(client_ip)
            if not allowed:
                logger.info("DeepSeek rate limited for IP %s: %s (using deterministic heuristic)", client_ip, reason)
                base_draft.rate_limited = True
                base_draft.rate_limit_reason = reason
                return base_draft

            fn = f"{first_name} {last_name}".strip() or first_name or "there"
            ai_pitch = await client.tailor_pitch(
                prospect_name=fn,
                prospect_title=title,
                company_name=base_draft.company_name,
                opportunity_type=base_draft.opportunity_type,
                tech_stack=tech_stack,
                hiring_roles=hiring_roles,
                custom_context=custom_angle,
                sender_name=sender_name,
            )
            if ai_pitch and ai_pitch.get("body") and ai_pitch.get("subject"):
                base_draft.subject = ai_pitch["subject"]
                base_draft.body = ai_pitch["body"]
                base_draft.ai_generated = True
                client.rate_limiter.record_call(client_ip)
        except Exception as exc:
            logger.debug("DeepSeek pitch tailoring skipped: %s", exc)

        return base_draft

