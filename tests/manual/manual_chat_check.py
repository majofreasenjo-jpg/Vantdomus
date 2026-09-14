import urllib.request, urllib.parse, json
p = urllib.parse.urlencode({'email': 'test@demo.com', 'password': 'demo123'})
req = urllib.request.Request('https://vantdomus-backend.onrender.com/auth/login?'+p, method='POST')
t = json.loads(urllib.request.urlopen(req).read())['access_token']
headers = {'Authorization': 'Bearer '+t, 'Content-Type': 'application/json'}

payload = {
    "household_id": "3694ea64-48c1-46a2-a6c2-89034490abb3",
    "messages": [
        {"role": "user", "content": "Ingresa urgente un insumo de 300 USD por explosivos y crea una mantención HIGH prioritaria para inspeccionar el túnel Sur porque hubo un leve derrumbe."}
    ]
}

req2 = urllib.request.Request(
    'https://vantdomus-backend.onrender.com/assistant/chat',
    data=json.dumps(payload).encode('utf-8'),
    headers=headers,
    method='POST'
)

try:
    res = urllib.request.urlopen(req2, timeout=60)
    print("STATUS:", res.status)
    print("BODY:", res.read().decode())
except Exception as e:
    print('ERROR:', e.read().decode() if hasattr(e, 'read') else e)
