"""
Compliance Agent - scan_documents Lambda Action Group
Invokes Amazon Textract to extract text from NGO compliance documents,
validates certificate validity dates, and stores results in DynamoDB.
"""

import json
import re
import time
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
textract = boto3.client("textract", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-south-1"))

COMPLIANCE_TABLE = os.environ.get("DYNAMODB_COMPLIANCE_TABLE", "nidhiai-compliance-results")
NGO_PROFILES_TABLE = os.environ.get("DYNAMODB_NGO_PROFILES_TABLE", "nidhiai-ngo-profiles")

# Date patterns for Indian certificates
DATE_PATTERNS = [
    r"\b(\d{2}[-/]\d{2}[-/]\d{4})\b",
    r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b",
    r"\b(\d{1,2}\s(?:January|February|March|April|May|June|July|August|September|October|November|December)\s\d{4})\b",
    r"\b(\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4})\b",
]

EXPIRY_KEYWORDS = ["valid until", "valid upto", "validity", "expiry date", "expires on", "valid till", "valid up to"]
ISSUE_KEYWORDS = ["date of order", "issued on", "date of issue", "issue date", "dated"]
REG_NUMBER_PATTERNS = [
    r"\b([A-Z]{2,5}/\d+/\d{4}[-/]\d{2,4})\b",
    r"\b(AAATS\d+[A-Z]/\d+[A-Z])\b",
    r"\b(\d{5,6}[A-Z]?\s*/\s*\d{4})\b",
]


def parse_date(date_str: str) -> datetime | None:
    """Try multiple date formats to parse a date string."""
    formats = [
        "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d",
        "%d %B %Y", "%d %b %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def extract_dates_from_text(text: str) -> dict:
    """Extract validity and issue dates from certificate text."""
    text_lower = text.lower()
    lines = text.split("\n")
    issue_date = None
    expiry_date = None
    registration_number = None

    # Find lines containing expiry keywords, then extract date from those lines
    for line in lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in EXPIRY_KEYWORDS):
            for pattern in DATE_PATTERNS:
                matches = re.findall(pattern, line, re.IGNORECASE)
                if matches and not expiry_date:
                    expiry_date = parse_date(matches[0])
        if any(kw in line_lower for kw in ISSUE_KEYWORDS):
            for pattern in DATE_PATTERNS:
                matches = re.findall(pattern, line, re.IGNORECASE)
                if matches and not issue_date:
                    issue_date = parse_date(matches[0])

    # If no context-aware date found, fall back to first/last dates in document
    if not expiry_date:
        all_dates = []
        for pattern in DATE_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for m in matches:
                d = parse_date(m)
                if d:
                    all_dates.append(d)
        if len(all_dates) >= 2:
            all_dates.sort()
            issue_date = issue_date or all_dates[0]
            expiry_date = all_dates[-1]
        elif len(all_dates) == 1:
            expiry_date = all_dates[0]

    # Find registration number
    for pattern in REG_NUMBER_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            registration_number = matches[0]
            break

    return {
        "issueDate": issue_date.isoformat() if issue_date else None,
        "expiryDate": expiry_date.isoformat() if expiry_date else None,
        "registrationNumber": registration_number,
    }


def validate_compliance(extracted_dates: dict) -> dict:
    """Determine compliance status from extracted dates."""
    expiry_str = extracted_dates.get("expiryDate")
    now = datetime.now(timezone.utc)
    warnings = []

    if not expiry_str:
        return {
            "isValid": False,
            "status": "invalid",
            "daysUntilExpiry": None,
            "warnings": ["No expiry date found in document. Manual review required."],
        }

    try:
        expiry = datetime.fromisoformat(expiry_str)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        days_until_expiry = (expiry - now).days
    except (ValueError, TypeError):
        return {
            "isValid": False,
            "status": "invalid",
            "daysUntilExpiry": None,
            "warnings": ["Could not parse expiry date. Manual review required."],
        }

    if days_until_expiry < 0:
        status = "expired"
        is_valid = False
        warnings.append(f"Certificate expired {abs(days_until_expiry)} days ago.")
    elif days_until_expiry <= 30:
        status = "expiring_soon"
        is_valid = True
        warnings.append(f"Certificate expires in {days_until_expiry} days. Renew soon.")
    else:
        status = "valid"
        is_valid = True

    return {
        "isValid": is_valid,
        "status": status,
        "daysUntilExpiry": days_until_expiry,
        "warnings": warnings,
    }


def call_textract_with_retry(bucket: str, key: str, max_retries: int = 3) -> dict:
    """Call Textract with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            response = textract.analyze_document(
                Document={"S3Object": {"Bucket": bucket, "Name": key}},
                FeatureTypes=["FORMS"],
            )
            return response
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code in ("ProvisionedThroughputExceededException", "ThrottlingException"):
                if attempt < max_retries - 1:
                    wait = (2 ** attempt) * 0.5
                    logger.warning(f"Textract throttled. Retrying in {wait}s (attempt {attempt + 1})")
                    time.sleep(wait)
                else:
                    raise
            else:
                raise
    raise RuntimeError("Textract failed after max retries")


def extract_text_from_textract_response(response: dict) -> tuple[str, float]:
    """Extract full text and average confidence from Textract response."""
    blocks = response.get("Blocks", [])
    text_parts = []
    confidences = []

    for block in blocks:
        if block["BlockType"] == "LINE":
            text_parts.append(block.get("Text", ""))
            confidences.append(block.get("Confidence", 0))

    full_text = "\n".join(text_parts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return full_text, avg_confidence / 100.0


def store_compliance_result(ngo_id: str, doc_type: str, result: dict) -> None:
    """Store compliance result in DynamoDB."""
    table = dynamodb.Table(COMPLIANCE_TABLE)
    table.put_item(
        Item={
            "ngoId": ngo_id,
            "documentType": doc_type,
            "complianceResult": json.dumps(result),
            "processedAt": datetime.now(timezone.utc).isoformat(),
            "status": result.get("validationResult", {}).get("status", "invalid"),
        }
    )


def scan_single_document(bucket: str, key: str, doc_type: str, ngo_id: str) -> dict:
    """Scan a single document - used as a unit of work for parallel execution."""
    start_time = time.time()
    try:
        textract_response = call_textract_with_retry(bucket, key)
        full_text, confidence = extract_text_from_textract_response(textract_response)
        extracted_dates = extract_dates_from_text(full_text)
        validation_result = validate_compliance(extracted_dates)
        elapsed = time.time() - start_time

        result = {
            "s3Key": key,
            "ngoId": ngo_id,
            "documentType": doc_type,
            "extractedText": full_text[:2000],
            "validityDates": extracted_dates,
            "validationResult": validation_result,
            "confidence": confidence,
            "lowConfidence": confidence < 0.90,
            "processedAt": datetime.now(timezone.utc).isoformat(),
            "processingTimeMs": int(elapsed * 1000),
        }
        if ngo_id:
            store_compliance_result(ngo_id, doc_type, result)
        
        # Strip the massive extracted text so we don't blow up the Agent's context limit
        agent_friendly_result = result.copy()
        if "extractedText" in agent_friendly_result:
            del agent_friendly_result["extractedText"]
            
        return agent_friendly_result
    except Exception as e:
        return {"documentType": doc_type, "s3Key": key, "error": str(e), "processingTimeMs": int((time.time() - start_time) * 1000)}


def scan_documents_parallel(documents: list, ngo_id: str) -> dict:
    """
    PARALLEL SCANNING: Process all compliance documents simultaneously.
    Fires 3 Textract requests in parallel via ThreadPoolExecutor.
    Impact: Document verification takes ~5s instead of ~15s.
    """
    start_time = time.time()
    results = []
    errors = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(
                scan_single_document,
                doc["s3Bucket"], doc["s3Key"], doc["documentType"], ngo_id
            ): doc["documentType"]
            for doc in documents
        }
        for future in as_completed(futures):
            doc_type = futures[future]
            try:
                result = future.result()
                if "error" in result:
                    errors.append(result)
                else:
                    results.append(result)
            except Exception as e:
                errors.append({"documentType": doc_type, "error": str(e)})

    total_time = int((time.time() - start_time) * 1000)

    # Calculate overall compliance
    valid_count = sum(1 for r in results if r.get("validationResult", {}).get("isValid", False))
    total_count = len(results)
    compliance_score = (valid_count / total_count * 100) if total_count > 0 else 0

    summary_parts = [f"Scanned {len(results)} documents in parallel ({total_time}ms total)."]
    for r in results:
        dt = r["documentType"]
        status = r.get("validationResult", {}).get("status", "unknown").upper()
        summary_parts.append(f"{dt}: {status}")
    if errors:
        summary_parts.append(f"{len(errors)} document(s) failed to scan.")
    summary_parts.append(f"Overall compliance: {compliance_score:.0f}%")

    return {
        "results": results,
        "errors": errors,
        "complianceScore": compliance_score,
        "totalProcessingTimeMs": total_time,
        "parallelExecution": True,
        "summary": " ".join(summary_parts),
    }


def lambda_handler(event: dict, context: Any) -> dict:
    """
    Main Lambda handler for scan_documents action group.
    Bedrock Agents will call this with action group invocation format.
    """
    logger.info(f"Event: {json.dumps(event)}")

    # Extract action group parameters from Bedrock Agents format
    action_group = event.get("actionGroup", "scan_documents")
    api_path = event.get("apiPath", "/scan-document")
    function_name = event.get("function", "")  # function-style invocation
    is_function_style = bool(function_name)
    request_body = event.get("requestBody", {})

    def _build_resp(body, code=200):
        body_str = json.dumps(body)
        if is_function_style:
            return {"messageVersion":"1.0","response":{"actionGroup":action_group,"function":function_name,
                    "functionResponse":{"responseBody":{"TEXT":{"body":body_str}}}}}
        return {"messageVersion":"1.0","response":{"actionGroup":action_group,"apiPath":api_path,
                "httpMethod":"POST","httpStatusCode":code,"responseBody":{"application/json":{"body":body_str}}}}

    def _parse_params():
        if is_function_style:
            params_list = event.get("parameters", [])
            return {p["name"]: p["value"] for p in params_list}
        body_content = request_body.get("content", {})
        props = body_content.get("application/json", {}).get("properties", [])
        return {p["name"]: p["value"] for p in props}

    # ---- BATCH MODE: Parallel scanning of all documents ----
    if api_path == "/scan-documents-batch" or function_name == "scanDocumentsBatch":
        try:
            params = _parse_params()
            ngo_id = params.get("ngoId", "")
            documents_str = params.get("documents", "[]")
            documents = json.loads(documents_str) if isinstance(documents_str, str) else documents_str

            if not documents:
                raise ValueError("documents array is required for batch scanning")

            logger.info(f"PARALLEL BATCH SCAN: {len(documents)} documents for NGO {ngo_id}")
            batch_result = scan_documents_parallel(documents, ngo_id)

            return _build_resp({"status": "success", **batch_result}, 200)
        except Exception as e:
            logger.error(f"Batch scan failed: {e}")
            return _build_resp({"status": "error", "message": str(e)}, 500)

    # ---- SINGLE MODE: Original single-document scan ----
    # Parse input from Bedrock Agent invocation
    try:
        params = _parse_params()

        s3_bucket = params.get("s3Bucket", "")
        s3_key = params.get("s3Key", "")
        ngo_id = params.get("ngoId", "")
        doc_type = params.get("documentType", "unknown")

        if not s3_bucket or not s3_key:
            raise ValueError("s3Bucket and s3Key are required parameters")

    except Exception as e:
        logger.error(f"Parameter parsing failed: {e}")
        return _build_resp({"status": "error", "message": str(e)}, 400)

    try:
        # Step 1: Call Textract
        logger.info(f"Running Textract on s3://{s3_bucket}/{s3_key}")
        textract_response = call_textract_with_retry(s3_bucket, s3_key)

        # Step 2: Extract text and confidence
        full_text, confidence = extract_text_from_textract_response(textract_response)
        logger.info(f"Textract confidence: {confidence:.2%}, text length: {len(full_text)} chars")

        # Step 3: Check confidence threshold
        low_confidence = confidence < 0.90
        if low_confidence:
            logger.warning(f"Low Textract confidence ({confidence:.2%}) for {s3_key}")

        # Step 4: Extract dates and registration number
        extracted_dates = extract_dates_from_text(full_text)
        logger.info(f"Extracted dates: {extracted_dates}")

        # Step 5: Validate compliance
        validation_result = validate_compliance(extracted_dates)

        result = {
            "s3Key": s3_key,
            "ngoId": ngo_id,
            "documentType": doc_type,
            "extractedText": full_text[:2000],  # truncate for DynamoDB
            "validityDates": extracted_dates,
            "validationResult": validation_result,
            "confidence": confidence,
            "lowConfidence": low_confidence,
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Step 6: Store in DynamoDB
        if ngo_id:
            store_compliance_result(ngo_id, doc_type, result)

        # Format response for Bedrock Agents
        compliance_summary = (
            f"Document type: {doc_type}. "
            f"Status: {validation_result['status'].upper()}. "
            f"Expiry date: {extracted_dates.get('expiryDate', 'not found')}. "
            f"Registration number: {extracted_dates.get('registrationNumber', 'not found')}. "
        )
        if validation_result.get("warnings"):
            compliance_summary += " ".join(validation_result["warnings"])
        if low_confidence:
            compliance_summary += " Warning: Low OCR confidence - manual review recommended."

        return _build_resp({"status": "success", "complianceResult": result, "summary": compliance_summary}, 200)

    except ClientError as e:
        logger.error(f"AWS service error: {e}")
        return _build_resp({"status": "error", "message": "We couldn't read your document. Please upload a higher quality scan."}, 500)
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return _build_resp({"status": "error", "message": "An unexpected error occurred. Please try again."}, 500)
