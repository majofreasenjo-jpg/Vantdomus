import urllib.request
import urllib.parse
import json
import time

BASE_URL = "https://vantdomus-backend.onrender.com"
EMAIL = "test@demo.com"
PASS = "demo123"
HID = "3694ea64-48c1-46a2-a6c2-89034490abb3"

def do_req(path, data=None, method="GET", token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    else:
        body = None
        
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

print("1. Haciendo Login...")
login_params = urllib.parse.urlencode({'email': EMAIL, 'password': PASS})
req_log = urllib.request.Request(f"{BASE_URL}/auth/login?{login_params}", method="POST")
with urllib.request.urlopen(req_log) as r:
    token = json.loads(r.read().decode())["access_token"]
print("Token obtenido.")

print("2. Creando Personal (Cuadrilla Minera)...")
persons = [
    {"display_name": "Juan Pérez", "relation": "Jefe de Turno"},
    {"display_name": "Carlos Mamani", "relation": "Operador Equipo Pesado"},
    {"display_name": "Luis Valdés", "relation": "Mecánico Especialista"}
]
pids = []
for p in persons:
    safe_name = urllib.parse.quote(p['display_name'])
    safe_rel = urllib.parse.quote(p['relation'])
    res = do_req(f"/persons?household_id={HID}&display_name={safe_name}&relation={safe_rel}", method="POST", token=token)
    pids.append(res["id"])
print(f"{len(pids)} personas creadas.")

print("3. Creando Mantenimientos (Tasks)...")
tasks = [
    {"title": "Revisión preventiva Motores CAT 793F", "priority": "high", "assigned_person_id": pids[2]},
    {"title": "Refuerzo estructural Galería Secundaria", "priority": "medium", "assigned_person_id": pids[1]},
    {"title": "Monitoreo de gases tóxicos nivel 4", "priority": "high", "assigned_person_id": pids[0]}
]
tids = []
for t in tasks:
    safe_title = urllib.parse.quote(t['title'])
    query = f"/tasks?household_id={HID}&title={safe_title}&priority={t['priority']}&assigned_person_id={t['assigned_person_id']}"
    res = do_req(query, method="POST", token=token)
    tids.append(res["id"])

# Completar una tarea para variar datos en el grafico
do_req(f"/tasks/{tids[0]}/done?household_id={HID}", method="POST", token=token)
print("Mantenimientos inyectados.")

print("4. Inyectando Movimientos Financieros (Insumos)...")
expenses = [
    {"amount": 15400.0, "category": "Mantenimiento", "merchant": "Proveedor Repuestos Mineros", "notes": "Rodamientos para cinta transportadora"},
    {"amount": 450.0, "category": "Combustible", "merchant": "Copec Industrial", "notes": "Llenado camioneta supervisión"},
    {"amount": 8000.0, "category": "Equipamiento", "merchant": "3M Safety", "notes": "Renovación EPP"}
]
for e in expenses:
    safe_cat = urllib.parse.quote(e['category'])
    safe_mer = urllib.parse.quote(e['merchant'])
    safe_not = urllib.parse.quote(e['notes'])
    query = f"/finance/expenses?household_id={HID}&amount={e['amount']}&category={safe_cat}&merchant={safe_mer}&notes={safe_not}"
    do_req(query, method="POST", token=token)
print("Presupuesto de insumos registrado.")

print("5. Detonando heurísticas e Inteligencia Artificial...")
do_req(f"/assistant/recommendations?household_id={HID}&refresh=true", token=token)
print("Planificador IA invocado y OSI Re-calculado.")

print("\n--- INYECCION DE MOCK DATA COMPLETADA ---")
