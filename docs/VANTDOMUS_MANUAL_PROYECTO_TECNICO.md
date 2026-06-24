# VantDomus — Manual Técnico y de Proyecto

> Manual técnico/de proyecto para quien desarrolla o opera VantDomus. No contiene
> secretos. Complementa `docs/VANTGUIDE_ARCHITECTURE.md` y `docs/PROJECT_RULES.md`.

## 1. Principio de trabajo
No agregar features a ciegas. No improvisar. No reabrir arquitectura aprobada.
Respetar alcance de cada sprint y los "NO HACER". Cerrar cada sprint con commit,
tests, docs y cápsula de rehidratación.

## 2. Fuentes de verdad
GitHub · Google Drive (carpeta + docs canónicos) · `docs/` · runbooks · commits ·
tests · logs no sensibles. El chat solo coordina (ver `docs/PROJECT_RULES.md`).

## 3. Reglas de seguridad
Nunca imprimir/commitear/documentar valores de secretos; si aparecen, se queman
y rotan. `DATABASE_URL`/`JWT_SECRET`/etc. se cargan directo en el proveedor.

## 4. Monorepo
`apps/api` (FastAPI) · `apps/web` (Next.js 16) · `apps/mobile` (Expo) ·
`apps/marketing` (landings) · `docs/` · `tests/` · `tools/windows/`.

## 5. apps/api
FastAPI. `app/main.py` arma la app + incluye routers. `app/db.py` conecta SQLite
(o Postgres si `DATABASE_URL`) y aplica migraciones (lista hardcodeada en
`ensure_schema`). Rutas en `app/routes/`.

## 6. apps/web
Next.js 16 App Router. Server Components consumen la API; `app/api/proxy/[...path]`
reenvía con el token de cookie. `lib/api.ts` cliente; `lib/taxonomy.ts` presets;
`proxy.ts` (auth/scoping de rutas + cookie `hid` de hogar activo).

## 7. apps/mobile
Expo/React Native (GuiaScreen, PersonLibraryScreen, DashboardScreen, ChatScreen).
No es foco del deploy demo.

## 8. apps/marketing
Landings con claims aspiracionales. NO usar como referencia técnica ni en demo.

## 9. Configuración de entorno
Local: `tools/windows/Setup-LocalDev.ps1` genera `apps/api/.env` y
`apps/web/.env.local` (gitignored). `Run-API.ps1` (:8001), `Run-Web.ps1` (:3000).

## 10. APP_ENV=demo
Valor seguro para la demo: `validate_runtime_security` solo exige infra dura en
`{production,prod,staging}`, así que `demo` relaja sin ser producción; en la web
el proxy queda fail-closed (sin token de fallback local). No llamarlo producción.

## 11. Variables sensibles
`DATABASE_URL`, `JWT_SECRET`, `VANTDOMUS_MFA_SECRET_KEY`,
`VANTDOMUS_BACKUP_ENCRYPTION_KEY`, OPENAI/Anthropic keys, tokens de proveedor,
SMTP/SendGrid. Solo en el panel del proveedor. Nunca en repo/chat/logs.

## 12. Auth
`app/routes/auth.py` (register/login/logout/MFA/reset). Passwords bcrypt
(`app/security.py`). JWT firmado con `JWT_SECRET`. Sesiones + CSRF.

## 13. Multi-tenant
`households` y `organizations`; `household_memberships(role)`. Aislamiento por
household/organization en cada query.

## 14. Households / organizations
CRUD en `app/routes/households.py` / `organizations.py`. Members con rol; agregar
member exige email verificado en prod (relajado fuera de prod).

## 15. Person profiles
`persons` (id, household_id, display_name, relation, **user_id** desde mig 272).
`person_support_profile`: lenguaje **no clínico**.

## 16. VantGuide
Motor transversal; ver `docs/VANTGUIDE_ARCHITECTURE.md`. Entidad central
`unit_function`. Reglas inviolables en `docs/PROJECT_RULES.md`.

## 17. UnitFunction
`app/routes/unit_functions.py`. `create_unit_function_internal(...)` (usado por
seed, adapters, smart_inbox). GET individual y `/versions` parsean JSON; el
listado también hidrata schedule/metadata. Campos `ai_*` expuestos en el GET.

## 18. FunctionEvent
`function_events` con `dedupe_key`. El evento `completed` se emite solo al
TRANSICIONAR a done (idempotente).

## 19. EvidenceItem
`evidence_items` (positiva/negativa). `log_evidence_internal(...)`. Visibilidad
por `visible_to_roles`.

## 20. MemoryItem
`memory_items`. `upsert_memory_internal(...)`. `consent_scope` para visibilidad.
Tipos incluyen `negative_learning`.

## 21. ProgressSnapshot
`progress_snapshots`: agregados por persona+categoría+período.

