"""Create action groups on the Supervisor Agent for all 4 Lambdas."""
import json, boto3

client = boto3.client("bedrock-agent", region_name="ap-south-1")
AGENT_ID = "HB82HPMIA3"
ACCT = "481224232339"

action_groups = [
    {
        "name": "scan_documents",
        "description": "Compliance Agent: Verify NGO compliance documents (12A, 80G, CSR-1 certificates) using Amazon Textract. Validates certificate dates and stores results in DynamoDB.",
        "lambda_arn": f"arn:aws:lambda:ap-south-1:{ACCT}:function:nidhiai-scan-documents",
        "schema_file": "backend/schemas/scan_documents.json",
    },
    {
        "name": "match_grants",
        "description": "Grant Scout Agent: Search for matching CSR grant opportunities from the Bedrock Knowledge Base based on NGO profile, sector, and location.",
        "lambda_arn": f"arn:aws:lambda:ap-south-1:{ACCT}:function:nidhiai-match-grants",
        "schema_file": "backend/schemas/match_grants.json",
    },
    {
        "name": "generate_pdf",
        "description": "Proposal Agent: Generate a formatted CSR grant proposal PDF with executive summary, budget breakdown, and impact metrics. Uploads to S3.",
        "lambda_arn": f"arn:aws:lambda:ap-south-1:{ACCT}:function:nidhiai-generate-pdf",
        "schema_file": "backend/schemas/generate_pdf.json",
    },
    {
        "name": "generate_report",
        "description": "Impact Agent: Generate quarterly CSR impact assessment reports with beneficiary data, fund utilization, and success stories. Creates PDF.",
        "lambda_arn": f"arn:aws:lambda:ap-south-1:{ACCT}:function:nidhiai-generate-report",
        "schema_file": "backend/schemas/generate_report.json",
    },
]

for ag in action_groups:
    with open(ag["schema_file"], "r") as f:
        schema = f.read()
    
    try:
        resp = client.create_agent_action_group(
            agentId=AGENT_ID,
            agentVersion="DRAFT",
            actionGroupName=ag["name"],
            description=ag["description"],
            actionGroupExecutor={"lambda": ag["lambda_arn"]},
            apiSchema={"payload": schema},
        )
        ag_id = resp["agentActionGroup"]["actionGroupId"]
        print(f"OK: {ag['name']} -> {ag_id}")
    except Exception as e:
        print(f"FAIL: {ag['name']} -> {e}")

# Now prepare the agent
print("\nPreparing agent...")
try:
    resp = client.prepare_agent(agentId=AGENT_ID)
    print(f"Agent status: {resp['agentStatus']}")
except Exception as e:
    print(f"Prepare failed: {e}")
