"""
Test the full multi-agent orchestration chain:
1. Supervisor → Compliance + Grant Scout + Proposal (multi-hop)
2. Impact report asking for user data
"""
import boto3, json

rt = boto3.client('bedrock-agent-runtime', region_name='ap-south-1')

prompts = [
    {
        "label": "FULL CHAIN: Compliance → Grants → Proposal",
        "text": "I am Asha Foundation (ngoId: demo-ngo-001), an education NGO in Jharkhand working with tribal communities. First check my compliance status, then find matching grants, and draft a proposal for the best matching grant.",
        "session": "full-chain-001"
    },
    {
        "label": "IMPACT REPORT (should ask for data)",
        "text": "Generate an impact report for Asha Foundation for Q4 2025. We served 1200 beneficiaries across 5 programs with Rs 450000 utilized.",
        "session": "impact-001"
    }
]

for p in prompts:
    print(f"\n{'='*70}")
    print(f"TEST: {p['label']}")
    print(f"PROMPT: {p['text'][:100]}...")
    print('='*70)
    
    try:
        resp = rt.invoke_agent(
            agentId='HB82HPMIA3',
            agentAliasId='TSTALIASID',
            sessionId=p['session'],
            inputText=p['text'],
            enableTrace=True
        )
        completion = ""
        agents_called = []
        functions_called = []
        
        for event in resp['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    completion += chunk['bytes'].decode('utf-8')
            if 'trace' in event:
                t = event['trace'].get('trace', {})
                orch = t.get('orchestrationTrace', {})
                if 'rationale' in orch:
                    rat = orch['rationale'].get('text', '')[:200]
                    print(f"  [Rationale] {rat}")
                if 'invocationInput' in orch:
                    ii = orch['invocationInput']
                    if 'agentCollaboratorInvocationInput' in ii:
                        collab = ii['agentCollaboratorInvocationInput']
                        name = collab.get('agentCollaboratorName', '?')
                        agents_called.append(name)
                        inp = collab.get('input', {}).get('text', '')[:150]
                        print(f"  [ROUTE → {name}] {inp}")
                    if 'actionGroupInvocationInput' in ii:
                        ag = ii['actionGroupInvocationInput']
                        func = ag.get('function', ag.get('apiPath', '?'))
                        functions_called.append(func)
                        print(f"  [FUNCTION: {func}]")
                if 'observation' in orch:
                    obs = orch['observation']
                    if 'agentCollaboratorInvocationOutput' in obs:
                        co = obs['agentCollaboratorInvocationOutput']
                        name = co.get('agentCollaboratorName', '?')
                        otext = str(co.get('output', {}).get('text', ''))[:200]
                        print(f"  [RESPONSE ← {name}] {otext}")
                if 'failureTrace' in t:
                    ft = t['failureTrace']
                    print(f"  [FAILURE] {ft.get('failureReason', '?')[:300]}")
        
        print(f"\n  --- SUMMARY ---")
        print(f"  Agents called: {agents_called or 'none (direct answer)'}")
        print(f"  Functions called: {functions_called or 'none'}")
        print(f"  Response length: {len(completion)} chars")
        print(f"  Response (first 500 chars):")
        print(f"  {completion[:500]}")
        
    except Exception as e:
        print(f"  EXCEPTION: {str(e)[:300]}")