## 22. PersonSupportProfile
Perfil adaptativo (attention_profile, calm_tools, memory_support_level). Nunca
etiquetas clínicas.

## 23. RewardRule
`reward_rules` + `reward_events` (recompensas declarativas).

## 24. DocumentRouteCandidate
`document_route_candidates` (mig 273). Routing explícito de documentos: route_type,
suggested_category, confidence, requires_confirmation, status
(pending/accepted/rejected/superseded), proposed_payload, auditoría.

## 25. Smart Inbox
`app/routes/smart_inbox.py`. `analyze` (extrae PDF, clasifica por reglas, crea
candidate) · `candidates` (lista, scoping por persona) · `confirm` (crea destino) ·
`reject`. Imagen sin OCR → revisión manual. Sin IA si está apagada.

## 26. Scheduler
`app/vantguide_scheduler.py` (`tick()` + CLI; sentinel lock para SQLite). Runtime
real (cron/worker, push, email inbound) = Sprint D, pendiente. No meter Celery/Redis aún.

## 27. Assistant tools
`app/assistant/` (tools.py, context.py, prompts.py). Gobernado por
`VANTDOMUS_AI_FEATURES_ENABLED` (hoy false).

## 28. Logs y auditoría
`write_audit_log(...)` en acciones sensibles (confirm/reject, members, etc.).
Logs sin secretos.

## 29. Tests
`tests/` con `pytest`. Fixtures usan `with TestClient(app)` (dispara lifespan →
migraciones) + `VANTDOMUS_ALLOWED_HOSTS=testserver`. Suite VG+smart_inbox: 52/52.
`pytest`/`httpx` en `requirements-local.txt`.

## 30. Migrations
SQLite en `apps/api/sqlite_migrations/`, lista hardcodeada en `db.ensure_schema`.
Errores benignos ("already exists", "duplicate column") se ignoran. Últimas:
272 (persons.user_id), 273 (document_route_candidates).

## 31. Deploy
Ver `docs/DEPLOY_DEMO_RUNBOOK.md`. Backend Render (apps/api, Python 3.11.9,
build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).

## 32. Vercel
Frontend apps/web. Proyecto viejo `vantdomus-panel` reutilizable corrigiendo Root
Directory. `NEXT_PUBLIC_API_BASE` = backend nuevo. Nada secreto en `NEXT_PUBLIC_*`.

## 33. Render
Web Service en cuenta de Manuel. No usar el deploy antiguo de Codex. Variables no
secretas en el doc; secretos directo en el panel.

## 34. Neon
Postgres de Manuel (`DATABASE_URL`, sslmode=require). `psycopg2-binary` (subir a
2.9.10+ si falla el build en 3.11).

## 35. CORS
`CORS_ALLOWED_ORIGINS` con la URL de Vercel (+ localhost para pruebas). En prod
real no debe incluir localhost; en demo es tolerante.

## 36. Demo seed
`POST /demo/seed?mode=home` (gate `VANTDOMUS_ALLOW_DEMO_SEED`). Idempotente por
nombre. `POST /demo/seed_members` crea cuentas por integrante (visibilidad). Usar
hogar limpio (no `1b79f92b`, que tiene integrantes duplicados de re-seeds viejos).

## 37. Backward compatibility
No romper `task_items`, `adherence_plans`, endpoints viejos ni el demo seed home.
No borrar legacy sin migración.

## 38. Qué tocar y qué no tocar
Tocar: copy familiar, docs, fixes acotados, features dentro de alcance.
NO tocar sin OK: arquitectura VantGuide, secretos, deploy viejo, marketing
aspiracional, runtime scheduler (hasta Sprint D).

## 39. Cómo cerrar sprint
Commit claro · tests relevantes verdes · informe corto · docs actualizados ·
cápsula de rehidratación en Drive · pendientes/riesgos · DoD · next step.

## 40. Cómo actualizar Drive
En cada corte importante, actualizar `VANTDOMUS_REHIDRATACION_ULTIMO_CORTE`; si es
estructural, también canónico + manuales. Refrescar respaldo ZIP en
`VantDomus_Backups`. Sin secretos.

## 41. Cómo preparar handoff
Ver `docs/HANDOFF_TO_CLAUDE_CODE.md` (sección "Leer antes de ejecutar"). Incluir
estado, commits, próximo paso, reglas.

## 42. Cómo diagnosticar errores comunes
- Build Next falla → revisar imports inexistentes en `lib/api`.
- Tests "no such table" → fixture debe usar `with TestClient(app)`.
- "Invalid host header" en tests → setear `VANTDOMUS_ALLOWED_HOSTS=testserver`.
- API no toma cambios → reiniciar uvicorn (o usar `--reload`).
- Render build psycopg2 → subir versión / `psycopg[binary]`.
