import boto3, json
apigw = boto3.client('apigatewayv2', region_name='ap-south-1')
apis = apigw.get_apis()['Items']
for a in apis:
    if 'Nidhi' in a.get('Name', ''):
        print(f"API: {a['Name']} ({a['ApiId']})")
        routes = apigw.get_routes(ApiId=a['ApiId'])['Items']
        for r in routes:
            print(f"  {r['RouteKey']} -> {r.get('Target', 'No Target')}")
        
        ints = apigw.get_integrations(ApiId=a['ApiId'])['Items']
        for i in ints:
            print(f"  Int: {i['IntegrationId']} -> {i.get('IntegrationUri')}")
