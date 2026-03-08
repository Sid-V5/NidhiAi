import boto3
from botocore.config import Config

s3 = boto3.client("s3", region_name="ap-south-1",
                  endpoint_url="https://s3.ap-south-1.amazonaws.com",
                  config=Config(signature_version="s3v4"))

# Check test files
for prefix in ["unknown/proposals/", "pdf-final-test/proposals/"]:
    r = s3.list_objects_v2(Bucket="nidhiai-generated-pdfs", Prefix=prefix, MaxKeys=5)
    objs = sorted(r.get("Contents", []), key=lambda x: x["LastModified"], reverse=True)
    for o in objs[:3]:
        k = o["Key"]
        h = s3.get_object(Bucket="nidhiai-generated-pdfs", Key=k, Range="bytes=0-9")
        fb = h["Body"].read()
        is_pdf = fb[:5] == b"%PDF-"
        tag = "PDF" if is_pdf else "TXT"
        print(f"{tag}: {o['Size']:>10,}B | {k}")
        if is_pdf:
            url = s3.generate_presigned_url("get_object", Params={
                "Bucket": "nidhiai-generated-pdfs", "Key": k,
                "ResponseContentType": "application/pdf",
                "ResponseContentDisposition": "inline",
            }, ExpiresIn=3600)
            print(f"  URL: {url[:120]}")
