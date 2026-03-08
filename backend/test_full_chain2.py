import boto3
import json

rt = boto3.client('bedrock-agent-runtime', region_name='ap-south-1')

def test_agent(prompt, session_id):
    print(f"\n{'='*80}")
    print(f"TEST: {prompt}")
    print('='*80)
    
    resp = rt.invoke_agent(
        agentId='HB82HPMIA3',
        agentAliasId='TSTALIASID',
        sessionId=session_id,
        inputText=prompt,
        enableTrace=True
    )
    
    completion = ""
    for event in resp['completion']:
        if 'chunk' in event:
            b = event['chunk'].get('bytes')
            if b:
                completion += b.decode('utf-8', errors='ignore')
        
        if 'trace' in event:
            t = event['trace'].get('trace', {})
            orch = t.get('orchestrationTrace', {})
            
            if 'rationale' in orch:
                print(f"🤔 [Rationale] {orch['rationale'].get('text', '')}")
                
            if 'invocationInput' in orch:
                ii = orch['invocationInput']
                if 'agentCollaboratorInvocationInput' in ii:
                    collab = ii['agentCollaboratorInvocationInput']
                    name = collab.get('agentCollaboratorName', '?')
                    print(f"🔀 [ROUTING TO AGENT] {name}")
                if 'actionGroupInvocationInput' in ii:
                    ag = ii['actionGroupInvocationInput']
                    print(f"🛠️ [CALLING FUNCTION] {ag.get('function', ag.get('apiPath', '?'))}")
                    
            if 'observation' in orch:
                obs = orch['observation']
                if 'agentCollaboratorInvocationOutput' in obs:
                    co = obs['agentCollaboratorInvocationOutput']
                    name = co.get('agentCollaboratorName', '?')
                    text = co.get('output', {}).get('text', '')
                    print(f"✅ [RESPONSE FROM AGENT {name}]\n    {text}")
                if 'actionGroupInvocationOutput' in obs:
                    out = obs['actionGroupInvocationOutput']
                    print(f"✅ [FUNCTION RETURNED] {out.get('text', '...')[:200]}...")
                    
            if 'failureTrace' in t:
                print(f"❌ [FAILURE] {t['failureTrace']}")

    print("\n💬 [FINAL RESPONSE]")
    print(completion)

# 1. Test Impact Report needing data
test_agent(
    "Generate an impact report for Q4 2025. We utilized Rs 500000.",
    "impact-test-01"
)

# 2. Test Full Chain
test_agent(
    "I'm from Asha Foundation (ngoId: demo-ngo-001). Check my compliance status. If valid, find matching grants for education in Jharkhand, and then draft a proposal for the top match.",
    "chain-test-01"
)
