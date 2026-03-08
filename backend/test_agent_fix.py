import boto3, json

rt = boto3.client('bedrock-agent-runtime', region_name='ap-south-1')

prompt = "What grants are available for education NGOs in tribal areas of Jharkhand?"
print(f"Testing: {prompt}")
print("---")

try:
    resp = rt.invoke_agent(
        agentId='HB82HPMIA3',
        agentAliasId='TSTALIASID',
        sessionId='fix-test-002',
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
                if 'agentCollaboratorInvocationInput' in ii:
                    collab = ii['agentCollaboratorInvocationInput']
                    print(f"[Route -> {collab.get('agentCollaboratorName','?')}]")
            if 'observation' in orch:
                obs = orch['observation']
                if 'agentCollaboratorInvocationOutput' in obs:
                    co = obs['agentCollaboratorInvocationOutput']
                    otext = str(co.get('output',{}).get('text',''))[:300]
                    print(f"[Response from {co.get('agentCollaboratorName','?')}] {otext}")
            if 'failureTrace' in t:
                ft = t['failureTrace']
                print(f"[FAILURE] {ft.get('failureReason','?')[:300]}")
    print(f"\n=== RESULT ({len(completion)} chars) ===")
    print(completion[:1000])
except Exception as e:
    print(f"EXCEPTION: {str(e)[:300]}")
