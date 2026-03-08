"""Quick test of the Supervisor Agent with prompts a judge would try."""
import boto3, json

rt = boto3.client('bedrock-agent-runtime', region_name='ap-south-1')
AGENT_ID = 'HB82HPMIA3'
ALIAS = 'TSTALIASID'

# Context that the frontend sends
CONTEXT = """NGO: "Asha Foundation" (ID: ngo-43aaf34)
S3 Bucket: nidhiai-documents
Documents: [{"s3Bucket":"nidhiai-documents","s3Key":"ngo-43aaf34/compliance/12A_cert.pdf","documentType":"12A"}]
Sector: Education | Location: India
Description: Empowering underprivileged children through quality education in rural India"""

TESTS = [
    "Check my compliance status and verify all uploaded documents",
    "Find CSR grants matching my NGO's profile",
    "Verify my docs and find grants for education in India",
]

for test in TESTS:
    prompt = f"{CONTEXT}\nRequest: {test}"
    print(f"\n{'='*60}")
    print(f"TEST: {test}")
    print(f"{'='*60}")
    
    try:
        r = rt.invoke_agent(
            agentId=AGENT_ID, agentAliasId=ALIAS,
            sessionId=f"test-{hash(test) % 10000}",
            inputText=prompt, enableTrace=True,
        )
        
        completion = ""
        trace_agents = set()
        failure = None
        
        for event in r.get("completion", []):
            if "chunk" in event:
                chunk_bytes = event["chunk"].get("bytes", b"")
                completion += chunk_bytes.decode("utf-8") if isinstance(chunk_bytes, bytes) else str(chunk_bytes)
            if "trace" in event:
                td = event["trace"].get("trace", {})
                if "orchestrationTrace" in td:
                    orch = td["orchestrationTrace"]
                    if "invocationInput" in orch:
                        inv = orch["invocationInput"]
                        ag = inv.get("actionGroupInvocationInput", {}).get("actionGroupName", "")
                        if ag: trace_agents.add(ag)
                    if "observation" in orch:
                        obs = orch["observation"]
                        if obs.get("finalResponse", {}).get("text", ""):
                            pass  # normal
                if "failureTrace" in td:
                    failure = td["failureTrace"].get("failureReason", "unknown")
        
        status = "FAILURE" if failure else ("SUCCESS" if completion else "EMPTY")
        if "unable to assist" in completion.lower() or "sorry" in completion.lower()[:30]:
            status = "NEEDS_IMPROVEMENT"
        
        print(f"STATUS: {status}")
        if trace_agents:
            print(f"AGENTS CALLED: {', '.join(trace_agents)}")
        if failure:
            print(f"FAILURE: {failure[:200]}")
        print(f"RESPONSE ({len(completion)} chars): {completion[:400]}")
        
    except Exception as e:
        print(f"ERROR: {str(e)[:200]}")

print("\n\nDone!")
