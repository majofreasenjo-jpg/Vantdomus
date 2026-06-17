# Handoff: Cowork → Claude Code

> Este documento es un **paquete de transferencia autocontenido** desde
> "Claude en Cowork mode" (el ambiente conversacional) hacia "Claude Code"
> (la CLI). Tras un sprint largo de arquitectura + UI implementado en
> Cowork, el siguiente bloque de trabajo (deploy + runtime real + debug)
> es más eficiente en Code.
>
> **Si sos Code leyendo esto**: leelo entero antes de tocar nada. Al
> final hay una sección "Tu primer comando" que te dice exactamente por
> dónde empezar.
>
> **Última actualización**: junio 2026. Estado al cierre del Sprint VG+2.

---

## 1. Qué es VantDomus

Plataforma multi-componente para una guía inteligente de funciones por
integrante de una unidad. En modo familia se muestra como "Guía Familiar".
En B2B (minería, oficina técnica, clínica, residencia, cuadrilla) se
muestra con nombres equivalentes según el preset (`Guía Operativa`,
`Guía de Cuidado`, etc.). El motor técnico interno se llama VantGuide y
la entidad central es `unit_function`.

Componentes:
- **API FastAPI** (`apps/api/`, Python) — SQLite local, Postgres prod
- **Panel web Next.js 16** (`apps/web/`) — App Router, Server Components
- **App mobile Expo/React Native** (`apps/mobile/`) — soporta iOS, Android, web
- **Sitio comercial Luxen** (`apps/marketing/`) — Next.js landings

Dueño del producto: **Manuel** (majofreasenjo@gmail.com).

## 2. Stack y versiones críticas

- Python 3.14.2 instalado en su PC (la versión nueva — algunos pkgs sin wheels)
- Node v24.12.0
- Git ya configurado: user.email `majofreasenjo@gmail.com`, user.name `Manuel`
- Repo: `https://github.com/majofreasenjo-jpg/Vantdomus` (private)
- Branch principal: `main` (sincroniza con `master` local via push)
- Tag baseline: `baseline-secure-2026-05` (commit `d309487`)

## 3. Decisiones arquitectónicas vivas

Las decisiones de diseño están plasmadas en `docs/VANTGUIDE_ARCHITECTURE.md`.
Versión 1.1 al cierre. **No re-discutas esas decisiones sin pasar por el
co-arquitecto externo** (Codex/ChatGPT) — Manuel ya las validó dos veces
con él, y rediseñar inventa entropía.

Resumen del modelo:
- `unit_functions` — entidad central. Cualquier cosa que toca cumplir.
- `function_events` — timeline (scheduled / reminded / completed / missed / escalated).
- `evidence_items` — prueba concreta (positiva o **negativa** explícita).
- `memory_items` — memoria estructurada de largo plazo, vive en VantDomus, NO en el LLM.
- `progress_snapshots` — agregados por persona+categoría+periodo.
- `person_support_profile` — perfil adaptativo con lenguaje **no clínico**.
- `reward_rules` + `reward_events` — recompensas declarativas.
- `unit_function_versions` — snapshot completo de cada cambio en una función.
- `unit_function_responsibles` — múltiples responsables (primary_caregiver,
  secondary_caregiver, parent, guardian, doctor_viewer, supervisor, etc.).
- `scheduler_runs` — métricas + sentinel lock fallback para SQLite.

**Reglas inviolables**:
- La memoria vive en VantDomus. El modelo LLM solo recibe contexto curado
  por el backend, filtrado por rol y consentimiento.
- El lenguaje de `person_support_profile` no es diagnóstico clínico. Usa
  `attention_profile`, `calm_tools`, `memory_support_level`, nunca etiquetas
  patológicas.
- `task_items`, `adherence_plans` y endpoints viejos NO se rompen
  (backward compat).
- `SchoolPlanner` ya no es módulo de primera clase; es un adapter de
  ingesta académica que produce `unit_functions(category=study, source_type=school_notice)`.

## 4. Estructura de carpetas relevante

