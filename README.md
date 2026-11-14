# Outreacho — Autonomous AI Prospecting & Cold Outreach Platform

<p align="center">
  <a href="https://github.com/vanshsingh3711-wq/Outreacho">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/brand/outreacho-wordmark-white.svg">
      <img src="docs/brand/outreacho-wordmark.svg" alt="Outreacho" width="300">
    </picture>
  </a>
</p>

<p align="center"><strong>The open-source autonomous prospecting and cold outreach platform powered by AI.</strong></p>

<p align="center">
  Outreacho discovers target companies matching your ideal customer profile, uncovers key technical decision-makers (CTOs, VPs of Engineering, Heads of AI, Founders), reveals their verified emails and social profiles (LinkedIn, 𝕏 / Twitter, GitHub), crafts hyper-personalized email pitches using DeepSeek AI, and orchestrates deliverability.
  It runs locally on your machine with a strict <strong>human-in-the-loop review desk</strong>: zero cold emails are ever sent without your explicit approval.
</p>

<p align="center">
  <a href="https://github.com/vanshsingh3711-wq/Outreacho"><img alt="GitHub" src="https://img.shields.io/badge/github-Outreacho-2563EB?logo=github"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-0F172A"></a>
  <img alt="Python 3.11+" src="https://img.shields.io/badge/python-3.11%2B-0284C7?logo=python&logoColor=white">
  <img alt="DeepSeek AI" src="https://img.shields.io/badge/AI-DeepSeek%20%7C%20Claude-6366F1">
  <img alt="Zero Automated Sends" src="https://img.shields.io/badge/Safety-Human%20in%20the%20Loop-10B981">
</p>

---

## Table of Contents

