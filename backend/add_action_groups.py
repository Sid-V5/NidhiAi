"""
Add action groups to NidhiAI Bedrock sub-agents.
Each sub-agent needs its OpenAPI spec + Lambda ARN attached.
"""
import boto3, json, os

c = boto3.client('bedrock-agent', region_name='ap-south-1')
lam = boto3.client('lambda', region_name='ap-south-1')

ACCOUNT = '481224232339'
REGION = 'ap-south-1'

# Map: agent_name -> (agent_id, action_group_name, lambda_name, openapi_file)
AGENTS = {
    'Compliance': {
        'agent_id': 'GFOH0VN84S',
        'ag_name': 'scan_documents',
        'lambda_name': 'nidhiai-scan-documents',
        'openapi_file': os.path.join(os.path.dirname(__file__), 'openapi', 'compliance_agent.yaml'),
    },
    'Grant-Scout': {
        'agent_id': 'KRPTCZMV4Z',
        'ag_name': 'match_grants',
        'lambda_name': 'nidhiai-match-grants',
        'openapi_file': os.path.join(os.path.dirname(__file__), 'openapi', 'grant_scout_agent.yaml'),
    },
    'Proposal': {
        'agent_id': '23TIS55Z0P',
        'ag_name': 'generate_proposal',
        'lambda_name': 'nidhiai-generate-pdf',
        'openapi_file': os.path.join(os.path.dirname(__file__), 'openapi', 'proposal_agent.yaml'),
    },
    'Impact': {
        'agent_id': 'PHLYZYB11A',
        'ag_name': 'generate_report',
        'lambda_name': 'nidhiai-generate-report',
        'openapi_file': os.path.join(os.path.dirname(__file__), 'openapi', 'impact_agent.yaml'),
    },
}

for name, cfg in AGENTS.items():
    agent_id = cfg['agent_id']
    lambda_arn = f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:{cfg['lambda_name']}"
    
    print(f"\n{'='*50}")
    print(f"Processing: {name} (Agent: {agent_id})")
    print(f"  Lambda: {lambda_arn}")
    
    # Read OpenAPI spec
    with open(cfg['openapi_file'], 'r') as f:
        openapi_spec = f.read()
    print(f"  OpenAPI spec loaded ({len(openapi_spec)} bytes)")
    
    # Check if action group already exists
    existing = c.list_agent_action_groups(agentId=agent_id, agentVersion='DRAFT')
    existing_names = [ag['actionGroupName'] for ag in existing['actionGroupSummaries']]
    
    if cfg['ag_name'] in existing_names:
        print(f"  Action group '{cfg['ag_name']}' already exists, skipping.")
        continue
    
    # Add Lambda permission for Bedrock to invoke it
    try:
        lam.add_permission(
            FunctionName=cfg['lambda_name'],
            StatementId=f'bedrock-agent-{agent_id}',
            Action='lambda:InvokeFunction',
            Principal='bedrock.amazonaws.com',
            SourceArn=f'arn:aws:bedrock:{REGION}:{ACCOUNT}:agent/{agent_id}',
        )
        print(f"  Added Lambda permission for Bedrock")
    except lam.exceptions.ResourceConflictException:
        print(f"  Lambda permission already exists")
    except Exception as e:
        print(f"  Lambda permission error (may already exist): {str(e)[:100]}")
    
    # Create action group
    try:
        resp = c.create_agent_action_group(
            agentId=agent_id,
            agentVersion='DRAFT',
            actionGroupName=cfg['ag_name'],
            actionGroupExecutor={'lambda': lambda_arn},
            apiSchema={'payload': openapi_spec},
        )
        print(f"  Created action group: {resp['agentActionGroup']['actionGroupId']}")
    except Exception as e:
        print(f"  ERROR creating action group: {str(e)[:200]}")
        continue
    
    # Prepare agent (makes changes active for TSTALIASID)
    try:
        c.prepare_agent(agentId=agent_id)
        print(f"  Agent prepared successfully")
    except Exception as e:
        print(f"  ERROR preparing agent: {str(e)[:200]}")

print("\n\nDone! All agents updated.")
