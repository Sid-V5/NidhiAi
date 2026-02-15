# NidhiAI (निधिAI) 🏆

**Bridging the ₹38,000 Cr CSR funding gap for India's 3M+ grassroots NGOs.**

## Overview
NidhiAI is an agentic AI platform designed to democratize access to Corporate Social Responsibility (CSR) funds. It automates:
1.  **Grant Discovery** - Semantic search for relevant CSR opportunities.
2.  **Compliance Checking** - Automated verification of 12A/80G/CSR-1 certificates.
3.  **Proposal Writing** - Generative AI writing of winning grant proposals.

## Architecture
Built on **AWS Bedrock Multi-Agent System** using a Supervisor Pattern.
- **Supervisor Agent**: Orchestrates workflows.
- **Compliance Agent**: Validates docs using Amazon Textract.
- **Grant Scout Agent**: Finds grants using OpenSearch Serverless.
- **Proposal Agent**: Writes proposals using Claude 3.5 Sonnet.

## Repository Contents
- `requirements.md`: full product specifications.
- `design.md`: technical architecture, API specs, and data models.

*Submission for AI for Bharat Hackathon 2026.*
