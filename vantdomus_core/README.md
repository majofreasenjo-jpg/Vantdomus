# VantDomus v0.4 (FULL) — SQLite + Panel + Planning Assistant (B + D)

Este bundle incluye:
- `vantdomus_core/` (FastAPI + SQLite) con Salud/Adherencia, Tasks, Finance, Scores/HSI y Planning Assistant (recomendaciones + aplicar ⇒ crea tareas).
- `vantdomus_panel/` (Next.js 14) con Dashboard + Tasks + Finance + Person Health.

## Requisitos
- Python 3.11+
- Node 18+

## 1) Backend
```bash
cd vantdomus_core
python -m venv .venv
# Windows: .venv\Scripts\activate
# mac/linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```
La DB se crea automáticamente en `vantdomus_core/vantdomus.db` al primer arranque.

## 2) Crear usuario y household (rápido)
```bash
# register
curl -X POST "http://127.0.0.1:8001/auth/register?email=test@demo.com&password=demo123"

# login -> copia access_token
curl -X POST "http://127.0.0.1:8001/auth/login?email=test@demo.com&password=demo123"

# create household (usa el token)
curl -X POST "http://127.0.0.1:8001/households?name=Familia%20Perez" -H "Authorization: Bearer <TOKEN>"
```
Luego puedes seed demo:
```bash
curl -X POST "http://127.0.0.1:8001/demo/seed?household_id=<HID>&mode=home" -H "Authorization: Bearer <TOKEN>"
```

## 3) Panel
```bash
cd ../vantdomus_panel
npm i
cp .env.example .env.local
# edita .env.local con tu TOKEN y HID
npm run dev
```
Abrir: http://localhost:3000/dashboard/<HID>

## Planning Assistant (B + D)
- Dashboard muestra recomendaciones (si hay).
- Botón **Aplicar** crea tareas automáticamente.
- Endpoint `/assistant/plan` deja listo el contrato para un asistente conversacional futuro.
