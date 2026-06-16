import urllib.request
try:
    res = urllib.request.urlopen('https://vantdomus-backend.onrender.com/health', timeout=10)
    print("STATUS:", res.status)
    print("BODY:", res.read().decode())
except Exception as e:
    print('ERROR:', e)
