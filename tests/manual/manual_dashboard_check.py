import urllib.request, urllib.parse, json
p = urllib.parse.urlencode({'email': 'test@demo.com', 'password': 'demo123'})
req = urllib.request.Request('https://vantdomus-backend.onrender.com/auth/login?'+p, method='POST')
t = json.loads(urllib.request.urlopen(req).read())['access_token']
headers = {'Authorization': 'Bearer '+t}

for url in [
    'https://vantdomus-backend.onrender.com/households/3694ea64-48c1-46a2-a6c2-89034490abb3/dashboard',
    'https://vantdomus-backend.onrender.com/scores/latest?household_id=3694ea64-48c1-46a2-a6c2-89034490abb3',
    'https://vantdomus-backend.onrender.com/assistant/recommendations?household_id=3694ea64-48c1-46a2-a6c2-89034490abb3&refresh=false'
]:
    req2 = urllib.request.Request(url, headers=headers)
    try:
        res = urllib.request.urlopen(req2)
        print(url, "STATUS:", res.status)
    except Exception as e:
        print(url, 'ERROR:', e.code if hasattr(e, 'code') else e)
