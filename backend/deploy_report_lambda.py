"""Deploy ONLY the generate_report Lambda with fpdf2 properly bundled."""
import os, zipfile, boto3

lam = boto3.client('lambda', region_name='ap-south-1')
src_dir = r'c:\Users\Siddhant\NidhiAi\backend\lambdas\generate_report'
zip_path = os.path.join(src_dir, 'deploy.zip')

print("Building zip for nidhiai-generate-report...")

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in ('__pycache__', '.git')]
        for f in files:
            if f in ('deploy.zip', 'requirements.txt') or f.endswith('.pyc'):
                continue
            full_path = os.path.join(dirpath, f)
            rel = os.path.relpath(full_path, src_dir)
            if rel.startswith('package' + os.sep):
                arcname = rel[len('package' + os.sep):]
            else:
                arcname = rel
            zf.write(full_path, arcname)

with open(zip_path, 'rb') as f:
    zip_content = f.read()

print("Deploying to AWS...")
resp = lam.update_function_code(FunctionName='nidhiai-generate-report', ZipFile=zip_content)
print(f"  Deployed: {resp['LastModified']}")
print(f"  Code size: {resp['CodeSize']:,}")

os.remove(zip_path)

# Verify
import time
time.sleep(2)
cfg = lam.get_function_configuration(FunctionName='nidhiai-generate-pdf')
print(f"\nVerification:")
print(f"  CodeSize: {cfg['CodeSize']:,}")
print(f"  LastModified: {cfg['LastModified']}")
