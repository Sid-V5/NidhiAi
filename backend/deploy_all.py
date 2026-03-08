"""Deploy all 4 Lambda functions to AWS."""
import os, zipfile, boto3, sys

lam = boto3.client('lambda', region_name='ap-south-1')

lambdas = {
    'nidhiai-match-grants': 'backend/lambdas/match_grants',
    'nidhiai-scan-documents': 'backend/lambdas/scan_documents',
    'nidhiai-generate-pdf': 'backend/lambdas/generate_pdf',
    'nidhiai-generate-report': 'backend/lambdas/generate_report',
}

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for fn_name, rel_path in lambdas.items():
    src_dir = os.path.join(root, rel_path)
    zip_path = os.path.join(src_dir, 'deploy.zip')
    
    print(f"\n--- Deploying {fn_name} ---")
    # Zip the handler
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for r, dirs, files in os.walk(src_dir):
            # Skip __pycache__, package dirs, deploy.zip itself
            if '__pycache__' in r or 'package' in r or '.git' in r:
                continue
            for f in files:
                if f == 'deploy.zip':
                    continue
                full = os.path.join(r, f)
                arcname = os.path.relpath(full, src_dir)
                zf.write(full, arcname)
    
    size = os.path.getsize(zip_path)
    print(f"  Zip size: {size:,} bytes")
    
    with open(zip_path, 'rb') as f:
        zip_content = f.read()
    
    try:
        resp = lam.update_function_code(
            FunctionName=fn_name,
            ZipFile=zip_content,
        )
        print(f"  Deployed: {resp['LastModified']}")
    except Exception as e:
        print(f"  ERROR: {str(e)[:200]}")
    
    os.remove(zip_path)

print("\n\nAll deployments complete!")
