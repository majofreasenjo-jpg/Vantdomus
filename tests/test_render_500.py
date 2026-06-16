import urllib.request

req = urllib.request.Request(
    'https://vantdomus-backend.onrender.com/households/2f2c226e-9733-495c-9490-fb3037acb0b0/dashboard',
    headers={'Authorization': 'Bearer PASTE_TEST_JWT'}
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
    else:
        print(e)
