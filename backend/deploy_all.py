"""Deploy all 4 Lambda functions to AWS — includes package/ dependencies."""
import os, zipfile, boto3

lam = boto3.client('lambda', region_name='ap-south-1')

lambdas = {
    'nidhiai-match-grants': 'backend/lambdas/match_grants',
    'nidhiai-scan-documents': 'backend/lambdas/scan_documents',
    'nidhiai-generate-pdf': 'backend/lambdas/generate_pdf',
    'nidhiai-generate-report': 'backend/lambdas/generate_report',
}

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_PATTERNS = {'__pycache__', '.git', 'deploy.zip', '*.pyc'}

def should_skip(path):
    parts = path.replace('\\', '/').split('/')
    return any(p in SKIP_PATTERNS or p.endswith('.pyc') for p in parts)

for fn_name, rel_path in lambdas.items():
    src_dir = os.path.join(root, rel_path)
    zip_path = os.path.join(src_dir, 'deploy.zip')
    
    print(f"\n--- Deploying {fn_name} ---")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirs, files in os.walk(src_dir):
            # Skip __pycache__ and .git
            dirs[:] = [d for d in dirs if d not in ('__pycache__', '.git')]
            
            for f in files:
                if f in ('deploy.zip', 'requirements.txt') or f.endswith('.pyc'):
                    continue
                
                full_path = os.path.join(dirpath, f)
                rel = os.path.relpath(full_path, src_dir)
                
                # If file is inside package/, strip the 'package/' prefix
                # so fpdf2 is importable at root level in Lambda
                if rel.startswith('package' + os.sep):
                    arcname = rel[len('package' + os.sep):]
                else:
                    arcname = rel
                
                zf.write(full_path, arcname)
    
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
