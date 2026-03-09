# NidhiAI

> **AI-Powered CSR Funding Access for Grassroots NGOs**

India mandates qualifying companies to spend **2% of average net profits** on CSR (Section 135, Companies Act 2013). In FY 2024-25 alone, **301 major companies spent ₹17,742 Crores** on CSR activities (CSRBOX ICOR 2025). The total annual CSR pool is estimated at **~₹38,000 Crores**.

Yet **3.7 million+ registered NGOs** (DARPAN Portal) compete for this funding - and the vast majority lose out because they can't afford compliance teams, grant writers, or legal advisors.

**NidhiAI automates the entire CSR funding lifecycle** - from document verification to grant discovery to proposal generation - using a multi-agent AI system built entirely on AWS.

🔗 **Live Demo**: [nidhi-ai.vercel.app](https://nidhi-ai.vercel.app)

---

## What It Does

| Step | What Happens | AWS Service |
|------|-------------|-------------|
| **1. Upload Documents** | NGO uploads 12A, 80G, CSR-1 certificates | S3 |
| **2. Compliance Check** | AI extracts fields via OCR, validates dates and registration numbers | Amazon Textract + Bedrock Agent |
| **3. Grant Discovery** | Semantic search matches NGO profile to corporate CSR programs | Bedrock Knowledge Bases + OpenSearch Serverless |
| **4. Proposal Drafting** | AI writes a formal 5-page grant proposal, livestreamed to screen | Bedrock Agent + RAG |
| **5. Impact Reports** | Generates quarterly donor reports with fund utilization and outcomes | Bedrock Agent (Amazon Nova Lite) |
| **6. CSR Chatbot** | Answers questions about Section 135, Schedule VII, FCRA, 12A/80G | Bedrock Knowledge Base |

**What takes 30 days and ₹50,000+ manually now takes 10 minutes at near-zero cost.**

---

## Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │           Amazon Bedrock Supervisor         │
                        │         (Multi-Agent Orchestration)         │
                        └──────┬──────┬──────────┬──────────┬────────┘
                               │      │          │          │
                    ┌──────────┘      │          │          └──────────┐
                    ▼                 ▼          ▼                     ▼
            ┌──────────────┐  ┌────────────┐  ┌──────────────┐  ┌───────────┐
            │  Compliance  │  │ Grant Scout│  │   Proposal   │  │  Impact   │
            │    Agent     │  │   Agent    │  │    Agent     │  │   Agent   │
            └──────┬───────┘  └─────┬──────┘  └──────┬───────┘  └─────┬─────┘
                   │                │                 │                │
            ┌──────▼───────┐  ┌─────▼──────┐  ┌──────▼───────┐  ┌────▼──────┐
            │   Textract   │  │  KB: CSR   │  │ KB: Proposal │  │  Bedrock  │
            │   (OCR)      │  │  Opps (OS) │  │ Templates    │  │  (Nova)   │
            └──────────────┘  └────────────┘  └──────────────┘  └───────────┘

    Frontend: Next.js 16 (Vercel)  │  Auth: Amazon Cognito  │  Storage: S3 + DynamoDB
    Region: ap-south-1 (Mumbai)    │  Compute: Lambda (x4)  │  Vector DB: OpenSearch
```

All orchestrated by the **Bedrock Supervisor Pattern** - the Supervisor agent routes user requests to the correct sub-agent, chains multi-step workflows, and synthesizes responses.

---

## AWS Services Used

| Service | Purpose |
|---------|---------|
| **Amazon Bedrock Agents** | Multi-agent orchestration using Supervisor Pattern (1 supervisor + 4 sub-agents) |
| **Amazon Bedrock Knowledge Bases** | 3 RAG knowledge bases - CSR laws, corporate CSR opportunities, proposal templates |
| **Anthropic Claude 3.5 Sonnet** (via Bedrock) | Primary foundation model for compliance reasoning and proposal generation |
| **Amazon Nova Lite** (via Bedrock) | Cost-effective model for grant matching and impact reports |
| **Amazon Titan Text Embeddings V2** | Text-to-vector embeddings for semantic search across all 3 knowledge bases |
| **Amazon Textract** | OCR + form extraction on scanned government certificates (12A, 80G, CSR-1) |
| **Amazon OpenSearch Serverless** | Vector database backing all Bedrock Knowledge Bases |
| **AWS Lambda** | 4 Python 3.12 functions - one per agent action group |
| **Amazon API Gateway** | REST API for frontend-to-backend communication |
| **Amazon S3** | Document storage (uploads, generated PDFs, KB source data) |
| **Amazon DynamoDB** | NGO profiles, compliance status, proposal metadata |
| **Amazon Cognito** | User authentication and session management |
| **Amazon CloudWatch** | Agent trace logging and Lambda monitoring |
| **AWS IAM** | Least-privilege execution roles for all services |

**Region**: `ap-south-1` (Mumbai) - data residency compliance for Indian NGOs.

---

## Key Technical Highlights

- **Real-time Streaming**: Proposal and report generation use server-side streaming - the AI output appears on screen as the model writes, so users see results immediately instead of waiting 15-20 seconds for a complete response.

- **Agent Trace Panel**: A built-in UI panel shows the Supervisor's decision-making live - which sub-agent was invoked, what Knowledge Base was queried, and what data was returned. Full transparency into the multi-agent orchestration.

- **100% Serverless**: Zero infrastructure to manage. Scales from 0 to millions of NGOs automatically. Costs nothing when idle.

- **3 Specialized Knowledge Bases**: Each KB targets a different domain - CSR legislation, corporate CSR filings, and winning proposal templates - backed by Titan Embeddings V2 and OpenSearch Serverless.

---

## Project Structure

```
NidhiAi/
├── backend/
│   ├── api/                    # API Gateway Lambda handler
│   ├── lambdas/
│   │   ├── scan_documents/     # Compliance Agent → Textract OCR
│   │   ├── match_grants/       # Grant Scout Agent → KB search
│   │   ├── generate_pdf/       # Proposal Agent → PDF generation
│   │   └── generate_report/    # Impact Agent → report generation
│   └── openapi/                # OpenAPI specs for agent action groups
├── frontend/
│   └── src/
│       ├── app/                # Next.js 16 pages (dashboard, upload, grants, proposals, reports, chatbot)
│       ├── components/         # Sidebar, AgentTrace, GrantCard, ThemeToggle
│       └── lib/                # API client, auth helpers
├── data/
│   ├── kb_csr_laws/            # Knowledge Base: Indian CSR legislation
│   ├── kb_csr_opportunities/   # Knowledge Base: Corporate CSR programs
│   └── kb_winning_proposals/   # Knowledge Base: Sample grant proposals
├── infra/                      # AWS infrastructure setup scripts
├── agent_system_prompts.md     # Production system prompts for all 5 Bedrock Agents
├── design.md                   # Technical design document
└── requirements.md             # Product requirements specification
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured with `ap-south-1` region
- AWS services deployed (Bedrock Agents, Lambda, API Gateway, S3, DynamoDB, Cognito)

### Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=<your-api-gateway-url>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<your-pool-id>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_SUPERVISOR_AGENT_ID=<your-agent-id>
```

---

## Cost

| Component | Monthly Cost |
|-----------|-------------|
| Lambda / API Gateway / DynamoDB | AWS Free Tier |
| Bedrock model inference | ~₹800 |
| S3 storage | < ₹50 |
| OpenSearch Serverless | Minimum capacity |
| **Total prototype spend to date** | **< ₹8,000** |
| **Projected production (100 NGOs)** | **~₹17,000/month** |

**5,000x cost reduction** per proposal compared to traditional grant writing (₹50,000+ vs < ₹10).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TailwindCSS |
| Backend | AWS Lambda (Python 3.12) |
| AI/ML | Amazon Bedrock Agents, Textract, Titan Embeddings V2 |
| Models | Claude 3.5 Sonnet, Amazon Nova Lite |
| Database | DynamoDB, OpenSearch Serverless |
| Auth | Amazon Cognito |
| Hosting | Vercel (frontend), AWS (backend) |

---

## Team Velox

**Solo Developer** 

Built for **AI for Bharat Hackathon 2026** · Track 03: AI for Communities, Access & Public Impact
