# Requirements Document: NidhiAI Platform

## Introduction

NidhiAI is a B2B SaaS platform designed to help Indian NGOs access CSR (Corporate Social Responsibility) funding by automating legal compliance checking, grant discovery, and proposal writing. The platform addresses the critical challenge that small NGOs face in accessing ₹38,000 Cr of available CSR funds due to compliance complexity, information asymmetry, and language barriers.

The system uses a Multi-Agent System architecture built on AWS Bedrock, with a Supervisor Agent orchestrating four specialized agents: Compliance Agent, Grant Scout Agent, Proposal Agent, and Impact Agent.

## Glossary

- **NGO**: Non-Governmental Organization - the primary user of the platform
- **CSR**: Corporate Social Responsibility - mandatory corporate giving under Section 135 of Indian Companies Act
- **Platform**: The NidhiAI system
- **Compliance_Agent**: Specialized agent that validates NGO legal documents
- **Grant_Scout_Agent**: Specialized agent that discovers matching CSR opportunities
- **Proposal_Agent**: Specialized agent that generates grant proposals
- **Impact_Agent**: Specialized agent that generates impact reports
- **Supervisor_Agent**: Orchestrating agent that coordinates specialized agents
- **User**: An NGO representative using the platform
- **Document**: Legal certificate (12A, 80G, or CSR-1) uploaded by NGO
- **Grant**: CSR funding opportunity from a corporation
- **Knowledge_Base**: Vector database of corporate CSR priorities and opportunities
- **Proposal**: Generated PDF document requesting CSR funding

## Requirements

### Requirement 1: User Authentication and Registration

**User Story:** As an NGO representative, I want to create an account and log in securely, so that I can access the platform's services.

#### Acceptance Criteria

1. WHEN a new user visits the platform, THE Platform SHALL provide a sign-up interface
2. WHEN a user submits valid registration credentials, THE Platform SHALL create a new user account
3. WHEN a user submits invalid registration credentials, THE Platform SHALL return a descriptive error message
4. WHEN an existing user provides valid login credentials, THE Platform SHALL authenticate the user and grant access
5. WHEN a user provides invalid login credentials, THE Platform SHALL reject the authentication attempt and return an error message

### Requirement 2: NGO Profile Management

**User Story:** As an NGO representative, I want to complete my organization's profile, so that the platform can provide personalized services.

#### Acceptance Criteria

1. WHEN a user completes registration, THE Platform SHALL prompt the user to complete their NGO profile
2. THE Platform SHALL require NGO Name, PAN Card number, and Sector as mandatory profile fields
3. WHEN a user submits a complete profile, THE Platform SHALL validate the PAN Card format
4. WHEN a user submits an invalid PAN Card format, THE Platform SHALL reject the submission and return a validation error
5. WHEN a user submits a valid profile, THE Platform SHALL store the profile data securely

### Requirement 3: Document Upload and Storage

**User Story:** As an NGO representative, I want to upload my legal compliance documents, so that the platform can verify my eligibility for CSR grants.

#### Acceptance Criteria

1. THE Platform SHALL accept PDF and image file uploads for 12A, 80G, and CSR-1 certificates
2. WHEN a user uploads a document, THE Platform SHALL store the document securely in Amazon S3
3. WHEN a user uploads a file exceeding 10MB, THE Platform SHALL reject the upload and return a size limit error
4. WHEN a user uploads a file with an unsupported format, THE Platform SHALL reject the upload and return a format error
5. THE Platform SHALL associate uploaded documents with the user's NGO profile

### Requirement 4: Document Text Extraction

**User Story:** As the system, I want to extract text from uploaded documents, so that I can validate compliance information.

#### Acceptance Criteria

1. WHEN a document is uploaded, THE Compliance_Agent SHALL invoke Amazon Textract to extract text
2. WHEN Amazon Textract successfully processes a document, THE Compliance_Agent SHALL receive the extracted text
3. WHEN Amazon Textract fails to process a document, THE Compliance_Agent SHALL log the error and notify the user
4. THE Compliance_Agent SHALL extract validity dates from the document text
5. WHEN validity dates cannot be extracted, THE Compliance_Agent SHALL flag the document for manual review