```
VantDomus_Improved/
├── apps/
│   ├── api/                     # FastAPI
│   │   ├── app/
│   │   │   ├── main.py          # FastAPI app + routers
│   │   │   ├── db.py            # SQLite/PG wrapper + migraciones
│   │   │   ├── vantguide_scheduler.py  # tick() + CLI
│   │   │   ├── assistant/
│   │   │   │   ├── tools.py     # 4 tools VG nuevos
│   │   │   │   ├── context.py
│   │   │   │   └── prompts.py
│   │   │   └── routes/
│   │   │       ├── unit_functions.py    # CRUD + version + confirm
│   │   │       ├── unit_function_responsibles.py
│   │   │       ├── vantguide_library.py # evidence + memory + profile
│   │   │       ├── demo.py      # /demo/seed?mode=home  — datos completos
│   │   │       ├── tasks.py     # incluye /school_plan adapter
│   │   │       └── ... (auth, health, finance, etc.)
│   │   ├── sqlite_migrations/
│   │   │   ├── 260_vantguide_core.sql
│   │   │   ├── 270_vantguide_runtime_v1.sql
│   │   │   └── 271_vantguide_micro_pre_ui.sql
│   │   ├── requirements.txt        # versiones pineadas (prod)
│   │   ├── requirements-local.txt  # versiones tolerantes (sin psycopg2)
│   │   └── .env                    # generado por Setup-LocalDev.ps1
│   ├── web/                     # Next.js 16 App Router
│   │   ├── app/
│   │   │   ├── guia/page.tsx                     # Landing VG+2
│   │   │   ├── guia/[unitFunctionId]/page.tsx    # Detalle con AI confirm
│   │   │   ├── biblioteca/page.tsx
│   │   │   ├── biblioteca/[personId]/page.tsx
│   │   │   ├── biblioteca/[personId]/evolucion/page.tsx  # Pantalla wow
│   │   │   ├── dashboard/[householdId]/page.tsx  # con wizard onboarding
│   │   │   ├── layout.tsx                        # navbar + preset switch
│   │   │   └── login/, settings/, tasks/, finance/, etc.
│   │   ├── lib/
│   │   │   ├── api.ts            # cliente con tipos UnitFunctionRow
│   │   │   ├── taxonomy.ts       # INDUSTRY_PRESETS_UI
│   │   │   └── csrf.ts
│   │   └── .env.local            # NEXT_PUBLIC_API_BASE
│   └── mobile/                  # Expo
│       ├── App.tsx              # Stack/Tab navigator
│       └── src/screens/
│           ├── GuiaScreen.tsx                # VG+2
│           ├── PersonLibraryScreen.tsx       # VG+2
│           ├── DashboardScreen.tsx
│           └── ChatScreen.tsx, etc.
├── docs/
│   ├── VANTGUIDE_ARCHITECTURE.md     # Faro de diseño v1.1
│   ├── HANDOFF_TO_CLAUDE_CODE.md     # este archivo
│   └── SECURITY_HARDENING_RUNBOOK.md
├── tests/
│   ├── test_vantguide_core.py        # 16 tests del VG-core
│   ├── test_vantguide_consolidation.py  # 12 tests del VG+1
│   ├── test_auth_body_and_policy.py
│   ├── test_vision_path_traversal.py
│   ├── test_assistant_dispatcher.py
│   └── security/test_tenant_isolation.py
├── tools/
│   ├── secret_scan.py
│   ├── production_readiness_report.py
│   ├── staging_smoke_check.py
│   ├── security_gate.py
│   └── windows/
│       ├── Setup-LocalDev.ps1     # Setup one-time
│       ├── Run-API.ps1            # uvicorn :8001
│       ├── Run-Web.ps1            # next dev :3000
│       └── Smoke-Local.ps1
├── data/README.md                # data/ está en .gitignore
└── legacy/README.md              # legacy/ está en .gitignore
```

## 5. Commits relevantes

| Commit | Sprint | Loc | Qué |
|---|---|---|---|
| `d309487` | Security baseline | — | Credenciales filtradas borradas, path traversal cerrado |
| `2a88144` | Sprint 1 familia | 1241 | UI mobile copy, demo seed básico, navbar |
| `1832615` | Sprint VG | 3532 | Núcleo VantGuide |
| `3d3c618` | Sprint VG+1 | 1582 | Versionado, scheduler lock, AI gating, multi-responsibles |
| `cf3df81` | VG+1 micro | 275 | escalation_delay, evidence hint, AI policy doc |
| `a096a49` | Sprint VG+2 | 2159 | UI Guía + Biblioteca + Evolución |
| (pendiente) | Pre-VG+4 | — | El fix del `supervision_level` del demo seed |

