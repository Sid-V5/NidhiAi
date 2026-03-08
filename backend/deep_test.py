"""Re-run agent orchestration tests with fixed datetime handling, then check reports/generate."""
import boto3, json, time

rt = boto3.client("bedrock-agent-runtime", region_name="ap-south-1")
AGENT_ID = "HB82HPMIA3"
ALIAS_ID = "TSTALIASID"

def test_agent(prompt, session_id):
    print(f"\n{'='*60}")
    print(f"PROMPT: {prompt}")
    print(f"{'='*60}")
    try:
        resp = rt.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=ALIAS_ID,
            sessionId=session_id,
            inputText=prompt,
            enableTrace=True,
        )
        completion = ""
        trace_agents = []
        for event in resp.get("completion", []):
            if "chunk" in event:
                b = event["chunk"].get("bytes", b"")
                completion += b.decode("utf-8") if isinstance(b, bytes) else str(b)
            if "trace" in event:
                trace = event.get("trace", {}).get("trace", {})
                # Check orchestrationTrace for sub-agent routing
                orch = trace.get("orchestrationTrace", {})
                invoc = orch.get("invocationInput", {})
                # Check if a sub-agent was invoked
                if "agentCollaboratorInvocationInput" in invoc:
                    collab_name = invoc["agentCollaboratorInvocationInput"].get("agentCollaboratorName", "unknown")
                    trace_agents.append(collab_name)
                # Also check model invocation
                model_inv = orch.get("modelInvocationInput", {})
                if model_inv:
                    trace_agents.append("model-invoke")
        
        print(f"STATUS: SUCCESS")
        unique_agents = list(dict.fromkeys(trace_agents))
        print(f"TRACE AGENTS: {', '.join(unique_agents) if unique_agents else 'direct'}")
        print(f"RESPONSE ({len(completion)} chars): {completion[:500]}")
        return True
    except Exception as e:
        print(f"STATUS: FAILED")
        print(f"ERROR: {type(e).__name__}: {str(e)[:300]}")
        return False

# Test all 4 sub-agent paths
results = {}

# 1: Grant Scout
results["Grant Scout"] = test_agent(
    "Find CSR education grants for an NGO in Jharkhand",
    f"deep-v2-grants-{int(time.time())}"
)

# 2: Compliance
results["Compliance"] = test_agent(
    "Check the compliance status of my 12A, 80G, and CSR-1 documents",
    f"deep-v2-comp-{int(time.time())}"
)

# 3: Proposal
results["Proposal"] = test_agent(
    "Draft a proposal for the Tata Steel Tribal Education Initiative grant",
    f"deep-v2-prop-{int(time.time())}"
)

# 4: Impact
results["Impact"] = test_agent(
    "Generate an impact report showing our education program outcomes for Q4 2025",
    f"deep-v2-impact-{int(time.time())}"
)

print(f"\n{'='*60}")
print("ORCHESTRATION SUMMARY")
print(f"{'='*60}")
for name, ok in results.items():
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}")
