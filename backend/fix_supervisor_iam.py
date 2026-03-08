import boto3
import json

def fix_iam_permissions():
    client_bedrock = boto3.client('bedrock-agent', region_name='ap-south-1')
    client_iam = boto3.client('iam')
    sts_client = boto3.client('sts')

    agent_id = 'HB82HPMIA3'
    kb_id = 'WUIYUPN7I2'

    try:
        account_id = sts_client.get_caller_identity()["Account"]
        
        print(f"Fetching Supervisor Agent ({agent_id})...")
        ag = client_bedrock.get_agent(agentId=agent_id)['agent']
        role_arn = ag['agentResourceRoleArn']
        role_name = role_arn.split('/')[-1]
        print(f"Found Agent Role: {role_name}")

        kb_arn = f"arn:aws:bedrock:ap-south-1:{account_id}:knowledge-base/{kb_id}"
        
        policy_doc = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "bedrock:Retrieve"
                    ],
                    "Resource": [
                        kb_arn
                    ]
                }
            ]
        }
        
        print("Attaching 'bedrock:Retrieve' policy to the role...")
        client_iam.put_role_policy(
            RoleName=role_name,
            PolicyName='AllowCSRKnowledgeBaseRetrieve',
            PolicyDocument=json.dumps(policy_doc)
        )
        print("✅ Policy attached successfully! The Supervisor can now read the Knowledge Base.")
        print("Please wait ~10-15 seconds for AWS IAM permissions to propagate before testing again in the console.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_iam_permissions()