## 6. Estado del entorno local (al momento del handoff)

Manuel ya tiene corriendo:
- API en `http://127.0.0.1:8001` (uvicorn con --reload)
- Web en `http://localhost:3000` (next dev con turbopack)

Dependencias instaladas:
- Python venv en `apps/api/.venv` con `requirements-local.txt` aplicado
  (fastapi 0.137, pydantic 2.13, bcrypt 5.0, cryptography 49,
  PyMuPDF 1.27 — versiones más nuevas que las pineadas porque Python 3.14
  no tiene wheels para las versiones viejas; **psycopg2-binary EXCLUIDO**
  porque local usa SQLite)
- node_modules instalados en `apps/web/`

Cuenta de usuario creada:
- Email: `manuel@vantdomus.local`
- Password: `Demo-Pass-2026!`
- user_id: `333a0e36-8726-49b7-bb7b-96c648493a13`

Households creados:
- `de142bc5-cb3b-4706-9766-9841ed4b2e49` ("Familia Test") — **DATOS PARCIALES**
  porque se sembró antes del fix del `supervision_level`. Tiene
  `unit_functions_study=0` y `unit_functions_appointment=0`. Útil descartar.
- `1b79f92b-6235-4ce4-ab58-e50d08f3db22` ("Familia Demo 2") — **DATOS COMPLETOS**
  tras el fix. Tiene:
  - 4 personas (Pedro Pérez, Camila Soto, Diego Pérez, Elena Soto)
  - 5 unit_functions study (tareas escalonadas Diego)
  - 2 unit_functions medication (Losartán + Aspirina)
  - 1 unit_function appointment (cita cardio)
  - 1 unit_function ai_pending (Atorvastatina detectada por OCR — sin confirmar)
  - 2 unit_function_versions (historia del Losartán: 3→2 dosis, +41.7%)
  - 5 evidence_items (2 positivas + 3 negativas)
  - 9 memory_items
  - 4 person_support_profile

Secrets locales generados (en `apps/api/.env` — NO comitear):
- `JWT_SECRET`: hex 32 bytes fresco
- `VANTDOMUS_MFA_SECRET_KEY`: hex 32 bytes fresco
- `VANTDOMUS_BACKUP_ENCRYPTION_KEY`: hex 32 bytes fresco
- `APP_ENV=local`, `VANTDOMUS_ALLOW_DEMO_SEED=true`

## 7. Bug identificado y solución aplicada (junio 2026)

En `apps/api/app/routes/demo.py` el seed mezclaba dos enums distintos:
- `unit_functions.supervision_level` acepta `{autonomous, reminder_only, supervised, co_executed}`
- `person_support_profile.supervision_level` acepta `{autonomous, light_reminder, guided, accompanied}`

Las funciones study usaban `light_reminder` (del profile, no del function) y
la appointment usaba `accompanied`. Los `try/except` silenciosos se tragaban
el error y por eso el demo del primer hogar tenía `study=0` y `appointment=0`.

**FIX aplicado** en demo.py:
- Línea ~349: `supervision_level="light_reminder"` → `"reminder_only"`
- Línea ~420: `supervision_level="accompanied"` → `"supervised"`

**Está EN LOCAL pero NO commiteado todavía.** Tu primer trabajo: commitear
este fix antes de cualquier otra cosa, así queda en GitHub.

## 8. Roadmap pendiente

Codex (el co-arquitecto externo) recomendó el orden **A → C → B**:

### Sprint VG+4 — Deploy a Render bajo cuenta de Manuel (PRIORIDAD)

Manuel quiere mostrar el demo en una URL pública para pitches a inversores.
La infra que tiene confirmada:
- Cuenta Render free tier (workspace "My Workspace" que ya tiene 3 servicios
  mitopulse-*, los otros son los del kill switch del proyecto viejo Codex)
