"""
API Gateway Lambda handler - routes all API requests to real AWS services.
Profile → DynamoDB, Upload → S3 pre-signed URLs, Compliance → invoke scan Lambda,
Grants → invoke match Lambda, Proposals → invoke generate Lambda, Reports → invoke report Lambda,
Agent → Bedrock Agents.
"""
import json, logging, os, uuid, re
from datetime import datetime, timezone
from typing import Any
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "ap-south-1")
s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
lambda_client = boto3.client("lambda", region_name=REGION)
bedrock_agent_rt = boto3.client("bedrock-agent-runtime", region_name=REGION)

DOCUMENTS_BUCKET = os.environ.get("DOCUMENTS_BUCKET", "nidhiai-documents")
PDF_BUCKET = os.environ.get("PDF_BUCKET", "nidhiai-generated-pdfs")
NGO_TABLE = os.environ.get("NGO_TABLE", "nidhiai-ngo-profiles")
COMPLIANCE_TABLE = os.environ.get("COMPLIANCE_TABLE", "nidhiai-compliance-results")
PROPOSALS_TABLE = os.environ.get("PROPOSALS_TABLE", "nidhiai-proposals")
DOCUMENTS_TABLE = os.environ.get("DOCUMENTS_TABLE", "nidhiai-documents")
SUPERVISOR_AGENT_ID = os.environ.get("SUPERVISOR_AGENT_ID", "HB82HPMIA3")
SUPERVISOR_ALIAS = os.environ.get("SUPERVISOR_AGENT_ALIAS", "TSTALIASID")

# Lambda function ARNs for cross-invocation
SCAN_LAMBDA = os.environ.get("SCAN_LAMBDA", "nidhiai-scan-documents")
GRANTS_LAMBDA = os.environ.get("GRANTS_LAMBDA", "nidhiai-match-grants")
PDF_LAMBDA = os.environ.get("PDF_LAMBDA", "nidhiai-generate-pdf")
REPORT_LAMBDA = os.environ.get("REPORT_LAMBDA", "nidhiai-generate-report")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json",
}


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": CORS, "body": json.dumps(body, cls=DecimalEncoder)}


def validate_pan(pan: str) -> bool:
    return bool(re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", pan))


def invoke_lambda(fn_name: str, payload: dict) -> dict:
    """Invoke another Lambda synchronously and return parsed response."""
    try:
        r = lambda_client.invoke(FunctionName=fn_name, InvocationType="RequestResponse",
                                 Payload=json.dumps(payload))
        raw = r["Payload"].read()
        result = json.loads(raw)
        logger.info(f"Lambda {fn_name} raw response keys: {list(result.keys()) if isinstance(result, dict) else type(result)}")
        # Check for Lambda execution errors
        if r.get("FunctionError"):
            logger.error(f"Lambda {fn_name} error: {raw[:500]}")
            return {"status": "error", "message": f"Lambda {fn_name} execution failed"}
        # Bedrock action group format has nested response
        if isinstance(result, dict) and "response" in result:
            body_str = result["response"].get("responseBody", {}).get("application/json", {}).get("body", "{}")
            parsed = json.loads(body_str) if isinstance(body_str, str) else body_str
            logger.info(f"Lambda {fn_name} parsed body keys: {list(parsed.keys()) if isinstance(parsed, dict) else type(parsed)}")
            return parsed
        return result
    except Exception as e:
        logger.error(f"invoke_lambda {fn_name} failed: {e}")
        return {"status": "error", "message": str(e)}


# ========== PROFILE ==========
def handle_profile_create(body: dict, user_id: str) -> dict:
    ngo_name = body.get("ngoName", "")
    pan_card = body.get("panCard", "")
    sector = body.get("sector", "")
    if not ngo_name or not pan_card or not sector:
        return resp(400, {"error": "NGO Name, PAN Card, and Sector are required."})
    if not validate_pan(pan_card):
        return resp(400, {"error": "PAN Card must be in format AAAAA9999A (e.g., ABCDE1234F)."})

    now = datetime.now(timezone.utc).isoformat()
    table = dynamodb.Table(NGO_TABLE)

    # Check if profile already exists for this userId (upsert logic)
    existing = None
    try:
        scan_result = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr("userId").eq(user_id)
        )
        items = scan_result.get("Items", [])
        if items:
            existing = items[0]
    except Exception as e:
        logger.warning(f"Profile scan for userId {user_id} failed: {e}")

    if existing:
        # Update existing profile — keep original ngoId, createdAt, and complianceStatus
        ngo_id = existing["ngoId"]
        item = {
            **existing,
            "ngoName": ngo_name, "panCard": pan_card, "sector": sector,
            "description": body.get("description", existing.get("description", "")),
            "contactEmail": body.get("contactEmail", existing.get("contactEmail", "")),
            "contactPhone": body.get("contactPhone", existing.get("contactPhone", "")),
            "city": body.get("city", existing.get("city", "")),
            "state": body.get("state", existing.get("state", "")),
            "pincode": body.get("pincode", existing.get("pincode", "")),
            "registrationDate": body.get("registrationDate", existing.get("registrationDate", "")),
            "updatedAt": now,
        }
        table.put_item(Item=item)
        logger.info(f"Updated existing profile {ngo_id} for userId {user_id}")
        return resp(200, {"ngoId": ngo_id, "profile": item})
    else:
        # Create new profile
        ngo_id = f"ngo-{str(uuid.uuid4())[:8]}"
        item = {
            "ngoId": ngo_id, "userId": user_id, "ngoName": ngo_name, "panCard": pan_card,
            "sector": sector, "description": body.get("description", ""),
            "contactEmail": body.get("contactEmail", ""), "contactPhone": body.get("contactPhone", ""),
            "city": body.get("city", ""), "state": body.get("state", ""),
            "pincode": body.get("pincode", ""), "registrationDate": body.get("registrationDate", ""),
            "complianceStatus": {
                "certificate12A": {"uploaded": False, "status": "not_uploaded"},
                "certificate80G": {"uploaded": False, "status": "not_uploaded"},
                "certificateCSR1": {"uploaded": False, "status": "not_uploaded"},
            },
            "createdAt": now, "updatedAt": now,
        }
        table.put_item(Item=item)
        logger.info(f"Created new profile {ngo_id} for userId {user_id}")
        return resp(200, {"ngoId": ngo_id, "profile": item})


