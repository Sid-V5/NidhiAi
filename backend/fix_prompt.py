import boto3

def fix_prompt_xml_issue():
    client = boto3.client('bedrock-agent', region_name='ap-south-1')
    agent_id = 'HB82HPMIA3'
    
    print("Fetching Supervisor Agent...")
    ag = client.get_agent(agentId=agent_id)['agent']
    current_instruction = ag['instruction']
    
    # We will enforce native tool use
    if "XML tags like <__function>" not in current_instruction:
        print("Injecting anti-XML-hallucination instruction...")
        new_instruction = current_instruction + "\n\nCRITCAL SYSTEM RESTRICTION: You are powered by Amazon Nova. When you need to search the knowledge base, YOU MUST use the provided JSON tool interface. UNDER NO CIRCUMSTANCES should you output raw XML tags like <__function> or <__parameter>. Always trigger the knowledge base tool natively."
        
        client.update_agent(
            agentId=agent_id,
            agentName=ag['agentName'],
            agentResourceRoleArn=ag['agentResourceRoleArn'],
            foundationModel=ag['foundationModel'],
            instruction=new_instruction,
            agentCollaboration=ag.get('agentCollaboration', 'SUPERVISOR')
        )
        print("Preparing Agent...")
        client.prepare_agent(agentId=agent_id)
        print("Done!")
    else:
        print("Instruction already patched.")

if __name__ == "__main__":
    fix_prompt_xml_issue()