### Requirement 5: Compliance Validation

**User Story:** As an NGO representative, I want the platform to validate my compliance documents, so that I know if my certificates are current and valid.

#### Acceptance Criteria

1. WHEN validity dates are extracted from a document, THE Compliance_Agent SHALL compare them against the current date
2. WHEN a document's validity date is in the future, THE Compliance_Agent SHALL mark the document as valid
3. WHEN a document's validity date has passed, THE Compliance_Agent SHALL flag the document as expired
4. WHEN a document is flagged as expired, THE Platform SHALL notify the user with the expiration date
5. THE Compliance_Agent SHALL achieve validation accuracy based on successfully extracted text fields with confidence scores above 90%

### Requirement 6: Grant Discovery Query

**User Story:** As an NGO representative, I want to search for grants matching my cause, so that I can find relevant funding opportunities.

#### Acceptance Criteria

1. THE Platform SHALL provide a search interface for grant discovery
2. WHEN a user submits a query "Find grants for [Cause]", THE Grant_Scout_Agent SHALL process the query
3. WHEN processing a grant query, THE Grant_Scout_Agent SHALL perform semantic search against the Knowledge_Base
4. THE Grant_Scout_Agent SHALL return a ranked list of 3 to 5 matching grant opportunities
5. WHEN no matching grants are found, THE Grant_Scout_Agent SHALL return an empty result with a helpful message

### Requirement 7: Knowledge Base Management

**User Story:** As the system, I want to maintain an up-to-date knowledge base of CSR opportunities, so that I can provide accurate grant recommendations.

#### Acceptance Criteria

1. THE Platform SHALL maintain a Knowledge_Base of corporate CSR priorities in OpenSearch Serverless
2. THE Platform SHALL store grant information as vector embeddings for semantic search
3. WHEN new grant information is added, THE Platform SHALL generate embeddings using Amazon Bedrock
4. THE Knowledge_Base SHALL include grant details such as corporation name, focus areas, funding amounts, and eligibility criteria
5. THE Platform SHALL support updates to the Knowledge_Base without service interruption

### Requirement 8: Proposal Generation

**User Story:** As an NGO representative, I want to generate a professional grant proposal, so that I can apply for CSR funding efficiently.

#### Acceptance Criteria

1. WHEN a user selects a grant and requests proposal generation, THE Proposal_Agent SHALL accept Grant ID and NGO Details as input
2. THE Proposal_Agent SHALL generate a proposal containing an Executive Summary, Problem Statement, Budget Table, and Impact Metrics
3. THE Proposal_Agent SHALL format the proposal as a 5-page PDF document
4. WHEN proposal generation is initiated, THE Proposal_Agent SHALL complete generation within 60 seconds
5. WHEN proposal generation completes, THE Platform SHALL provide the PDF for download

### Requirement 9: Proposal Content Quality

**User Story:** As an NGO representative, I want my generated proposals to be comprehensive and professional, so that they have a high chance of approval.

#### Acceptance Criteria

1. THE Proposal_Agent SHALL include an Executive Summary that summarizes the NGO's mission and the requested funding
2. THE Proposal_Agent SHALL include a Problem Statement that articulates the social issue being addressed
3. THE Proposal_Agent SHALL include a Budget Table with itemized costs and justifications
4. THE Proposal_Agent SHALL include Impact Metrics that quantify expected outcomes
5. THE Proposal_Agent SHALL tailor the proposal content to match the selected grant's focus areas

### Requirement 10: CSR Assistant Chatbot

**User Story:** As an NGO representative, I want to ask questions about CSR laws and regulations, so that I can understand compliance requirements.

#### Acceptance Criteria

1. THE Platform SHALL provide an integrated chatbot interface powered by Amazon Q
2. WHEN a user asks a question about CSR laws, THE Platform SHALL return an accurate answer
3. THE Platform SHALL answer questions such as "What is FCRA limit?" with relevant regulatory information
4. WHEN a user asks a question outside the CSR domain, THE Platform SHALL politely indicate the question is out of scope
5. THE Platform SHALL maintain conversation context for follow-up questions

### Requirement 11: Multi-Agent Orchestration

**User Story:** As the system, I want to coordinate multiple specialized agents efficiently, so that I can provide integrated services to users.

