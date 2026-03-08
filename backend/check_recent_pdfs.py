import boto3
from botocore.config import Config

s3 = boto3.client("s3", region_name="ap-south-1",
                  endpoint_url="https://s3.ap-south-1.amazonaws.com",
                  config=Config(signature_version="s3v4"))

r = s3.list_objects_v2(Bucket="nidhiai-generated-pdfs", MaxKeys=50)
objs = sorted(r.get("Contents", []), key=lambda x: x["LastModified"], reverse=True)
for o in objs[:5]:
    k = o["Key"]
    h = s3.get_object(Bucket="nidhiai-generated-pdfs", Key=k, Range="bytes=0-9")
    fb = h["Body"].read()
    tag = "PDF" if fb[:5] == b"%PDF-" else "TXT"
    print(f"{tag}: {o['LastModified']} | {o['Size']:>10,}B | {k}")
