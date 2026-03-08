import boto3, json

rt = boto3.client('bedrock-agent-runtime', region_name='ap-south-1')

prompts = [
    "What grants are available for education NGOs in Jharkhand?",
    "Generate an impact report for Q4 2025",
    "What is CSR section 135?",
    "Hello, what can you help me with?",
]

for prompt in prompts:
    print(f"\n{'='*60}")
    print(f"PROMPT: {prompt}")
    print('='*60)
    try:
        resp = rt.invoke_agent(
            agentId='HB82HPMIA3',
            agentAliasId='TSTALIASID',
            sessionId=f'multi-test-{hash(prompt) % 10000}',
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
                    print(f"  [Rationale] {orch['rationale'].get('text','')[:150]}")
                if 'invocationInput' in orch:
                    ii = orch['invocationInput']
                    if 'agentCollaboratorInvocationInput' in ii:
                        collab = ii['agentCollaboratorInvocationInput']
                        print(f"  [Route -> {collab.get('agentCollaboratorName','?')}]")
                if 'observation' in orch:
                    obs = orch['observation']
                    if 'agentCollaboratorInvocationOutput' in obs:
                        co = obs['agentCollaboratorInvocationOutput']
                        otext = str(co.get('output',{}).get('text',''))[:100]
                        print(f"  [Response from {co.get('agentCollaboratorName','?')}] {otext}")
                if 'failureTrace' in t:
                    ft = t['failureTrace']
                    print(f"  [FAILURE] {ft.get('failureReason','?')[:200]}")
        status = "PASS" if completion else "FAIL (empty)"
        print(f"  RESULT: {status}")
        print(f"  Response: {completion[:200]}")
    except Exception as e:
        print(f"  EXCEPTION: {str(e)[:200]}")