def handle_profile_get(params: dict) -> dict:
    ngo_id = params.get("ngoId", "")
    user_id = params.get("userId", "")
    
    if ngo_id:
        result = dynamodb.Table(NGO_TABLE).get_item(Key={"ngoId": ngo_id})
        item = result.get("Item")
        if item:
            return resp(200, {"profile": item})
    elif user_id:
        # Scan by userId 
        result = dynamodb.Table(NGO_TABLE).scan(
            FilterExpression=boto3.dynamodb.conditions.Attr("userId").eq(user_id)
        )
        items = result.get("Items", [])
        if items:
            return resp(200, {"profile": items[0]})
            
    return resp(404, {"error": "Profile not found."})


# ========== DOCUMENT UPLOAD ==========
def handle_upload(body: dict) -> dict:
    ngo_id = body.get("ngoId", "")
    doc_type = body.get("documentType", "")
    file_name = body.get("fileName", "document.pdf")
    if doc_type not in ["12A", "80G", "CSR1"]:
        return resp(400, {"error": "documentType must be 12A, 80G, or CSR1."})

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    s3_key = f"{ngo_id}/compliance/{doc_type}_{ts}.pdf"

    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": DOCUMENTS_BUCKET, "Key": s3_key, "ContentType": "application/pdf"},
        ExpiresIn=300,
    )

    # Record document in DynamoDB
    doc_id = str(uuid.uuid4())
    dynamodb.Table(DOCUMENTS_TABLE).put_item(Item={
        "documentId": doc_id, "ngoId": ngo_id, "documentType": doc_type,
        "s3Key": s3_key, "s3Bucket": DOCUMENTS_BUCKET, "fileName": file_name,
        "uploadedAt": datetime.now(timezone.utc).isoformat(), "status": "uploaded",
    })

    return resp(200, {"uploadUrl": upload_url, "s3Key": s3_key, "s3Bucket": DOCUMENTS_BUCKET,
                      "documentId": doc_id, "documentType": doc_type})


# ========== COMPLIANCE ==========
def handle_compliance_scan(body: dict) -> dict:
    """Invoke scan_documents Lambda to run Textract on a document."""
    ngo_id = body.get("ngoId", "")
    s3_bucket = body.get("s3Bucket", DOCUMENTS_BUCKET)
    s3_key = body.get("s3Key", "")
    doc_type = body.get("documentType", "unknown")

    event = {
        "actionGroup": "scan_documents", "apiPath": "/scan-document",
        "requestBody": {"content": {"application/json": {"properties": [
            {"name": "s3Bucket", "value": s3_bucket},
            {"name": "s3Key", "value": s3_key},
            {"name": "ngoId", "value": ngo_id},
            {"name": "documentType", "value": doc_type},
        ]}}},
    }
    result = invoke_lambda(SCAN_LAMBDA, event)
    return resp(200, result)


