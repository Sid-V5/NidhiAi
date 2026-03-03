# NidhiAI - AI-Powered CSR Funding for Indian NGOs

> Bridging India's Rs 38,000 Cr CSR Funding Gap with AI

NidhiAI is a serverless platform that helps Indian NGOs access Corporate Social Responsibility (CSR) funding through automated compliance checking, intelligent grant discovery, and AI-powered proposal generation. Built on AWS Bedrock's multi-agent architecture.

**Built for AI for Bharat Hackathon 2026 | Track 03 - AI for Communities, Access & Public Impact**

## Architecture

```
NGO User -> Next.js Frontend -> API Gateway -> Bedrock Supervisor Agent
                                                    |
                               +---------+----------+----------+
                               |         |          |          |
                          Compliance  Grant Scout  Proposal  Impact
                            Agent      Agent       Agent     Agent
                               |         |          |          |
                          Textract   OpenSearch    Bedrock    Bedrock
                               |      (KB RAG)      |          |
                             S3/DDB    Bedrock     S3/PDF    S3/PDF
```

## AWS Services Used

| Service | Purpose |
|---------|---------|
| **Amazon Bedrock Agents** | Multi-agent orchestration (Supervisor Pattern) |
| **Amazon Bedrock KB** | RAG over CSR laws, opportunities, and proposals |
| **Amazon Textract** | OCR for compliance document verification |
| **Amazon OpenSearch Serverless** | Vector store for knowledge base embeddings |
| **Amazon S3** | Document storage and generated PDFs |
| **Amazon DynamoDB** | NGO profiles, compliance status, proposals |
| **Amazon Cognito** | User authentication |
| **AWS Lambda** | Serverless compute for all backend logic |
| **Amazon API Gateway** | REST API endpoints |
| **Amazon Titan Embeddings v2** | Text embeddings for semantic search |

## Core Features

1. **Compliance Check** - Upload 12A, 80G, CSR-1 certificates -> Textract scans -> validates dates and status
2. **Grant Discovery** - AI searches 3 knowledge bases to match NGOs with relevant CSR grants from corporate filings
3. **Proposal Generation** - Generates professional 5-page PDF grant proposals tailored to specific grants
4. **Impact Reports** - Quarterly reports aggregating compliance, grants, and proposal activity for donors
5. **CSR Chatbot** - Ask any CSR-related question, powered by Bedrock Supervisor Agent
6. **Agent Trace** - Real-time visualization of multi-agent orchestration

## Project Structure

```
NidhiAi/
  backend/
    api/          # API Gateway Lambda (gateway.py)
    lambdas/      # Specialized Lambda functions
      scan_documents/    # Compliance Agent (Textract)
      match_grants/      # Grant Scout Agent (KB search)
      generate_pdf/      # Proposal Agent (PDF generation)
      generate_report/   # Impact Agent (report generation)
    openapi/      # API specifications
  frontend/
    src/
      app/        # Next.js pages (dashboard, upload, grants, etc.)
      components/ # Sidebar, AgentTrace, GrantCard
      lib/        # API client, auth helpers
  data/
    kb_csr_laws/         # Knowledge Base: CSR legislation PDFs
    kb_csr_opportunities/# Knowledge Base: Corporate CSR reports
    kb_winning_proposals/# Knowledge Base: Sample proposals
    test/                # Test documents for compliance scanning
  infra/                 # Infrastructure setup scripts
  design.md              # Technical design document
  requirements.md        # Product requirements (17 requirements)
```

## Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured with ap-south-1 region
- AWS services deployed (Bedrock Agents, Lambda, API Gateway, S3, DynamoDB)

### Frontend
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

## Agents & Knowledge Bases

| Agent | Model | Action Group Lambda |
|-------|-------|-------------------|
| Supervisor | Claude Haiku 3.5 | nidhiai-api-gateway |
| Compliance | Claude Haiku 3.5 | nidhiai-scan-documents |
| Grant Scout | Amazon Nova Lite | nidhiai-match-grants |
| Proposal | Claude Haiku 3.5 | nidhiai-generate-pdf |
| Impact | Claude Haiku 3.5 | nidhiai-generate-report |

| Knowledge Base | Source Data | Embedding Model |
|---------------|------------|-----------------|
| CSR Laws | MCA.gov.in PDFs, Companies Act | Titan Text Embeddings v2 |
| CSR Opportunities | Corporate CSR annual reports | Titan Text Embeddings v2 |
| Winning Proposals | Sample grant proposals | Titan Text Embeddings v2 |

## User Flow

```
Landing Page -> Sign In / Try Demo -> NGO Profile Setup ->
Dashboard (overview) -> Upload Documents (12A, 80G, CSR-1) ->
Compliance Check -> Find Grants -> Generate Proposal ->
Download PDF -> Impact Reports -> CSR Chatbot
```

## Cost Strategy

- Development: Claude Haiku 3.5 (cost-effective)
- Demo: Switch to Claude Sonnet 4.6 (config change only)
- Grant Scout: Amazon Nova Lite (cheapest for RAG)
- Total budget: $100 AWS Credits

## Tech Stack

- **Frontend**: Next.js 16, React, Tailwind CSS
- **Backend**: AWS Lambda (Python 3.12)
- **AI/ML**: Amazon Bedrock, Textract, Titan Embeddings
- **Database**: DynamoDB, OpenSearch Serverless
- **Auth**: Amazon Cognito
- **API**: Amazon API Gateway (REST)

## Team

Solo participant - AI for Bharat Hackathon 2026