- [Core Capabilities](#core-capabilities)
- [How It Works](#how-it-works)
- [4 Specialized Outreach Archetypes](#4-specialized-outreach-archetypes)
- [Quick Start](#quick-start)
  - [1. Installation](#1-installation)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Profile & ICP Configuration](#3-profile--icp-configuration)
- [CLI Command Reference](#cli-command-reference)
- [Web Dashboard](#web-dashboard)
- [Multi-Provider Intelligence Stack](#multi-provider-intelligence-stack)
- [Safety, Security & Deliverability](#safety-security--deliverability)
- [License & Credits](#license--credits)

---

## Core Capabilities

| Capability | What Outreacho Does | CLI / Interface |
|---|---|---|
| **High-Intent Discovery** | Finds targeted companies by industry, job postings, location, and modern AI tech stack (e.g. LangGraph, FastAPI, PyTorch, Qdrant). | `outreacho discover-companies` |
| **SSRF-Defended URL Enrichment** | Safely crawls corporate websites (Home, About, Team, Careers) with hardened defense against loopbacks, RFC-1918 subnets, and cloud metadata (`169.254.169.254`). | `outreacho enrich <url>` |
| **Decision-Maker Intelligence** | Identifies technical leadership (CTO, VP Eng, Head of AI, Technical Co-Founders), automatically adapting seniority priorities based on company size. | ICP Scoring Engine |
| **Social Profile Uncovering** | Discovers LinkedIn, 𝕏 (Twitter), and GitHub profiles via website semantic parsing and targeted search queries. | Leadership Contact Cards |
| **Multi-Provider Verification** | Derives company email patterns and verifies deliverability via Reoon, ZeroBounce, Hunter, or native MX handshake checks before anything enters the queue. | Multi-tier Verification |
| **DeepSeek AI Personalization** | Leverages DeepSeek LLMs (`deepseek-chat` / `deepseek-reasoner`) for nuanced title normalization, team extraction, and bespoke pitch tailoring (with 100% heuristic fallback). | DeepSeek Client |
| **Human-in-the-Loop Outbox** | All drafted proposals land in `pending_review`. You approve (<kbd>A</kbd>), reject (<kbd>R</kbd>), or edit (<kbd>E</kbd>) each email. Zero automated cold sends occur without human consent. | Review Outbox |
| **Autonomous Mailbox Loop** | Sends approved emails within configured daily limits and recipient office hours, listens for inbound replies, categorizes objections, and alerts you when a lead is interested. | `outreacho run` |

---

## How It Works

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           1. TARGET & DISCOVER                         │
  │   ICP Criteria (Industry, Roles, AI Stack: LangGraph, FastAPI, etc.)  │
  │                  └─► Filtered Discovery / Search Engine                │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                         2. SAFELY ENRICH URL                           │
  │     SSRF Defense ──► Crawl About, Team, Careers ──► Firmographics      │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                   3. UNCOVER LEADERSHIP & SOCIALS                      │
  │   Extract CTO, VP Eng, Founders ──► Find LinkedIn, 𝕏, GitHub profiles   │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 4. VERIFY DELIVERABILITY & ADDRESS                     │
  │   Derive Pattern ({first}.{last}) ──► Reoon / ZeroBounce / Hunter / MX  │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                   5. CRAFT HYPER-PERSONALIZED PITCH                    │
  │    DeepSeek AI Intelligence ──► Bespoke Hook & Anti-Fluff Value Prop   │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                     6. HUMAN-IN-THE-LOOP OUTBOX                        │
  │     Status: pending_review ──► [A] Approve  [R] Reject  [E] Edit       │
  │            (Zero cold emails leave without explicit approval)          │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                      7. SEND & HANDLE RESPONSES                        │
  │   Gmail / Microsoft / SMTP ──► Inbound Reply & Objection Handler       │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 4 Specialized Outreach Archetypes

Outreacho generates hyper-targeted pitches aligned with 4 distinct career and business positioning profiles:

1. **Freelance Software Development**:
   - Focus: Overflow development bandwidth, rapid prototype execution, full-stack web and backend implementations.
   - Angle: High-velocity delivery with zero overhead for digital agencies and product teams.
2. **Contract Applied AI Engineering**:
   - Focus: Production LLM integration, custom RAG pipelines, fine-tuning, latency optimization, and vector search architectures.
   - Angle: Concrete AI engineering capabilities solving active hiring crunches.
3. **Junior / Applied AI Developer Employment**:
   - Focus: Proactive career pitch tailored to high-growth startups hiring AI/ML talent.
   - Angle: Hands-on project portfolio, rapid ramp-up ability, and deep enthusiasm for the company's technical stack.
4. **AI Automation & Agentic Workflows**:
   - Focus: Multi-agent systems (e.g. LangGraph), automated internal operations, CRM/ERP workflow integrations.
   - Angle: Measurable operational hours saved and elimination of manual bottlenecks.

---

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/vanshsingh3711-wq/Outreacho.git
cd Outreacho

# Create and activate a Python 3.11+ virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Outreacho in editable mode
pip install -e .

# (Optional) Install Playwright Chromium for advanced browser rendering
playwright install chromium
```

### 2. Environment Configuration

Copy the example environment configuration:
```bash
cp .env.example .env
```

Open `.env` and add your API keys:

```ini
# ==============================================================================
# AI Brain (DeepSeek LLM recommended for fast, cost-effective inference)
# ==============================================================================
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
# Claude alternative (optional):
# ANTHROPIC_API_KEY=sk-ant-...

# ==============================================================================
# Web Search & Discovery Engine
# ==============================================================================
SERPER_API_KEY=...
# Optional alternatives:
# DATAFORSEO_LOGIN=...
# DATAFORSEO_PASSWORD=...
# SCAVIO_API_KEY=...

# ==============================================================================
# Email Verification Providers (Pick one or more)
# ==============================================================================
REOON_API_KEY=...
ZEROBOUNCE_API_KEY=...
HUNTER_API_KEY=...

# ==============================================================================
# Sending Mailbox (Gmail OAuth, Microsoft 365, or SMTP)
# ==============================================================================
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
# Or Microsoft:
# MICROSOFT_CLIENT_ID=...
# Or custom SMTP:
# SMTP_HOST=smtp.yourdomain.com
# SMTP_PORT=587
# SMTP_USER=alex@yourdomain.com
# SMTP_PASSWORD=...
```

### 3. Profile & ICP Configuration

Outreacho reads your positioning, ICP criteria, and product details from `outreacho.yaml` (or `outreacho.local.yaml`):

```yaml
persona:
  name: "Alex"
  company: "Apex AI Studio"
  role: "Applied AI Engineer"
  email: "alex@apex-ai.studio"
  linkedin: "linkedin.com/in/alex-dev"
  tone: "concise, engineering-led, consultative"

product:
  name: "Custom AI & Agentic Systems"
  description: "Production LLM backends, LangGraph multi-agent automation, and high-performance RAG pipelines."
  key_benefits:
    - "Production-ready AI backends deployed in weeks, not quarters"
    - "Elimination of repetitive manual workflows with reliable multi-agent systems"
    - "Direct integration into existing FastAPI, PostgreSQL, and cloud stacks"
  offer:
    primary: "14-day AI prototype sprint"
    goal: "book_call"
    booking_url: "https://cal.com/alex-dev/15min"

icp:
  industries:
    - "Artificial Intelligence"
    - "B2B SaaS"
    - "Digital Health"
  titles:
    - "Chief Technology Officer"
    - "VP of Engineering"
    - "Head of AI"
    - "Co-Founder & CTO"
```

---

## CLI Command Reference

Outreacho provides a complete suite of command-line tools for every phase of outreach:

### 1. Launch the Web Dashboard
```bash
outreacho dashboard
```
Opens your private local web interface (`http://127.0.0.1:5555/#token=...`).

### 2. Discover Target Companies
```bash
# Discover high-intent companies filtered by criteria
outreacho discover-companies \
  --industry "Artificial Intelligence" \
  --role "Applied AI Engineer" \
  --tech "LangGraph" \
  --location "Remote" \
  --limit 10
```

### 3. Safely Enrich a Specific Domain
```bash
# Analyze website, extract tech stack, hiring signals, and decision-makers
outreacho enrich https://agentic-solutions.io --json
```

### 4. Run the Autonomous Outreach Heartbeat
```bash
# Start background worker for approval queues, sending windows, and reply tracking
outreacho run
```

### 5. Check Pipeline Health & Metrics
```bash
outreacho status
```

---

## Web Dashboard

The local web dashboard provides an interactive mission control for your outreach operations:

```bash
outreacho dashboard
```

### Dashboard Tabs:
- **Today Queue**: Real-time snapshot of drafted emails awaiting review, new inbound replies, and deliverability health.
- **AI Discovery**: Visual company search engine filtered by industry, hiring triggers, and technology stack.
- **URL Enrichment**: On-demand single-domain inspector with live SSRF defenses and firmographic extraction.
- **Decision-Makers**: Full table of leadership contacts featuring:
  - Role priority ranking ($P_1$ to $P_4$)
  - Direct social badges (<kbd>LinkedIn</kbd>, <kbd>𝕏</kbd>, <kbd>GitHub</kbd>)
  - Verified deliverability indicators
  - One-click proposal generator across 4 opportunity profiles
- **Outreach Prep**: Deep-dive dossier view displaying pain points, company tech stack, and pitch angles.
- **Outbox Review**: The human-in-the-loop review desk.
  - Keyboard shortcuts: <kbd>A</kbd> Approve, <kbd>R</kbd> Reject, <kbd>E</kbd> Edit draft.
- **Inboxes & Deliverability**: Mailbox health, bounce tracking, daily sending throttles, and warmup status.

---

## Multi-Provider Intelligence Stack

Outreacho integrates with best-of-breed providers while maintaining total portability:

| Category | Supported Providers | Role in Outreacho |
|---|---|---|
| **AI Brain** | DeepSeek (`deepseek-chat`, `deepseek-reasoner`), Anthropic Claude | Title normalization, decision-maker extraction, hyper-personalized pitch drafting. |
| **Search & Discovery** | Serper (Google Search), DataForSEO, Scavio, OpenStreetMap | Company discovery, executive search, profile scraping. |
| **Email Verification** | Reoon, ZeroBounce, Hunter, Native MX Handshake | Dual-stage verification to protect domain reputation and prevent bounces. |
| **Social Intelligence** | LinkedIn, 𝕏 (Twitter), GitHub | Decision-maker social verification and multi-channel context. |
| **Mail Infrastructure** | Gmail API (OAuth), Microsoft 365, Standard SMTP/IMAP | Reliable sending with throttling, office-hours enforcement, and reply tracking. |

---

## Safety, Security & Deliverability

1. **Zero Automated Cold Sends**:
   - All outgoing cold emails are placed in `pending_review` status.
   - The automated sending engine strictly ignores unapproved items until you review and confirm them.
2. **SSRF Defense Architecture**:
   - The crawler strictly prohibits requests to loopback addresses (`127.0.0.0/8`), RFC-1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local addresses, and cloud provider metadata APIs (`169.254.169.254`).
   - Non-HTTP/HTTPS protocols (`file://`, `gopher://`, `ftp://`) and non-standard web ports are rejected upfront.
3. **Domain Reputation & Warmup**:
   - Hard rate limits on hourly and daily email dispatch.
   - Automated quiet hours (sends only during the recipient's local business hours).
   - Dedicated mailbox warmup integration with [TrulyInbox](https://trulyinbox.com/?via=sellbird).
   - Automatic bounce detection and immediate suppression.

---

## License & Credits

Outreacho is open-source software licensed under the [GNU Affero General Public License v3.0](LICENSE).

Warmup on sending mailboxes can be managed with [TrulyInbox](https://trulyinbox.com/?via=sellbird).
