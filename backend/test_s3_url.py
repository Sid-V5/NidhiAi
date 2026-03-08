"""Check ALL prefixes in the bucket for the test PDF."""
import boto3
from botocore.config import Config

s3 = boto3.client("s3", region_name="ap-south-1",
                  endpoint_url="https://s3.ap-south-1.amazonaws.com",
                  config=Config(signature_version="s3v4"))

bucket = "nidhiai-generated-pdfs"

# Check the test prefix
resp = s3.list_objects_v2(Bucket=bucket, Prefix="ngo-test-pdf-fix/", MaxKeys=10)
objs = resp.get("Contents", [])
print(f"Test prefix files: {len(objs)}")
for obj in objs:
    key = obj["Key"]
    size = obj["Size"]
    head = s3.get_object(Bucket=bucket, Key=key, Range="bytes=0-9")
    first_bytes = head["Body"].read()
    is_pdf = first_bytes[:5] == b"%PDF-"
    print(f"  {'YES PDF' if is_pdf else 'NOT PDF'} | {size:>10,}B | {key}")
    if is_pdf:
        url = s3.generate_presigned_url("get_object", Params={
            "Bucket": bucket, "Key": key,
            "ResponseContentType": "application/pdf",
            "ResponseContentDisposition": "inline",
        }, ExpiresIn=3600)
        print(f"  URL: {url}")

if not objs:
    # Check everything
    print("\nChecking ALL recent files...")
    resp2 = s3.list_objects_v2(Bucket=bucket, MaxKeys=20)
    all_objs = sorted(resp2.get("Contents", []), key=lambda x: x["LastModified"], reverse=True)
    for obj in all_objs[:5]:
        key = obj["Key"]
        size = obj["Size"]
        mod = obj["LastModified"]
        head = s3.get_object(Bucket=bucket, Key=key, Range="bytes=0-9")
        first_bytes = head["Body"].read()
        is_pdf = first_bytes[:5] == b"%PDF-"
        print(f"  {'PDF' if is_pdf else 'TXT'} | {mod.strftime('%H:%M:%S')} | {size:>10,}B | {key}")
