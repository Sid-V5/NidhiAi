"""
Infrastructure setup: Create S3 buckets for NidhiAI.
Run: python infra/setup_s3.py
"""
import boto3, json, os

REGION = "ap-south-1"
s3 = boto3.client("s3", region_name=REGION)

BUCKETS = [
    "nidhiai-documents",            # User uploads
    "nidhiai-kb-csr-laws",          # KB1: CSR Laws source
    "nidhiai-kb-csr-opportunities", # KB2: Grant data source
    "nidhiai-kb-proposals",         # KB3: Sample proposals source
    "nidhiai-generated-pdfs",       # Generated proposals + reports
]

def create_buckets():
    for bucket in BUCKETS:
        try:
            s3.create_bucket(Bucket=bucket, CreateBucketConfiguration={"LocationConstraint": REGION})
            print(f"Created: {bucket}")
            # Enable server-side encryption
            s3.put_bucket_encryption(Bucket=bucket, ServerSideEncryptionConfiguration={
                "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
            })
            # Block public access
            s3.put_public_access_block(Bucket=bucket, PublicAccessBlockConfiguration={
                "BlockPublicAcls": True, "IgnorePublicAcls": True,
                "BlockPublicPolicy": True, "RestrictPublicBuckets": True
            })
            # Enable CORS for documents bucket
            if bucket == "nidhiai-documents":
                s3.put_bucket_cors(Bucket=bucket, CORSConfiguration={"CORSRules": [{
                    "AllowedHeaders": ["*"], "AllowedMethods": ["GET", "PUT", "POST"],
                    "AllowedOrigins": ["*"], "MaxAgeSeconds": 3000
                }]})
        except s3.exceptions.BucketAlreadyOwnedByYou:
            print(f"Exists: {bucket}")
        except Exception as e:
            print(f"Error creating {bucket}: {e}")

def upload_kb_data():
    """Upload KB source files from data/ directory."""
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    kb_mappings = {
        "kb_csr_laws": "nidhiai-kb-csr-laws",
        "kb_csr_opportunities": "nidhiai-kb-csr-opportunities",
        "kb_winning_proposals": "nidhiai-kb-proposals",
    }
    for folder, bucket in kb_mappings.items():
        folder_path = os.path.join(data_dir, folder)
        if not os.path.exists(folder_path):
            print(f"Skipping {folder} (not found)")
            continue
        for file_name in os.listdir(folder_path):
            file_path = os.path.join(folder_path, file_name)
            if os.path.isfile(file_path):
                try:
                    s3.upload_file(file_path, bucket, file_name)
                    print(f"Uploaded: {file_name} -> {bucket}")
                except Exception as e:
                    print(f"Error uploading {file_name}: {e}")

if __name__ == "__main__":
    print("=== Creating S3 Buckets ===")
    create_buckets()
    print("\n=== Uploading KB Data ===")
    upload_kb_data()
    print("\nDone! Next: Run setup_dynamodb.py")
