import boto3
lam = boto3.client("lambda", region_name="ap-south-1")
c = lam.get_function_configuration(FunctionName="nidhiai-generate-pdf")
print(f"LastModified: {c['LastModified']}")
print(f"CodeSize: {c['CodeSize']:,}")
print(f"Timeout: {c['Timeout']}s")
print(f"Memory: {c['MemorySize']}MB")
print(f"Runtime: {c['Runtime']}")

# Also check the report lambda
c2 = lam.get_function_configuration(FunctionName="nidhiai-generate-report")
print(f"\nReport Lambda:")
print(f"  Timeout: {c2['Timeout']}s | Memory: {c2['MemorySize']}MB | CodeSize: {c2['CodeSize']:,}")
