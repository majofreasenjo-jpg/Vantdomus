# VantDomus Improved

Version limpia y reorganizada de VantDomus / VantUnit. Esta copia fue creada para evolucionar el producto sin modificar el proyecto original ubicado en `D:\Aplicaciones de Juegos\VantDomus`.

## Enfoque del producto

VantDomus Improved consolida el proyecto como una plataforma B2B de inteligencia operacional adaptable por industria. El modelo central usa unidades operativas, personas, tareas, finanzas, salud/riesgo y taxonomias por industria para calcular indicadores ejecutivos como OSI, ESG, riesgo operacional y P&L.

El modo hogar/familia queda como caso de uso liviano o demo historica; la direccion principal recomendada es VantUnit B2B.

## Estructura

```text
apps/
  api/        FastAPI Core API
  web/        Panel operacional Next.js
  mobile/     App Expo / React Native
  marketing/  Sitio comercial Luxen/VantDomus
docs/         Documentacion del producto y material fuente
commercial/   Material comercial y propuestas
legacy/       Versiones antiguas y bundles historicos
data/         Material de trabajo y datasets no-productivos
tests/        Tests Python existentes
tools/        Scripts auxiliares y lanzadores Windows
```

## Arranque rapido

### API

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### Panel web

```powershell
cd apps/web
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abrir: http://localhost:3000

### Mobile

```powershell
cd apps/mobile
npm install
npm run start
```

## Cambios iniciales aplicados

- Se creo una copia independiente en `D:\Aplicaciones de Juegos\VantDomus_Improved`.
- Se reorganizo el repo en carpetas de producto, documentacion, legado, datos y herramientas.
- Se excluyeron archivos generados/pesados del primer copiado cuando fue posible: `.git`, `node_modules`, `.next`, backups, bases locales, tokens y zips.
- Se corrigio `apps/api/app/main.py`: `/health` ya no ejecuta escrituras ni usa IDs hardcodeados.
- CORS ahora se controla con `CORS_ALLOWED_ORIGINS`, con localhost como default.

## Siguiente mejora recomendada

Antes de usar datos reales de clientes, seguir el paquete de salida a produccion:

- `docs/PRODUCTION_READINESS_7_POINT_PLAN.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/STAGING_SMOKE_TEST.md`
- `docs/LEGAL_DATA_PROTECTION_PACK.md`
- `docs/env/api.production.env.example`
- `docs/env/web.production.env.example`

El gate local completo se ejecuta con:

```powershell
python tools/security_gate.py
```

La proxima mejora tecnica de producto deberia ser separar el agente IA en servicios pequenos:

- `assistant/prompts.py`
- `assistant/tools.py`
- `assistant/service.py`
- `assistant/schemas.py`

Eso reducira el archivo monolitico actual y hara mas seguro auditar acciones como crear tareas, registrar gastos o generar documentos.