#### Acceptance Criteria

1. THE Supervisor_Agent SHALL orchestrate the Compliance_Agent, Grant_Scout_Agent, Proposal_Agent, and Impact_Agent
2. WHEN a user request requires multiple agents, THE Supervisor_Agent SHALL determine the execution sequence
3. THE Supervisor_Agent SHALL pass outputs from one agent as inputs to dependent agents
4. WHEN an agent fails, THE Supervisor_Agent SHALL handle the error gracefully and notify the user
5. THE Supervisor_Agent SHALL use the AWS Bedrock Supervisor Pattern for agent coordination

### Requirement 12: Data Security and Privacy

**User Story:** As an NGO representative, I want my organization's documents and data to be stored securely, so that sensitive information is protected.

#### Acceptance Criteria

1. THE Platform SHALL store all uploaded documents in Amazon S3 with encryption at rest
2. THE Platform SHALL encrypt data in transit using TLS 1.2 or higher
3. THE Platform SHALL implement access controls ensuring users can only access their own NGO's data
4. WHEN a user requests document deletion, THE Platform SHALL permanently remove the document from storage
5. THE Platform SHALL comply with Indian data protection regulations

### Requirement 13: Performance and Scalability

**User Story:** As a user, I want the platform to respond quickly to my requests, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN a user initiates proposal generation, THE Platform SHALL complete the operation within 60 seconds
2. WHEN a user performs a grant search, THE Platform SHALL return results within 5 seconds
3. WHEN a user uploads a document, THE Platform SHALL confirm upload completion within 10 seconds
4. THE Platform SHALL support concurrent requests from multiple NGO users without degradation
5. THE Platform SHALL use AWS Lambda for serverless scaling of backend operations

### Requirement 14: LLM Integration

**User Story:** As the system, I want to use large language models for intelligent processing, so that I can provide high-quality automated services.

#### Acceptance Criteria

1. THE Platform SHALL use Amazon Bedrock for all LLM inference operations
2. THE Platform SHALL use Claude 3.5 Sonnet as the primary language model
3. WHEN an agent requires LLM inference, THE Platform SHALL invoke Amazon Bedrock with appropriate prompts
4. THE Platform SHALL handle LLM rate limits and throttling gracefully
5. THE Platform SHALL log all LLM interactions for debugging and quality assurance

### Requirement 15: Frontend User Interface

**User Story:** As an NGO representative, I want an intuitive web interface, so that I can easily navigate and use the platform's features.

#### Acceptance Criteria

1. THE Platform SHALL provide a web-based user interface built with Next.js
2. THE Platform SHALL display a dashboard showing compliance status, available grants, and recent proposals
3. WHEN a user navigates between features, THE Platform SHALL provide clear visual feedback
4. THE Platform SHALL be responsive and functional on desktop and tablet devices
5. THE Platform SHALL provide clear error messages and guidance when operations fail

### Requirement 16: Impact Report Generation

**User Story:** As an NGO representative, I want to generate quarterly impact reports, so that I can maintain donor relations and secure continued funding.

#### Acceptance Criteria

1. WHEN a user requests an impact report, THE Impact_Agent SHALL accept NGO activity data as input
2. THE Impact_Agent SHALL generate a report containing beneficiary metrics, fund utilization, and outcome summaries
3. THE Impact_Agent SHALL format the report as a downloadable PDF document
4. WHEN report generation is initiated, THE Impact_Agent SHALL complete generation within 60 seconds
5. THE Impact_Agent SHALL tailor report content to match the original grant's reporting requirements

### Requirement 17: Multilingual Input Support

**User Story:** As an NGO representative from rural India, I want to provide my organization's details in Hindi, so that I can use the platform without English proficiency.

#### Acceptance Criteria

1. THE Platform SHALL accept NGO descriptions and impact narratives in Hindi
2. WHEN Hindi text is provided, THE Proposal_Agent SHALL translate and incorporate it into the English proposal
3. THE Platform SHALL preserve the original meaning and intent during translation
4. THE Platform SHALL support both Devanagari script input and romanized Hindi input
5. WHEN translation quality is uncertain, THE Platform SHALL flag the content for user review