def handle_compliance_scan_batch(body: dict) -> dict:
    """Invoke scan_documents Lambda in batch mode (parallel Textract)."""
    ngo_id = body.get("ngoId", "")
    documents = body.get("documents", [])

    event = {
        "actionGroup": "scan_documents", "apiPath": "/scan-documents-batch",
        "requestBody": {"content": {"application/json": {"properties": [
            {"name": "ngoId", "value": ngo_id},
            {"name": "documents", "value": json.dumps(documents)},
        ]}}},
    }
    result = invoke_lambda(SCAN_LAMBDA, event)
    return resp(200, result)


def handle_compliance_get(ngo_id: str) -> dict:
    """Get compliance results from DynamoDB."""
    table = dynamodb.Table(COMPLIANCE_TABLE)
    result = table.query(KeyConditionExpression=Key("ngoId").eq(ngo_id))
    items = result.get("Items", [])

    valid_count = sum(1 for i in items if i.get("status") == "valid")
    total = len(items) if items else 3
    score = (valid_count / total * 100) if total > 0 else 0

    return resp(200, {"ngoId": ngo_id, "results": items, "complianceScore": score,
                      "totalDocuments": total, "validDocuments": valid_count})


# ========== GRANTS ==========
def handle_grants_search(body: dict) -> dict:
    """Invoke match_grants Lambda to search Knowledge Base."""
    event = {
        "actionGroup": "match_grants", "apiPath": "/match-grants",
        "requestBody": {"content": {"application/json": {"properties": [
            {"name": "ngoSector", "value": body.get("ngoSector", "")},
            {"name": "ngoDescription", "value": body.get("ngoDescription", "")},
            {"name": "location", "value": body.get("location", "")},
            {"name": "fundingMin", "value": str(body.get("fundingMin", 0))},
            {"name": "fundingMax", "value": str(body.get("fundingMax", 5000000))},
        ]}}},
    }
    result = invoke_lambda(GRANTS_LAMBDA, event)
    return resp(200, result)


# ========== PROPOSALS ==========
def handle_proposal_generate(body: dict) -> dict:
    """Invoke generate_pdf Lambda to create proposal."""
    ngo_profile = {
        "ngoId": body.get("ngoId", ""),
        "ngoName": body.get("ngoName", ""),
        "sector": body.get("ngoDescription", ""),
        "panCard": body.get("panCard", ""),
    }
    grant_data = body.get("grantDetails", {})
    if isinstance(grant_data, str):
        try: grant_data = json.loads(grant_data)
        except: grant_data = {}
    if "grantId" not in grant_data:
        grant_data["grantId"] = body.get("grantId", "")

    event = {
        "actionGroup": "generate_pdf", "apiPath": "/generate-proposal",
        "requestBody": {"content": {"application/json": {"properties": [
            {"name": "ngoProfile", "value": json.dumps(ngo_profile)},
            {"name": "grantData", "value": json.dumps(grant_data)},
        ]}}},
    }
    result = invoke_lambda(PDF_LAMBDA, event)
    # Ensure the result includes grant info for the frontend
    if isinstance(result, dict) and result.get("status") == "success":
        result["grantName"] = grant_data.get("programName", grant_data.get("grantId", ""))
        result["corporationName"] = grant_data.get("corporationName", "")
    return resp(200, result)


def handle_proposals_list(ngo_id: str) -> dict:
    """List proposals from DynamoDB."""
    table = dynamodb.Table(PROPOSALS_TABLE)
    try:
        result = table.query(IndexName="ngoId-createdAt-index",
                             KeyConditionExpression=Key("ngoId").eq(ngo_id))
        proposals = result.get("Items", [])
        # Generate download URLs for each proposal (handle both s3Key and pdfS3Key)
        for p in proposals:
            s3_key = p.get("s3Key") or p.get("pdfS3Key") or ""
            if s3_key:
                p["downloadUrl"] = s3.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": PDF_BUCKET,
                        "Key": s3_key,
                        "ResponseContentType": "application/pdf",
                        "ResponseContentDisposition": "inline",
                    },
                    ExpiresIn=3600,
                )
        return resp(200, {"proposals": proposals})
    except Exception as e:
        logger.error(f"List proposals error: {e}")
        return resp(200, {"proposals": []})


