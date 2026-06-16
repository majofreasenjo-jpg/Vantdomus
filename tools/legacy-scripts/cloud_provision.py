import urllib.request
import urllib.parse
import json
import time

BASE_URL = "https://vantdomus-backend.onrender.com"

# 1. Register
print("Intentando registrar usuario test@demo.com...")
params = urllib.parse.urlencode({'email': 'test@demo.com', 'password': 'demo123'})
req_reg = urllib.request.Request(f"{BASE_URL}/auth/register?{params}", method="POST")

try:
    with urllib.request.urlopen(req_reg) as r:
        print("Registrado:", r.read().decode())
except Exception as e:
        print(f"Omitiendo registro (podria ya existir): {e}")

time.sleep(1)

# 2. Login
print("\nLogueando...")
req_log = urllib.request.Request(f"{BASE_URL}/auth/login?{params}", method="POST")
try:
    with urllib.request.urlopen(req_log) as r:
        res = json.loads(r.read().decode())
        token = res["access_token"]
        print("Login Exitoso. Token:", token[:20], "...")
except Exception as e:
    print("Fallo el login!")
    print(e.read().decode() if hasattr(e, 'read') else str(e))
    exit(1)

# 3. List Households (if empty, we must create one)
print("\nRevisando hogares (unidades)...")
req_hh = urllib.request.Request(
    f"{BASE_URL}/households", 
    headers={"Authorization": f"Bearer {token}"}
)

with urllib.request.urlopen(req_hh) as r:
    hh_res = json.loads(r.read().decode())
    items = hh_res.get("items", [])
    print(f"Hogares encontrados: {len(items)}")

# 4. Create one if 0
if len(items) == 0:
    print("\nCreando hogar por defecto (Central VantUnit)...")
    name_encoded = urllib.parse.quote("Central VantUnit")
    req_create = urllib.request.Request(
        f"{BASE_URL}/households?name={name_encoded}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req_create) as r:
        new_hh = json.loads(r.read().decode())
        print("Hogar Creado ID:", new_hh["id"])
else:
    print("Hogar ID existente:", items[0]["id"])

print("\n=== TODO LISTO EN LA NUBE ===")
print("Puedes entrar a la app movil con:")
print("email: test@demo.com")
print("pass:  demo123")
