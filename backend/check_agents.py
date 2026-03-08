import boto3, json

c = boto3.client('bedrock-agent', region_name='ap-south-1')

agents = {
    'Compliance': 'GFOH0VN84S',
    'Grant-Scout': 'KRPTCZMV4Z',
    'Impact': 'PHLYZYB11A',
    'Proposal': '23TIS55Z0P',
    'Supervisor': 'HB82HPMIA3'
}

for name, agent_id in agents.items():
    print(f"===== {name} ({agent_id}) =====")
    try:
        r = c.list_agent_action_groups(agentId=agent_id, agentVersion='DRAFT')
        if not r['actionGroupSummaries']:
            print("  No action groups")
        for ag in r['actionGroupSummaries']:
            agn = ag['actionGroupName']
            agid = ag['actionGroupId']
            print(f"  ActionGroup: {agn} (ID: {agid})")
            d = c.get_agent_action_group(agentId=agent_id, agentVersion='DRAFT', actionGroupId=agid)
            ags = d['agentActionGroup']
            executor = ags.get('actionGroupExecutor', {})
            lam = executor.get('lambda', 'N/A')
            print(f"    Lambda: {lam}")
            if 'functionSchema' in ags:
                fs = ags['functionSchema']
                print(f"    FunctionSchema: {json.dumps(fs, default=str)[:500]}")
            if 'apiSchema' in ags:
                schema = ags['apiSchema']
                if 'payload' in schema:
                    try:
                        spec = json.loads(schema['payload']) if isinstance(schema['payload'], str) else schema['payload']
                        paths = spec.get('paths', {})
                        for path, methods in paths.items():
                            for method, details in methods.items():
                                op = details.get('operationId', '?')
                                print(f"    OpenAPI: {method.upper()} {path} -> operationId: {op}")
                    except:
                        print(f"    Schema (raw): {schema['payload'][:300]}")
                elif 's3' in schema:
                    print(f"    Schema from S3: {schema['s3']}")
    except Exception as e:
        print(f"  ERROR: {str(e)[:200]}")
    print()

# Also check collaborators
print("===== Supervisor Collaborators =====")
try:
    collabs = c.list_agent_collaborators(agentId='HB82HPMIA3', agentVersion='DRAFT')
    for col in collabs.get('agentCollaboratorSummaries', []):
        print(f"  {col['collaboratorName']} -> agentId: {col.get('agentDescriptor',{}).get('aliasArn','?')}")
except Exception as e:
    print(f"  ERROR: {str(e)[:200]}")
