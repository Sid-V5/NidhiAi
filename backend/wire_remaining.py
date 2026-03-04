"""Wire remaining 3 action groups to Supervisor Agent."""
import boto3

client = boto3.client("bedrock-agent", region_name="ap-south-1")
AGENT = "HB82HPMIA3"
ACCT = "481224232339"

groups = [
    {
        "name": "match_grants",
        "desc": "Grant Scout Agent: Search CSR grant opportunities from Knowledge Base",
        "arn": "arn:aws:lambda:ap-south-1:" + ACCT + ":function:nidhiai-match-grants",
        "functions": [{
            "name": "matchGrants",
            "description": "Search for matching CSR grants based on NGO sector, description, and location. Returns ranked grants by relevance.",
            "parameters": {
                "ngoSector": {"type": "string", "description": "NGO focus area (Education, Healthcare, etc.)", "required": True},
                "ngoDescription": {"type": "string", "description": "Brief description of the NGO", "required": True},
                "location": {"type": "string", "description": "Geographic location", "required": False},
            },
        }],
    },
    {
        "name": "generate_pdf",
        "desc": "Proposal Agent: Generate CSR grant proposal PDF with budget and impact metrics",
        "arn": "arn:aws:lambda:ap-south-1:" + ACCT + ":function:nidhiai-generate-pdf",
        "functions": [{
            "name": "generateProposal",
            "description": "Generate a CSR grant proposal PDF with executive summary, budget breakdown, and impact metrics.",
            "parameters": {
                "grantData": {"type": "string", "description": "JSON string with grant details: grantId, corporationName, programName, focusAreas, fundingRange", "required": True},
                "ngoProfile": {"type": "string", "description": "JSON string with NGO profile: ngoId, ngoName, sector, description, city, state", "required": True},
            },
        }],
    },
    {
        "name": "generate_report",
        "desc": "Impact Agent: Generate quarterly CSR impact reports",
        "arn": "arn:aws:lambda:ap-south-1:" + ACCT + ":function:nidhiai-generate-report",
        "functions": [{
            "name": "generateImpactReport",
            "description": "Generate a quarterly CSR impact report with beneficiary demographics, fund utilization, and success stories.",
            "parameters": {
                "ngoId": {"type": "string", "description": "NGO unique identifier", "required": True},
                "ngoName": {"type": "string", "description": "Name of the NGO", "required": True},
                "sector": {"type": "string", "description": "NGO sector", "required": False},
                "reportingPeriod": {"type": "string", "description": "Quarter (e.g., Q4 2025)", "required": False},
                "beneficiariesServed": {"type": "string", "description": "Number of beneficiaries", "required": False},
                "fundsUtilized": {"type": "string", "description": "Funds utilized in INR", "required": False},
            },
        }],
    },
]

for g in groups:
    try:
        resp = client.create_agent_action_group(
            agentId=AGENT, agentVersion="DRAFT",
            actionGroupName=g["name"], description=g["desc"],
            actionGroupExecutor={"lambda": g["arn"]},
            functionSchema={"functions": g["functions"]},
        )
        ag_id = resp["agentActionGroup"]["actionGroupId"]
        print("OK: " + g["name"] + " -> " + ag_id)
    except Exception as e:
        print("FAIL: " + g["name"] + " -> " + str(e))

# Prepare agent
print("\nPreparing agent...")
try:
    r = client.prepare_agent(agentId=AGENT)
    print("Status: " + r["agentStatus"])
except Exception as e:
    print("Prepare: " + str(e))
