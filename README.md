# Outreacho — Autonomous AI Prospecting & Outreach Platform

<p align="center">
  <a href="https://github.com/vanshsingh3711-wq/Outreacho">
    <picture>
      <img src="docs/brand/sellbird-wordmark.svg" alt="Outreacho" width="280">
    </picture>
  </a>
</p>

<p align="center"><strong>The open-source autonomous prospecting and cold outreach platform powered by AI.</strong></p>

<p align="center">
Outreacho discovers target companies matching your ideal customer profile, uncovers key technical decision-makers (CTOs, VPs, Founders), uncovers their verified emails and social profiles (LinkedIn, 𝕏, GitHub), crafts hyper-personalized email pitches, and manages replies.
It runs locally on your machine, with strict human-in-the-loop review before any email is dispatched.
</p>

<p align="center">
  <a href="https://github.com/vanshsingh3711-wq/Outreacho"><img alt="GitHub" src="https://img.shields.io/badge/github-Outreacho-244b62?logo=github"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-244b62"></a>
  <img alt="Python 3.11+" src="https://img.shields.io/badge/python-3.11%2B-244b62?logo=python&logoColor=white">
</p>

---

## What Outreacho Does

Outreacho provides an end-to-end intelligent pipeline you can run autonomously or inspect at every stage:

| Stage | What Happens | Details |
|---|---|---|
| **Filtered Company Discovery** | Discovers companies filtered by industry, hiring signals, and tech stack (e.g., LangGraph, FastAPI, PyTorch). | `outreacho discover-companies` |
| **SSRF-Defended URL Enrichment** | Safely crawls target domains while blocking internal metadata services (`169.254.169.254`) and intranet probes. | `outreacho enrich <url>` |
| **Technical Decision-Maker Discovery** | Pinpoints engineering and executive leadership (CTO, VP Eng, Head of AI, Technical Founders), adapting priority by company size. | ICP Targeting |
| **Social Profile Intelligence** | Discovers LinkedIn, 𝕏 (Twitter), and GitHub profiles via semantic site scraping and search engine enrichment. | Social Badges |
| **Email Deliverability Verification** | Derives email patterns and validates addresses via Reoon, ZeroBounce, or Hunter. Never sends to invalid or risky inboxes without review. | Multi-tier Verification |
| **AI Proposal & Pitch Drafting** | Generates bespoke outreach proposals tailored to 4 career/business archetypes (Freelance, AI Engineering, Applied AI Roles, Agentic Automation). | DeepSeek AI / Claude |
| **Human-in-the-Loop Outbox** | All drafts enter `pending_review` in the Outbox. Zero automated cold sends occur without your explicit approval. | Outbox Review |
| **Autonomous Mail & Reply Loop** | Sends scheduled emails within daily throttles and office hours, tracks responses, handles objections, and flags interested leads. | `outreacho run` |

```
$ outreacho run

============================================================
Outreacho is online.
============================================================
Checking pipeline state...
Thinking with DeepSeek AI (deepseek-chat)
Decision: write_campaign (3 new prospects with no drafts)
  handler   → Elena Rostova, Cognitive Labs        interested, answer drafted
  handler   → Marcus Vance, HyperScale Systems      objection, answer drafted
  writer    → 2-email sequence: NextGen AI hiring an Applied AI Engineer
  outbox    → 5 emails waiting for your approval
Cycle complete. Sleeping for 15 minutes.
```

---

## 4 Specialized Outreach Archetypes

Outreacho includes out-of-the-box pitch and positioning engines for:

1. **Freelance Software Development**: Custom sprint capacity, full-stack systems, API engineering.
2. **AI Engineering Contracts**: Production LLMs, fine-tuning, evals, vector search, RAG architectures.
3. **Junior / Applied AI Developer Roles**: High-growth startups hiring AI/ML engineers.
4. **AI Automation & Multi-Agent Systems**: End-to-end automation, LangGraph pipelines, and autonomous workflows.

---

## Quick Start

### 1. Installation

```bash
git clone https://github.com/vanshsingh3711-wq/Outreacho.git
cd Outreacho

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install package and dependencies
pip install -e .

# Install headless Chromium for browser scraping (optional for LinkedIn)
playwright install chromium
```

### 2. Configure Credentials (`.env`)

Copy the example file and add your credentials:
```bash
cp .env.example .env
```

Key environment variables:
```ini
# AI Brain (DeepSeek recommended for fast, economical inference)
DEEPSEEK_API_KEY=sk-...

# Search & Enrichment (Google Search queries)
SERPER_API_KEY=...

# Email Verification (Pick one or more)
REOON_API_KEY=...
ZEROBOUNCE_API_KEY=...
HUNTER_API_KEY=...

# Sending Mailbox (Gmail OAuth recommended)
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
```

### 3. CLI Commands

```bash
# Discover high-intent companies matching your ICP criteria
outreacho discover-companies --industry "Artificial Intelligence" --role "AI Engineer" --tech "LangGraph" --limit 10

# Safely enrich a single target company domain
outreacho enrich https://agentic-solutions.io --json

# Launch the Web Dashboard
outreacho dashboard

# Start the background heartbeat loop
outreacho run
```

---

## Web Dashboard

Launch the local web dashboard anytime:
```bash
outreacho dashboard
```
Open the private local URL printed in your terminal (`http://127.0.0.1:5555/#token=...`).

### Dashboard Features:
* **Today Queue**: Live overview of emails to review, new replies, and pending decisions.
* **AI Discovery Tab**: Interactive discovery of target companies by tech stack and industry.
* **URL Enrichment Tab**: Safe on-demand URL analysis and decision-maker extraction.
* **Decision-Makers Tab**: Visual table of leadership contacts with direct social badges (LinkedIn, 𝕏, GitHub) and one-click proposal generation.
* **Outreach Prep Tab**: Review generated dossiers, pain points, and personalized emails.
* **Outbox**: The human-in-the-loop review desk. Approve (<kbd>A</kbd>), reject (<kbd>R</kbd>), or edit (<kbd>E</kbd>) drafts before sending.
* **Inboxes & Deliverability**: Monitor sending domain reputation, bounce rates, and connected mailboxes.

---

## Safety & Compliance

* **Zero Automated Sends**: Outgoing prospecting pitches strictly require human approval in the Outbox by default.
* **SSRF Protection**: Crawler blocks loops, private IP ranges (RFC 1918), and cloud provider metadata APIs (`169.254.169.254`).
* **Deliverability Safeguards**: Hard caps on hourly and daily sending, automated quiet-hours scheduling, and instant opt-out honoring.

---

## License

Outreacho is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Warmup on sending mailboxes can be managed with [TrulyInbox](https://trulyinbox.com/?via=sellbird).