- Cuenta Vercel `majofreasenjo-jpgs-projects` (donde está deploy viejo
  `vantdomus-panel` que va a fallar el próximo build por estructura repo
  cambiada — ese fallo está OK, era kill switch deliberado)
- Neon Postgres `vantdomus-db` en AWS US East 1 con password rotado.
  Manuel tiene el connection string guardado.

Pasos sugeridos:
1. Render: crear nuevo Web Service desde `github.com/majofreasenjo-jpg/Vantdomus`
   - Root Directory: `apps/api`
   - Runtime: Python 3 (que use 3.11.9 — la última con wheels prebuilt
     completas para psycopg2)
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Plan: Free
   - Env vars: APP_ENV=local (para bypass del validate_runtime_security),
     JWT_SECRET=<fresh>, VANTDOMUS_MFA_SECRET_KEY=<fresh>,
     DATABASE_URL=<el connection string Neon rotado>,
     CORS_ALLOWED_ORIGINS=<la URL Vercel del web>,
     VANTDOMUS_ALLOW_DEMO_SEED=true,
     VANTDOMUS_AI_FEATURES_ENABLED=false
2. Vercel: nuevo proyecto desde mismo repo
   - Root Directory: `apps/web`
   - Framework: Next.js (autodetect)
   - Env: NEXT_PUBLIC_API_BASE=<URL Render>, APP_ENV=production
3. Cuando ambos estén live, hacer `POST /demo/seed?mode=home` para poblar
   la familia Pérez Soto en la DB Neon
4. Smoke test: abrir `/login`, registrar cuenta, navegar a `/guia` y
   `/biblioteca/<id>/evolucion`
5. Bonus: bind un dominio custom `vantguide.app` o similar si Manuel lo tiene

Issues conocidos a anticipar:
- `psycopg2-binary` puede fallar el build en Render Python 3.11. Solución
  ya validada: usar versión 2.9.10+ o migrar a `psycopg[binary]` 3.x.
- `PyMuPDF` también puede pedir librerías de sistema. Si pasa, alternativa
  más liviana: removerla de requirements y stub-ear las funciones de OCR
  que dependen de ella (afecta solo `/forensics/extract_text` y
  `/vision/process_batch` — el demo familia NO los usa).
- El `validate_runtime_security` del `config.py` exige ClamAV, Redis, SMTP
  y un montón más cuando APP_ENV=production/staging. Para evitar bloqueo
  del startup en Render free tier, usar `APP_ENV=local` (sí, en producción)
  hasta que se quiera levantar infra dura.

### Sprint VG+3 — Runtime real (después de A)

1. APScheduler como Render cron job o background worker que ejecute
   `python -m app.vantguide_scheduler` cada minuto
2. Endpoint nuevo `/coupling/email-inbound` que recibe POST de SendGrid
   Inbound Parse o Mailgun y clasifica eventos entrantes
3. Push notifications reales: el plumbing está en `apps/api/app/routes/notifications.py`
   (Expo + email SMTP + WhatsApp Twilio). Falta atar `function_events.event_type=reminder_due` al dispatcher
4. Smoke test E2E: setear plan medicación con horario T+3 minutos,
   esperar el tick, verificar que llega push

### Sprint VG+5+ (más adelante, no urgente)

- Vector embeddings funcionales para `memory_items.embedding`
- Email forwarding con OCR de circulares escolares vía LLM call
- VantHealthLink (resumen de cuidado compartible con médico vía link temporal)
- Voz/WhatsApp para acceso del adulto mayor
- UI mobile completa de la Guía
- Pack legal (Privacy, ToS, DPA) revisado por abogado

## 9. Co-arquitecto externo (Codex / ChatGPT)

Manuel consulta arquitectura con un agente externo que él llama "Codex"
(es ChatGPT). Las decisiones grandes (memoria, lenguaje no clínico,
versionado, etc.) pasaron por evaluación de Codex DOS veces (post VG y
post VG+1). Aprobó todo lo actual. **No re-discutas decisiones
arquitectónicas con él** salvo que aparezca un problema nuevo: rompe el
flujo y agrega entropía.

Si necesitás briefing actualizado para mandarle a Codex, hay uno completo
en la conversación de Cowork al cierre del Sprint VG+1.

## 10. Comandos rápidos de referencia

