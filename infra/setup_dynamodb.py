"""
Infrastructure setup: Create DynamoDB tables for NidhiAI.
Run: python infra/setup_dynamodb.py
"""
import boto3

REGION = "ap-south-1"
dynamodb = boto3.client("dynamodb", region_name=REGION)

TABLES = [
    {
        "TableName": "nidhiai-ngo-profiles",
        "KeySchema": [{"AttributeName": "ngoId", "KeyType": "HASH"}],
        "AttributeDefinitions": [
            {"AttributeName": "ngoId", "AttributeType": "S"},
            {"AttributeName": "userId", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [{
            "IndexName": "userId-index",
            "KeySchema": [{"AttributeName": "userId", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"},
        }],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "nidhiai-compliance-results",
        "KeySchema": [
            {"AttributeName": "ngoId", "KeyType": "HASH"},
            {"AttributeName": "documentType", "KeyType": "RANGE"},
        ],
        "AttributeDefinitions": [
            {"AttributeName": "ngoId", "AttributeType": "S"},
            {"AttributeName": "documentType", "AttributeType": "S"},
        ],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "nidhiai-proposals",
        "KeySchema": [{"AttributeName": "proposalId", "KeyType": "HASH"}],
        "AttributeDefinitions": [
            {"AttributeName": "proposalId", "AttributeType": "S"},
            {"AttributeName": "ngoId", "AttributeType": "S"},
            {"AttributeName": "createdAt", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [{
            "IndexName": "ngoId-createdAt-index",
            "KeySchema": [
                {"AttributeName": "ngoId", "KeyType": "HASH"},
                {"AttributeName": "createdAt", "KeyType": "RANGE"},
            ],
            "Projection": {"ProjectionType": "ALL"},
        }],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "nidhiai-documents",
        "KeySchema": [{"AttributeName": "documentId", "KeyType": "HASH"}],
        "AttributeDefinitions": [
            {"AttributeName": "documentId", "AttributeType": "S"},
            {"AttributeName": "ngoId", "AttributeType": "S"},
            {"AttributeName": "documentType", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [{
            "IndexName": "ngoId-documentType-index",
            "KeySchema": [
                {"AttributeName": "ngoId", "KeyType": "HASH"},
                {"AttributeName": "documentType", "KeyType": "RANGE"},
            ],
            "Projection": {"ProjectionType": "ALL"},
        }],
        "BillingMode": "PAY_PER_REQUEST",
    },
]

def create_tables():
    for table_config in TABLES:
        name = table_config["TableName"]
        try:
            dynamodb.create_table(**table_config)
            print(f"Creating: {name}")
            waiter = dynamodb.get_waiter("table_exists")
            waiter.wait(TableName=name)
            print(f"Ready: {name}")
        except dynamodb.exceptions.ResourceInUseException:
            print(f"Exists: {name}")
        except Exception as e:
            print(f"Error: {name} - {e}")

if __name__ == "__main__":
    print("=== Creating DynamoDB Tables ===")
    create_tables()
    print("\nDone! Next: Set up Cognito and Bedrock Agents in AWS Console.")
