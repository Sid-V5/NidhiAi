"""Test the Supervisor Agent with the full automation prompt."""
import boto3, json, traceback

client = boto3.client("bedrock-agent-runtime", region_name="ap-south-1")

AGENT_ID = "HB82HPMIA3"
ALIAS_ID = "TSTALIASID"

input_text = """NGO: "Test Foundation" (ID: ngo-43aaff34)
S3 Bucket: nidhiai-documents
Documents: [{"s3Bucket":"nidhiai-documents","s3Key":"ngo-43aaff34/compliance/12A_cert.pdf","documentType":"12A"},{"s3Bucket":"nidhiai-documents","s3Key":"ngo-43aaff34/compliance/80G_cert.pdf","documentType":"80G"},{"s3Bucket":"nidhiai-documents","s3Key":"ngo-43aaff34/compliance/PAN_cert.pdf","documentType":"PAN"}]
Sector: Education | Location: India
Description: Education NGO working in rural India
Request: Verify all my compliance documents, find the best matching CSR grants for my NGO, and generate a proposal for the top match"""

print("Invoking Supervisor Agent...")
try:
    r = client.invoke_agent(
        agentId=AGENT_ID, agentAliasId=ALIAS_ID,
        sessionId="test-full-auto-123",
        inputText=input_text,
        enableTrace=True,
    )
    
    completion = ""
    trace_count = 0
    for event in r.get("completion", []):
        if "chunk" in event:
            chunk_bytes = event["chunk"].get("bytes", b"")
            text = chunk_bytes.decode("utf-8") if isinstance(chunk_bytes, bytes) else str(chunk_bytes)
            completion += text
        if "trace" in event:
            trace_count += 1
            raw = event["trace"]
            td = raw.get("trace", {})
            if "orchestrationTrace" in td:
                orch = td["orchestrationTrace"]
                if "invocationInput" in orch:
                    inv = orch["invocationInput"]
                    ag = inv.get("actionGroupInvocationInput", {})
                    if ag:
                        print(f"  -> Calling: {ag.get('actionGroupName','?')} / {ag.get('function','?')}")
                if "observation" in orch:
                    obs = orch["observation"]
                    if obs.get("actionGroupInvocationOutput"):
                        out = str(obs["actionGroupInvocationOutput"].get("text",""))[:150]
                        print(f"  <- Result: {out}")

    print(f"\nTrace events: {trace_count}")
    print(f"Completion length: {len(completion)}")
    print(f"\n--- COMPLETION ---")
    print(completion[:800])
    
except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()