```powershell
# Arrancar local (en 2 terminales)
cd "D:\Aplicaciones de Juegos\VantDomus_Improved"
.\tools\windows\Run-API.ps1     # Terminal 1
.\tools\windows\Run-Web.ps1     # Terminal 2

# Smoke test
.\tools\windows\Smoke-Local.ps1

# Test suite
cd apps\api
.\.venv\Scripts\Activate.ps1
python -m pytest ../../tests/test_vantguide_core.py -v
python -m pytest ../../tests/test_vantguide_consolidation.py -v

# Git workflow
git status
git add -A
git commit -m "..."
git push origin master:main
```

URLs locales después de arrancar:
- API: `http://127.0.0.1:8001`
- API docs: `http://127.0.0.1:8001/docs`
- Web: `http://localhost:3000`
- Login: `http://localhost:3000/login`
- Guía Familiar (con seed cargado): `http://localhost:3000/guia`
- Biblioteca: `http://localhost:3000/biblioteca`
- Evolución de Elena (la pantalla wow): `http://localhost:3000/biblioteca/9358c602-e789-495d-bce6-d7204ca84818/evolucion`

## 11. Lo que NO entra en este handoff

- **Marketing/branding aspiracional**: el sitio `apps/marketing/` tiene
  claims que NO están respaldados por código (PCI, HL7, 99.99% SLA, etc.).
  Manuel está consciente. No lo uses como referencia técnica.
- **Mobile build/deploy**: hicimos `GuiaScreen` y `PersonLibraryScreen`
  pero `npx expo install expo-secure-store` no se corrió todavía. Si Manuel
  quiere mobile vivo, paso aparte.
- **Sprint VG+5 cosas aspiracionales** (marketplace, wearables, etc.):
  NO empezar sin pedirle a Manuel canal de distribución comercial primero.

## 12. Tu primer comando, Code

```powershell
cd "D:\Aplicaciones de Juegos\VantDomus_Improved"
git status     # Ver el fix del demo.py sin commitear
git diff apps/api/app/routes/demo.py   # Verificar que el fix está
```

Si ves el fix de supervision_level (`light_reminder` → `reminder_only` y
`accompanied` → `supervised`), commitealo:

```powershell
git add apps/api/app/routes/demo.py docs/HANDOFF_TO_CLAUDE_CODE.md
git commit -m "fix(demo): supervision_level enums correctos para UnitFunction

Reemplaza light_reminder→reminder_only y accompanied→supervised en
demo._seed_family. Los valores anteriores eran del enum de
person_support_profile, no de unit_functions. Los try/except silenciosos
estaban tragando el error y por eso /demo/seed?mode=home producía
unit_functions_study=0 y unit_functions_appointment=0.

Resulta tras el fix:
  unit_functions_study: 5
  unit_functions_medication: 2
  unit_functions_appointment: 1
  unit_functions_ai_pending_confirmation: 1
  unit_function_version_history: 2

Adicionalmente, agrega docs/HANDOFF_TO_CLAUDE_CODE.md con el contexto
completo del proyecto para esta y futuras sesiones."
git push origin master:main
```

Después de eso, el próximo Sprint es **VG+4 (deploy)**. Empieza
preguntándole a Manuel:

> "Manuel, recibí el handoff. Veo que VG+2 está commiteado y el local
> corre. ¿Querés que arrancuemos el deploy a Render ahora mismo, o
> preferís probar más cosas en local primero?"

Después de su respuesta, seguís el sprint VG+4 según sección §8.

---

## 13. Limitaciones honestas

- **Mi turno (Cowork) terminó acá** porque el deploy + runtime es trabajo
  intensivo en terminal y procesos, donde Code es más eficiente.
- **No reabras decisiones del documento** `VANTGUIDE_ARCHITECTURE.md`
  sin invitación explícita de Manuel.
- **No prometas timelines** — Manuel pivotea estratégicamente según
  feedback de mercado/Codex.
- **Mantené el lenguaje no clínico** del producto. Es legal, ético y
  product-friendly.
- **Mantené backward compat** con `task_items`, `adherence_plans`,
  endpoints viejos y el demo seed home.

Buena suerte, Code.

— Claude (Cowork mode)
