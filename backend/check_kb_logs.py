import boto3
client = boto3.client('bedrock-agent', region_name='ap-south-1')
response = client.list_ingestion_jobs(
    knowledgeBaseId='WUIYUPN7I2',
    dataSourceId='XRHCWVJGHI',
    maxResults=5,
    sortBy={'attribute': 'STARTED_AT', 'order': 'DESCENDING'}
)

for job in response.get('ingestionJobSummaries', []):
    print(f"Job: {job['ingestionJobId']}")
    print(f"Status: {job['status']}")
    if 'failureReasons' in job:
        print(f"Failure Reasons: {job['failureReasons']}")
    if 'statistics' in job:
        print(f"Statistics: {job['statistics']}")
    print("---")