# ========== IMPACT REPORTS ==========
def handle_report_generate(body: dict) -> dict:
    """Invoke generate_report Lambda to create impact report."""
    activity = body.get("activityData", {})
    if isinstance(activity, str):
        try: activity = json.loads(activity)
        except: activity = {}

    event = {
        "actionGroup": "generate_report", "apiPath": "/generate-report",
        "requestBody": {"content": {"application/json": {"properties": [
            {"name": "ngoId", "value": body.get("ngoId", "")},
            {"name": "ngoName", "value": activity.get("ngoName", body.get("ngoName", ""))},
            {"name": "reportingPeriod", "value": body.get("quarter", "")},
            {"name": "sector", "value": activity.get("sector", "")},
            {"name": "beneficiariesServed", "value": str(activity.get("beneficiariesServed", 0))},
            {"name": "programsCompleted", "value": str(activity.get("proposalsGenerated", 0))},
            {"name": "fundsUtilized", "value": str(activity.get("fundsUtilized", 0))},
            {"name": "geographicReach", "value": activity.get("geographicReach", "")},
        ]}}},
    }
    result = invoke_lambda(REPORT_LAMBDA, event)
    logger.info(f"Report result keys: {list(result.keys()) if isinstance(result, dict) else type(result)}")
    return resp(200, result)


# ========== AGENT INVOCATION ==========
def handle_invoke_agent(body: dict) -> dict:
    """Invoke Bedrock Supervisor Agent with real agent trace, enhanced parsing."""
    input_text = body.get("inputText", body.get("prompt", ""))
    session_id = body.get("sessionId", str(uuid.uuid4()))
    agent_id = body.get("agentId", SUPERVISOR_AGENT_ID)

    # Map action group names to human-readable agent names
    AG_MAP = {
        "scan_documents": "Compliance",
        "scan-documents": "Compliance",
        "compliance": "Compliance",
        "match_grants": "Grant Scout",
        "match-grants": "Grant Scout",
        "grant_scout": "Grant Scout",
        "search_grants": "Grant Scout",
        "generate_pdf": "Proposal",
        "generate-pdf": "Proposal",
        "proposal": "Proposal",
        "generate_report": "Impact",
        "generate-report": "Impact",
        "impact": "Impact",
    }

    def resolve_agent(name: str) -> str:
        if not name:
            return "Supervisor"
        lower = name.lower().replace(" ", "_")
        return AG_MAP.get(lower, name.title())

    try:
        r = bedrock_agent_rt.invoke_agent(
            agentId=agent_id, agentAliasId=SUPERVISOR_ALIAS,
            sessionId=session_id, inputText=input_text,
            enableTrace=True,
        )
        completion = ""
        traces = []
        for event in r.get("completion", []):
            if "chunk" in event:
                chunk_bytes = event["chunk"].get("bytes", b"")
                completion += chunk_bytes.decode("utf-8") if isinstance(chunk_bytes, bytes) else str(chunk_bytes)
            if "trace" in event:
                raw_trace = event["trace"]
                trace_data = raw_trace.get("trace", {})

                # Orchestration traces (supervisor planning, agent calls, observations)
                if "orchestrationTrace" in trace_data:
                    orch = trace_data["orchestrationTrace"]

                    # Model invocation = supervisor thinking / rationale
                    if "modelInvocationInput" in orch:
                        traces.append({
                            "type": "model_invocation",
                            "agentName": "Supervisor",
                            "action": "Analyzing request and determining workflow",
                        })

                    # Model output = supervisor's rationale / chain of thought
                    if "modelInvocationOutput" in orch:
                        output = orch["modelInvocationOutput"]
                        rationale = ""
                        raw_resp = output.get("rawResponse", {}).get("content", "")
                        if raw_resp:
                            rationale = raw_resp[:300] if isinstance(raw_resp, str) else str(raw_resp)[:300]
                        metadata = output.get("metadata", {})
                        usage = metadata.get("usage", {})
                        if rationale:
                            traces.append({
                                "type": "planning",
                                "agentName": "Supervisor",
                                "action": "Planned execution workflow",
                                "rationale": rationale,
                                "observation": f"Tokens: {usage.get('inputTokens', '?')} in / {usage.get('outputTokens', '?')} out" if usage else None,
                            })

                    # Invocation input = calling a sub-agent / action group
                    if "invocationInput" in orch:
                        inv = orch["invocationInput"]
                        ag_input = inv.get("actionGroupInvocationInput", {})
                        ag_name = ag_input.get("actionGroupName", "")
                        api_path = ag_input.get("apiPath", "")
                        function_name = ag_input.get("function", "")
                        params = ag_input.get("parameters", [])

                        # Knowledge base retrieval
                        kb_input = inv.get("knowledgeBaseLookupInput", {})
                        kb_text = kb_input.get("text", "")

                        agent_name = resolve_agent(ag_name)
                        action = f"Invoking {agent_name}"
                        if api_path:
                            action = f"Calling {api_path}"
                        elif function_name:
                            action = f"Running {function_name}"
                        elif kb_text:
                            agent_name = "Grant Scout"
                            action = f"Searching knowledge base"

                        param_str = ", ".join([f"{p.get('name', '?')}={p.get('value', '?')[:50]}" for p in params[:3]]) if params else None

                        traces.append({
                            "type": "agent_invocation",
                            "agentName": agent_name,
                            "action": action,
                            "observation": param_str,
                        })

                    # Observation = result from sub-agent
                    if "observation" in orch:
                        obs = orch["observation"]
                        ag_output = obs.get("actionGroupInvocationOutput", {})
                        kb_output = obs.get("knowledgeBaseLookupOutput", {})
                        final_resp = obs.get("finalResponse", {})
                        reprompt = obs.get("repromptResponse", {})

                        observation_text = ""
                        agent_name = "Supervisor"

                        if ag_output:
                            observation_text = str(ag_output.get("text", ""))[:300]
                            agent_name = "Supervisor"  # Will be matched by frontend
                        elif kb_output:
                            refs = kb_output.get("retrievedReferences", [])
                            observation_text = f"Found {len(refs)} relevant documents"
                            if refs:
                                first_content = refs[0].get("content", {}).get("text", "")[:150]
                                if first_content:
                                    observation_text += f": {first_content}"
                            agent_name = "Grant Scout"
                        elif final_resp:
                            observation_text = str(final_resp.get("text", ""))[:300]
                        elif reprompt:
                            observation_text = str(reprompt.get("text", ""))[:200]

                        if observation_text:
                            traces.append({
                                "type": "observation",
                                "agentName": agent_name,
                                "action": "Received response",
                                "observation": observation_text,
                            })

                # Pre-processing traces (input parsing)
                if "preProcessingTrace" in trace_data:
                    pre = trace_data["preProcessingTrace"]
                    if "modelInvocationOutput" in pre:
                        parsed = pre["modelInvocationOutput"].get("parsedResponse", {})
                        if parsed.get("isValid") is not None:
                            traces.append({
                                "type": "planning",
                                "agentName": "Supervisor",
                                "action": "Validated user input" if parsed.get("isValid") else "Input validation issue",
                                "rationale": parsed.get("rationale", "")[:200] if parsed.get("rationale") else None,
                            })

                # Post-processing traces
                if "postProcessingTrace" in trace_data:
                    post = trace_data["postProcessingTrace"]
                    if "modelInvocationOutput" in post:
                        parsed = post["modelInvocationOutput"].get("parsedResponse", {})
                        if parsed.get("text"):
                            traces.append({
                                "type": "completion",
                                "agentName": "Supervisor",
                                "action": "Formatted final response",
                                "observation": parsed["text"][:200],
                            })

        return resp(200, {"completion": completion, "sessionId": session_id, "traces": traces})
    except ClientError as e:
        logger.error(f"Agent invocation failed: {e}")
        return resp(500, {"error": f"Agent error: {str(e)}"})


