"""Unit tests for firmographic intelligence, company filtering, and hiring signals."""

import pytest
from outreach.firmographics import (
    FirmographicExtractor,
    FirmographicFilter,
    FirmographicProfile,
    classify_employee_tier,
    classify_revenue_tier,
    detect_ai_tech_stack,
    detect_business_model,
    detect_funding_stage,
    detect_industry,
    detect_location,
    parse_employee_count_from_text,
    parse_revenue_from_text,
)


def test_classify_employee_tier():
    assert classify_employee_tier(None) == "Unknown"
    assert classify_employee_tier(1) == "1-10"
    assert classify_employee_tier(10) == "1-10"
    assert classify_employee_tier(11) == "11-50"
    assert classify_employee_tier(50) == "11-50"
    assert classify_employee_tier(51) == "51-200"
    assert classify_employee_tier(200) == "51-200"
    assert classify_employee_tier(201) == "201-500"
    assert classify_employee_tier(500) == "201-500"
    assert classify_employee_tier(501) == "500+"
    assert classify_employee_tier(10000) == "500+"


def test_classify_revenue_tier():
    assert classify_revenue_tier(None) == "Unknown"
    assert classify_revenue_tier(50_000) == "<$100K"
    assert classify_revenue_tier(250_000) == "$100K-$500K"
    assert classify_revenue_tier(750_000) == "$500K-$1M"
    assert classify_revenue_tier(2_500_000) == "$1M-$5M"
    assert classify_revenue_tier(7_500_000) == "$5M-$10M"
    assert classify_revenue_tier(25_000_000) == "$10M-$50M"
    assert classify_revenue_tier(100_000_000) == "$50M+"


def test_parse_employee_count_from_text():
    # Exact team count
    count, est = parse_employee_count_from_text("We are a team of 45 engineers in San Francisco.")
    assert count == 45
    assert not est

    # Stated with 'over'
    count, est = parse_employee_count_from_text("Over 150 employees across 4 continents.")
    assert count == 150
    assert est

    # Range
    count, est = parse_employee_count_from_text("A growing team of 20-40 employees building the future.")
    assert count == 30
    assert est

    # Unknown
    count, est = parse_employee_count_from_text("Welcome to our corporate website.")
    assert count is None
    assert not est


def test_parse_revenue_from_text():
    amt, curr, est = parse_revenue_from_text("We crossed $3.2M ARR in 2025.")
    assert amt == 3_200_000.0
    assert curr == "USD"
    assert not est

    amt, curr, est = parse_revenue_from_text("Generating €800k in annual recurring revenue.")
    assert amt == 800_000.0
    assert curr == "EUR"

    amt, curr, est = parse_revenue_from_text("Our platform provides cutting edge solutions.")
    assert amt is None


def test_detect_funding_stage():
    stage, amt, _ = detect_funding_stage("We recently raised a $2.5M Seed round from top angel investors.")
    assert stage == "Seed"
    assert "$2.5M" in amt

    stage, amt, _ = detect_funding_stage("Announcing our $18M Series A to scale our AI agent platform.")
    assert stage == "Series A"
    assert "$18M" in amt

    stage, _, _ = detect_funding_stage("We are 100% bootstrapped and customer-funded.")
    assert stage == "Bootstrapped"

    stage, _, _ = detect_funding_stage("Welcome to our software company.")
    assert stage == "Unknown"


def test_detect_business_model():
    agency_html = """
    <h1>Digital Software Agency</h1>
    <p>We provide custom software development and staff augmentation services.</p>
    <p>Check out our client projects and case studies. Hire our team for bespoke development.</p>
    """
    assert detect_business_model(agency_html) == "agency"

    product_html = """
    <h1>AI Voice Agent Platform</h1>
    <p>Try our SaaS platform free. Sign up for free trial or book a demo.</p>
    <p>Check our pricing plan: Starter, Pro, and Enterprise monthly subscriptions.</p>
    """
    assert detect_business_model(product_html) == "product"


def test_detect_ai_tech_stack():
    html = """
    <html>
      <body>
        <p>Built with FastAPI and LangChain for orchestration.</p>
        <p>Vector database powered by Qdrant and OpenAI embeddings.</p>
        <script src="https://cdn.example.com/app.js"></script>
      </body>
    </html>
    """
    techs = detect_ai_tech_stack(html)
    assert "FastAPI" in techs
    assert "LangChain" in techs
    assert "OpenAI" in techs
    assert "Qdrant" in techs


def test_detect_location():
    json_ld_html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "NeuroTech AI",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Berlin",
            "addressRegion": "Berlin",
            "addressCountry": "Germany"
          }
        }
        </script>
      </head>
      <body>
        <p>We are a 100% remote-first company.</p>
      </body>
    </html>
    """
    loc = detect_location(json_ld_html)
    assert loc["city"] == "Berlin"
    assert loc["country"] == "Germany"
    assert loc["is_remote_friendly"] is True
    assert "Berlin, Berlin, Germany" in loc["formatted_location"]


@pytest.mark.asyncio
async def test_firmographic_extraction_workflow():
    pages = [
        (
            "https://ai-agents-corp.com",
            """
            <html>
              <head><title>AI Agents Corp</title></head>
              <body>
                <h1>Autonomous Agent Frameworks</h1>
                <p>We build generative AI agents with LangGraph and PyTorch.</p>
                <p>We are a team of 28 engineers based in Munich, Germany.</p>
                <p>Raised a $3.5M Seed round.</p>
                <p>We are fully remote.</p>
              </body>
            </html>
            """,
        ),
        (
            "https://ai-agents-corp.com/careers",
            """
            <html>
              <body>
                <h2>Join Our Engineering Team</h2>
                <div class="job">
                  <h3>Applied AI Engineer</h3>
                  <p>Build multi-agent workflows using LangGraph and Python.</p>
                </div>
                <div class="job">
                  <h3>Python Backend Engineer</h3>
                  <p>Develop scalable APIs with FastAPI.</p>
                </div>
              </body>
            </html>
            """,
        ),
    ]

    extractor = FirmographicExtractor()
    profile = await extractor.extract_firmographics(pages, domain="ai-agents-corp.com")

    assert profile.employee_count == 28
    assert profile.employee_tier == "11-50"
    assert profile.funding_stage == "Seed"
    assert profile.is_remote_friendly is True
    assert "Applied AI Engineer" in profile.hiring_target_roles
    assert "Python Backend Engineer" in profile.hiring_target_roles
    assert "LangGraph" in profile.ai_tech_stack
    assert "PyTorch" in profile.ai_tech_stack
    assert len(profile.observations) >= 4

    # Verify filter matching
    flt_match = FirmographicFilter(
        employee_tiers=["11-50", "51-200"],
        funding_stages=["Seed", "Series A"],
        hiring_roles=["Applied AI Engineer"],
        remote_only=True,
    )
    is_match, reasons = flt_match.matches(profile)
    assert is_match is True
    assert len(reasons) >= 3

    # Verify filter rejection
    flt_reject = FirmographicFilter(
        employee_tiers=["500+"],
    )
    is_match_rej, rej_reasons = flt_reject.matches(profile)
    assert is_match_rej is False
    assert "not in allowed" in rej_reasons[0]
