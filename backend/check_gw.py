import boto3
lam = boto3.client("lambda", region_name="ap-south-1")
c = lam.get_function_configuration(FunctionName="nidhiai-api-gateway")
print(f"Timeout: {c['Timeout']}s  Memory: {c['MemorySize']}MB")
