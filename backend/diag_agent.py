import boto3, json, sys

rt = boto3.client('bedrock-agent-runtime', region_name='ap-south-1')

prompt = sys.argv[1] if len(sys.argv) > 1 else "Check my compliance status"
print(f"Testing: {prompt}")
print("---")

try:
    resp = rt.invoke_agent(
        agentId='HB82HPMIA3',
        agentAliasId='TSTALIASID',
        sessionId='diag-test-001',
        inputText=prompt,
        enableTrace=True
    )
    completion = ""
    for event in resp['completion']:
        if 'chunk' in event:
            chunk = event['chunk']
            if 'bytes' in chunk:
                completion += chunk['bytes'].decode('utf-8')
        if 'trace' in event:
            t = event['trace'].get('trace', {})
            orch = t.get('orchestrationTrace', {})
            if 'rationale' in orch:
                print(f"[Rationale] {orch['rationale'].get('text','')[:200]}")
            if 'invocationInput' in orch:
                ii = orch['invocationInput']
                inv_type = ii.get('invocationType', '?')
                if 'agentCollaboratorInvocationInput' in ii:
                    collab = ii['agentCollaboratorInvocationInput']
                    print(f"[Routing to] {collab.get('agentCollaboratorName','?')}: {collab.get('input',{}).get('text','')[:150]}")
                elif 'actionGroupInvocationInput' in ii:
                    ag = ii['actionGroupInvocationInput']
                    print(f"[ActionGroup] {ag.get('actionGroupName','?')} | {ag.get('apiPath','?')} | func: {ag.get('function','?')}")
            if 'observation' in orch:
                obs = orch['observation']
                if 'agentCollaboratorInvocationOutput' in obs:
                    co = obs['agentCollaboratorInvocationOutput']
                    print(f"[Collab Output] {co.get('agentCollaboratorName','?')}: {str(co.get('output',{}).get('text',''))[:200]}")
                if 'actionGroupInvocationOutput' in obs:
                    ao = obs['actionGroupInvocationOutput']
                    print(f"[ActionGroup Output] {str(ao.get('text',''))[:200]}")
            if 'failureTrace' in t:
                ft = t['failureTrace']
                print(f"[FAILURE] {ft.get('failureReason','unknown')}")
    print(f"\n=== RESULT ===\n{completion[:500]}")
except Exception as e:
    print(f"ERROR: {e}")
