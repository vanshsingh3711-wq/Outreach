"""Tests for technical decision-maker discovery, role prioritization, and anti-confusion guards."""

import pytest

from sellbird.decision_makers import (
    DecisionMaker,
    DecisionMakerConfig,
    DecisionMakerExtractor,
    classify_role_priority,
    is_excluded_person,
    normalize_technical_title,
)


def test_normalize_technical_title_priorities():
    # Priority 1: Founders, Co-Founders, CEOs
    for title in ("Founder & CEO", "Co-Founder", "Cofounder", "Chief Executive Officer", "President"):
        _, p, seniority = normalize_technical_title(title)
        assert p == 1, f"Expected P1 for '{title}', got {p}"
        assert seniority == "c_suite"

    # Priority 2: CTOs, Chief Technology Officers
    for title in ("CTO", "Chief Technology Officer", "Chief Technical Officer"):
        _, p, seniority = normalize_technical_title(title)
        assert p == 2, f"Expected P2 for '{title}', got {p}"
        assert seniority == "c_suite"

    # Priority 3: VP of Engineering, Head of Engineering, Director of Engineering
    for title in ("VP of Engineering", "Vice President of Engineering", "Head of Engineering", "Director of Engineering"):
        _, p, seniority = normalize_technical_title(title)
        assert p == 3, f"Expected P3 for '{title}', got {p}"
        assert seniority in ("vp", "director")

    # Priority 4: Engineering Managers, Tech Leads, AI Leads
    for title in ("Engineering Manager", "Technical Lead", "AI Engineering Lead", "Head of AI", "Lead AI Engineer"):
        _, p, seniority = normalize_technical_title(title)
        assert p == 4, f"Expected P4 for '{title}', got {p}"
        assert seniority in ("manager", "lead")


def test_classify_role_priority_startup_vs_enterprise():
    # Small startup (<= 50 employees)
    assert classify_role_priority("CEO", company_size="1-10") == 1
    assert classify_role_priority("CTO", company_size="11-50") == 2
    assert classify_role_priority("Head of Engineering", company_size=20) == 3
    assert classify_role_priority("Engineering Manager", company_size=15) == 4

    # Large company (> 50 employees): CTO and VP Eng prioritized over CEO/Founder
    assert classify_role_priority("CTO", company_size="51-200") == 1
    assert classify_role_priority("Head of Engineering", company_size="201-500") == 2
    assert classify_role_priority("Engineering Manager", company_size="500+") == 3
    assert classify_role_priority("Founder & CEO", company_size=250) == 4


def test_is_excluded_person_anti_confusion():
    # Former employees must be excluded
    assert is_excluded_person("Former CTO", context="") is True
    assert is_excluded_person("Co-Founder", context="Ex-founder who departed in 2021") is True
    assert is_excluded_person("Director of Engineering", context="Retired in 2020") is True

    # Advisors and Investors must be excluded
    assert is_excluded_person("Board Member & Investor", context="") is True
    assert is_excluded_person("Angel Investor", context="") is True
    assert is_excluded_person("Advisory Board Member", context="") is True
    assert is_excluded_person("Venture Partner", context="") is True

    # Subordinate roles must be excluded
    assert is_excluded_person("Executive Assistant to CEO", context="") is True
    assert is_excluded_person("Engineering Intern", context="") is True

    # Operating decision makers must NOT be excluded
    assert is_excluded_person("Chief Technology Officer", context="Leading the core AI team", domain="acme.ai") is False
    assert is_excluded_person("Head of Engineering", context="Building scalable software", domain="acme.ai") is False


def test_extract_from_card_with_linkedin():
    card_html = """
    <div class="team-card">
        <h3>Marcus Vance</h3>
        <span class="role">Chief Technology Officer</span>
        <p>Marcus oversees platform architecture and RAG pipelines.</p>
        <a href="https://www.linkedin.com/in/marcus-vance-ai" class="li-icon">LinkedIn Profile</a>
    </div>
    """
    extractor = DecisionMakerExtractor()
    dm = extractor.extract_from_card(
        card_html,
        page_url="https://synapse.ai/team",
        domain="synapse.ai",
        site_name="Synapse AI",
        company_size="10-50",
    )
    assert dm is not None
    assert dm.first_name == "Marcus"
    assert dm.last_name == "Vance"
    assert dm.title == "Chief Technology Officer"
    assert dm.role_priority == 2
    assert dm.linkedin_url == "https://www.linkedin.com/in/marcus-vance-ai"
    assert "platform architecture" in dm.evidence_snippet


def test_extract_from_site_pages_deduplication_and_ranking():
    home_page = (
        "https://neuralflow.io/",
        """
        <html><body>
        <h1>NeuralFlow AI</h1>
        <p>Founded by Elena Rostova and David Kim in 2023.</p>
        </body></html>
        """,
    )
    team_page = (
        "https://neuralflow.io/team",
        """
        <html><body>
        <div class="member">
            <h3>David Kim</h3>
            <p>CTO & Co-Founder</p>
            <a href="https://linkedin.com/in/david-kim-tech">LinkedIn</a>
        </div>
        <div class="member">
            <h3>Elena Rostova</h3>
            <p>CEO & Co-Founder</p>
        </div>
        <div class="member">
            <h3>Samantha Brooks</h3>
            <p>VP of Engineering</p>
        </div>
        <div class="member">
            <h3>Arthur Dent</h3>
            <p>Advisory Board Member</p>
        </div>
        </body></html>
        """,
    )

    extractor = DecisionMakerExtractor()
    dms = extractor.extract_from_site_pages(
        [home_page, team_page],
        domain="neuralflow.io",
        site_name="NeuralFlow",
        company_size="10-25",
    )

    names = [dm.full_name for dm in dms]
    assert "Elena Rostova" in names
    assert "David Kim" in names
    assert "Samantha Brooks" in names
    # Advisory board member Arthur Dent must be excluded
    assert "Arthur Dent" not in names

    # Ranking in small startup: P1 (Elena) first, P2 (David) second, P3 (Samantha) third
    elena = next(d for d in dms if d.full_name == "Elena Rostova")
    david = next(d for d in dms if d.full_name == "David Kim")
    samantha = next(d for d in dms if d.full_name == "Samantha Brooks")

    assert elena.role_priority in (1, 2)
    assert david.role_priority in (1, 2)
    assert samantha.role_priority == 3
    assert david.linkedin_url == "https://www.linkedin.com/in/david-kim-tech"


def test_build_search_queries():
    queries = DecisionMakerExtractor.build_search_queries("https://www.myagent.ai/about")
    assert any("myagent.ai founder" in q for q in queries)
    assert any('myagent.ai CTO' in q for q in queries)
    assert any('myagent.ai "Chief Technology Officer"' in q for q in queries)
    assert any('myagent.ai "Head of Engineering"' in q for q in queries)