# ========== ROUTER ==========
def lambda_handler(event: dict, context: Any) -> dict:
    logger.info(f"API: {json.dumps(event)}")

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    params = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body", "{}") or "{}")

    if method == "OPTIONS":
        return resp(200, {"message": "OK"})

    try:
        # Profile
        if path == "/profile" and method == "POST":
            user_id = body.get("userId", "demo-user")
            return handle_profile_create(body, user_id)
        if path == "/profile" and method == "GET":
            return handle_profile_get(params)

        # Upload
        if path == "/upload-url" and method == "POST":
            return handle_upload(body)

        # Compliance
        if path == "/compliance/scan" and method == "POST":
            return handle_compliance_scan(body)
        if path == "/compliance/scan-batch" and method == "POST":
            return handle_compliance_scan_batch(body)
        if path == "/compliance" and method == "GET":
            return handle_compliance_get(params.get("ngoId", ""))

        # Grants
        if path == "/grants/search" and method == "POST":
            return handle_grants_search(body)

        # Proposals
        if path == "/proposals/generate" and method == "POST":
            return handle_proposal_generate(body)
        if path == "/proposals" and method == "GET":
            return handle_proposals_list(params.get("ngoId", ""))

        # Reports
        if path == "/reports/generate" and method == "POST":
            return handle_report_generate(body)

        # Agent
        if path == "/invoke-agent" and method == "POST":
            return handle_invoke_agent(body)

        return resp(404, {"error": f"Route {method} {path} not found."})

    except Exception as e:
        logger.exception(f"Error: {e}")
        return resp(500, {"error": str(e)})
