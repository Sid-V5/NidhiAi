import boto3
import json

def check_kb_status():
    client = boto3.client('bedrock-agent', region_name='ap-south-1')
    kb_id = 'WUIYUPN7I2'
    
    try:
        print(f"Checking Knowledge Base {kb_id}...")
        
        # Get data sources
        response = client.list_data_sources(
            knowledgeBaseId=kb_id,
            maxResults=10
        )
        
        data_sources = response.get('dataSourceSummaries', [])
        if not data_sources:
            print("❌ No data sources found for this Knowledge Base!")
            return
            
        for ds in data_sources:
            ds_id = ds['dataSourceId']
            name = ds['name']
            status = ds['status']
            print(f"\nData Source: {name} (ID: {ds_id})")
            print(f"Status: {status}")
            
            # Check ingestion jobs
            jobs_response = client.list_ingestion_jobs(
                knowledgeBaseId=kb_id,
                dataSourceId=ds_id,
                maxResults=5,
                sortBy={'attribute': 'STARTED_AT', 'order': 'DESCENDING'}
            )
            
            jobs = jobs_response.get('ingestionJobSummaries', [])
            if not jobs:
                print("❌ No sync jobs found for this data source!")
                print(f"Triggering sync for {ds_id}...")
                sync_resp = client.start_ingestion_job(
                    knowledgeBaseId=kb_id,
                    dataSourceId=ds_id
                )
                print(f"Sync started! Job ID: {sync_resp['ingestionJob']['ingestionJobId']}")
            else:
                for job in jobs:
                    print(f"  Job {job['ingestionJobId']}:")
                    print(f"  Status: {job['status']}")
                    print(f"  Started: {job['startedAt']}")
                    if 'statistics' in job:
                        print(f"  Stats: {job['statistics']}")
                    print("  ---")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_kb_status()
