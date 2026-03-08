"""Final PDF test — invoke Lambda, wait for Bedrock, check S3 output."""
import boto3, json, re, time
from botocore.config import Config

lam = boto3.client("lambda", region_name="ap-south-1")
s3 = boto3.client("s3", region_name="ap-south-1",
                  endpoint_url="https://s3.ap-south-1.amazonaws.com",
                  config=Config(signature_version="s3v4"))

payload = {
    "actionGroup": "generate_pdf",
    "function": "generateProposal",
    "parameters": [
        {"name": "ngoId", "value": "pdf-final-test"},
        {"name": "ngoName", "value": "Test NGO"},
        {"name": "sector", "value": "Education"},
        {"name": "ngoDescription", "value": "Education NGO in rural India"},
        {"name": "grantTitle", "value": "Quick Test Grant"},
        {"name": "grantCorporation", "value": "Tata"},
        {"name": "grantAmount", "value": "100000"},
    ]
}

print("Invoking nidhiai-generate-pdf (may take up to 90s for Bedrock)...")
start = time.time()
resp = lam.invoke(FunctionName="nidhiai-generate-pdf", Payload=json.dumps(payload))
elapsed = time.time() - start
print(f"Completed in {elapsed:.1f}s")

raw = resp["Payload"].read().decode("utf-8", errors="replace")
print(f"Response length: {len(raw)}")
print(f"FunctionError: {resp.get('FunctionError', 'None')}")

# Extract key info from raw response
url_match = re.search(r'"downloadUrl"\s*:\s*"(https?://[^"]+)"', raw)
key_match = re.search(r'"s3Key"\s*:\s*"([^"]+)"', raw)
status_match = re.search(r'"status"\s*:\s*"([^"]+)"', raw)

if status_match:
    print(f"Status: {status_match.group(1)}")
if key_match:
    s3_key = key_match.group(1)
    print(f"S3 Key: {s3_key}")
    
    # Check if it's a real PDF
    try:
        head = s3.get_object(Bucket="nidhiai-generated-pdfs", Key=s3_key, Range="bytes=0-10")
        first_bytes = head["Body"].read()
        is_pdf = first_bytes[:5] == b"%PDF-"
        print(f"First bytes: {first_bytes}")
        print(f"Valid PDF: {'YES! fpdf2 working!' if is_pdf else 'NO — still plain text fallback'}")
    except Exception as e:
        print(f"S3 error: {e}")
if url_match:
    url = url_match.group(1)
    is_regional = "s3.ap-south-1" in url
    print(f"Regional URL: {'YES' if is_regional else 'NO'}")
    print(f"URL: {url[:150]}...")

if not key_match and not url_match:
    # Check for errors
    err_match = re.search(r'"message"\s*:\s*"([^"]+)"', raw)
    if err_match:
        print(f"Error message: {err_match.group(1)}")
    print(f"\nFirst 500 chars of response:\n{raw[:500]}")
