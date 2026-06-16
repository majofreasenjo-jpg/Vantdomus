import urllib.request, urllib.parse, json
p = urllib.parse.urlencode({'email': 'test@demo.com', 'password': 'demo123'})
req = urllib.request.Request('https://vantdomus-backend.onrender.com/auth/login?'+p, method='POST')
t = json.loads(urllib.request.urlopen(req).read())['access_token']

req2 = urllib.request.Request(
    'https://vantdomus-backend.onrender.com/households/2f2c226e-9733-495c-9490-fb3037acb0b0/dashboard',
    headers={'Authorization': 'Bearer '+t}
)
try:
    res = urllib.request.urlopen(req2, timeout=10)
    print("STATUS:", res.status)
except Exception as e:
    print('ERROR:', e.code if hasattr(e, 'code') else e)
