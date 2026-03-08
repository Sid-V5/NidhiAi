import boto3

def update_supervisor():
    client = boto3.client('bedrock-agent', region_name='ap-south-1')
    agent_id = 'HB82HPMIA3'
    kb_id = 'WUIYUPN7I2'
    
    print("Fetching Supervisor Agent...")
    ag = client.get_agent(agentId=agent_id)['agent']
    
    new_instruction = ag['instruction']
    if "CSR Assistant chatbot" not in new_instruction:
        new_instruction += "\n\n10. You are also a knowledgeable CSR Assistant chatbot. If the user asks general questions about CSR laws, regulations, Indian NGO compliance, Section 135, FCRA, Schedule VII, or general CSR funding, you MUST answer them directly and fully by querying your attached Knowledge Base. Do NOT refuse."
    
    print("Updating Agent Prompt...")
    client.update_agent(
        agentId=agent_id,
        agentName=ag['agentName'],
        agentResourceRoleArn=ag['agentResourceRoleArn'],
        foundationModel=ag['foundationModel'],
        instruction=new_instruction,
        agentCollaboration=ag.get('agentCollaboration', 'SUPERVISOR')
    )
    
    print("Associating Knowledge Base...")
    try:
        client.associate_agent_knowledge_base(
            agentId=agent_id,
            agentVersion='DRAFT',
            knowledgeBaseId=kb_id,
            description='Contains official documents, laws, and regulations regarding CSR in India (Section 135, FCRA, etc.)',
            knowledgeBaseState='ENABLED'
        )
        print("KB Associated!")
    except Exception as e:
        if "ConflictException" in str(e) or "ValidationException" in str(e):
            print("KB is likely already associated or there is a minor conflict: ", e)
        else:
            raise e

    print("Preparing Agent...")
    client.prepare_agent(agentId=agent_id)
    print("Done! Supervisor Agent is now fully equipped to answer CSR queries using the KB.")

if __name__ == "__main__":
    update_supervisor()
