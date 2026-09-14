# CP1d-FAMILY-PILOT-1 — Auditoría del estado actual y plan de ejecución
## VantDomus Estudio Online para cinco integrantes

**Estado:** AUDITORÍA + PLAN (sin código). Requiere aprobación de Manuel y ChatGPT antes de implementar.
**Base auditada:** commit `353f8b6`.
**Prioridad redefinida:** 1) Estudio y organización académica online · 2) Recordatorios de medicamentos · 3) Resto del universo.

---

## 1. Estado real del deploy frontend/backend

**Existe infraestructura decidida y parcialmente montada, NO ejecutada para la versión actual:**
- **Backend:** existe un servicio Render de Manuel (**"Vantdomus"**, `vantdomus.onrender.com`) de una época anterior. El runbook de Sprint C ([DEPLOY_DEMO_RUNBOOK.md](DEPLOY_DEMO_RUNBOOK.md), auditado por ChatGPT 2026-06-24, tarea en pausa) ya decidió: **Render + Disk persistente `/data` (1GB) + SQLite** — sin `DATABASE_URL`. `apps/api/Dockerfile` existe.
- **Frontend:** decisión tomada de crear **proyecto Vercel nuevo limpio** (`vantdomus-hogar-demo`), no reusar el `vantdomus-panel` viejo. `apps/web/vercel.json` existe.
- **HTTPS:** lo dan Render y Vercel por defecto. **CORS:** contemplado en el runbook (`VANTDOMUS_ALLOWED_HOSTS`).
- **Conclusión:** el camino online está diseñado y aprobado desde Sprint C; falta ejecutarlo con la base de código actual (que avanzó mucho desde entonces) y re-auditar los pasos del runbook. **No se depositará nada sobre la infra antigua sin auditar** (regla respetada: el servicio Render viejo se reconfigura o se reemplaza, decisión en 1a).

## 2. Estado de persistencia y base de datos

- **Local:** SQLite (`apps/api/vantdomus.db`), 30+ migraciones ordenadas (`ensure_schema()` idempotente con errores benignos tolerados).
- **Postgres:** **soporte ya implementado** en `db.py` (wrapper psycopg2 + traducción de migraciones + `DATABASE_URL` con sslmode) — la migración futura a PostgreSQL que exige ChatGPT antes de ampliar a otras familias es viable sin reescritura.
- **Export:** existe **export JSON por hogar** (`GET /households/{hid}/export`) — base para respaldos de datos.
- **Para el piloto:** SQLite sobre Disk `/data` de Render (persistente entre deploys) — exactamente la modalidad que ChatGPT autorizó.

## 3. Estado de autenticación multiusuario

**Prácticamente completo:**
- Registro/login JSON con hash de contraseña, **verificación de email**, reset de contraseña, **MFA** (+ códigos de recuperación), **sesiones con revocación** (jti en DB, logout real), rate limiting, headers de seguridad, allowed hosts.
- **Invitaciones por hogar** (`POST /households/{hid}/invitations` → email+rol → token hash → aceptar/revocar con expiración): el mecanismo exacto para incorporar a los 4 integrantes restantes **sin registro público**.
- **⚠️ BRECHA #1:** `POST /auth/register` está **abierto al público**. Para el piloto se necesita flag server-side `VANTDOMUS_PUBLIC_REGISTRATION=false` (default cerrado en producción): registro solo vía invitación.
- OAuth Google/Facebook: scaffolding honesto, no requerido para el piloto.

## 4. Modelos existentes (inventario)

| Dominio | Modelo | Estado |
|---|---|---|
| Hogar | `households` (+`meta.module_visibility`), `household_memberships` (roles), `household_invitations` | ✅ |
| Personas | `persons` (+**`user_id`** nullable → resuelve visibilidad "self"; avatar; estado) | ✅ |
| Funciones | `unit_functions` — **categorías: study, medication, appointment, document_deadline…**, `due_at`, `schedule` JSON (times/days), `recurrence`, `person_id`, `responsible_person_id`, prioridad, supervisión, `ai_needs_confirmation` | ✅ |
| Timeline | `function_events` (reminder_due/missed/escalation…) + **`vantguide_scheduler.py`** (cron-like server-side que emite recordatorios y escalamientos, con timezone por hogar) | ✅ |
| Actividades | `daily_activities` (activity_type **school**, starts_at/ends_at, date_iso, por persona) | ✅ |
| Documentos | `document_route_candidates` — **la ruta `school_notice_to_study` YA clasifica circulares y extrae fechas** → propone → confirmación humana → crea unit_function study con trazabilidad al documento | ✅ |
| Evidencia/Memoria | `unit_function_evidence` (+/−), `person_memories` con **`consent_scope`** | ✅ |
| Propuestas IA | `assistant_proposals` (lifecycle completo MIN-3.2) + orquestador enjaulado | ✅ |
| Comunicación | `family_board_posts` (avisos+comentarios), `notifications` (in-app outbox + registro push + email/whatsapp de prueba) | ✅ |
| Otros | shopping, expenses, audit_log, security_events con hash-chain | ✅ |

## 5. Qué ya existe de lo académico

- **Pruebas / trabajos / tareas:** representables HOY como `unit_functions` categoría `study` con `due_at` + responsable + estado + prioridad. La Guía las lista y el scheduler recuerda.
- **Recordatorios:** scheduler server-side operativo (reminder_due → notificación → missed → escalación al responsable).
- **Circular escolar PDF → tarea de estudio:** flujo real completo vía Bandeja Inteligente (Fase 2 de ChatGPT ya está ~70% hecha).
- **Domi propone tareas de estudio:** real vía orquestador (`propose_study_task` → confirmar → unit_function).
- **Actividades escolares puntuales:** `daily_activities` tipo school.
- **Mobile:** la web es responsive (verificada 390×844 en MIN-3.1a); app Expo existe pero queda fuera del alcance del piloto (acceso = navegador del celular).

## 6. Qué FALTA (brechas por funcionalidad pedida)

| Funcionalidad | Falta |
|---|---|
| **Horarios de clase** | Modelo de **horario semanal recurrente** (asignatura × día × bloque horario × hijo). `daily_activities` es por-fecha, no plantilla semanal. → nueva tabla `class_schedule` |
| **Asignaturas y profesores** | No existe. → nueva tabla `subjects` (nombre, profesor, color, hijo) |
| **Pruebas / entregas / tareas** | Modelo existe (unit_functions study + due_at); falta **subtipo** (prueba/trabajo/tarea), **vínculo a asignatura** y estado **"atrasado" derivado** → columnas nuevas + query |
| **Calendario académico** | Faltan **vistas** día/semana/mes por hijo (backend: query agregada; frontend: página calendario) |
| **Disponibilidad semanal** | No existe. → tabla `study_availability` (hijo × día × minutos) |
| **Bloques de estudio** | No existen como entidad. → sesiones = unit_functions study hijas de un plan, con horario |
| **Planes de estudio** | No existe el agrupador. → tabla `study_plans` (prueba objetivo, temario, sesiones, avance) — **propuesto→editable→confirmado** reusando el lifecycle de propuestas MIN-3.2 |
| **Estrategias de estudio** | No existe. → catálogo estático server-side (recuperación activa, repetición espaciada, flashcards, Pomodoro, etc.) mapeado por tipo de materia, **sin claims de resultados**; la IA real las personaliza recién en Fase 4 |
| **Seguimiento por hijo** | Falta dashboard padres (pruebas próximas, atrasados, carga acumulada, conflictos) — backend: endpoint resumen académico por hogar; frontend: vista padres |

## 7. Matriz de permisos propuesta (sobre lo existente)

Base: roles `owner/admin/member/viewer` + `module_visibility` + visibilidad `self` (persons.user_id) + `consent_scope`. **Brecha #2:** no existe atributo de menor → agregar `persons.is_minor` (o fecha de nacimiento) + política.

| Dato | Padre/Madre (owner/admin) | Hijo (member+minor) |
|---|---|---|
| Horario/pruebas/tareas propias del hijo | ✅ ver/editar | ✅ ver/editar las suyas |
| Horario/pruebas/tareas de OTRO hijo | ✅ ver | ❌ (self-visibility ya lo resuelve) |
| Plan de estudio | ✅ proponer/confirmar/editar | ✅ ver/editar el suyo; confirmar según edad (config) |
| Avisos del hogar / compras / actividades comunes | ✅ | ✅ |
| Documentos escolares | ✅ todos | los propios |
| Evidencia/memoria privada | según `consent_scope` (ya implementado) | la propia |
| Administración (cuentas, permisos, flags, IA) | solo owner | ❌ |
| IA real | flag por-usuario (Fase B/C/D de ChatGPT) | ❌ al inicio |

## 8. Dos entornos

```
DEVELOPMENT (actual)               FAMILY-PILOT (nuevo, estable)
├─ rama: u1-cp1b-...→develop       ├─ rama/tag: family-pilot (congelada)
├─ local: localhost 8001/3000      ├─ API: Render + Disk /data + SQLite
├─ DB: vantdomus.db local          ├─ Web: Vercel nuevo privado (HTTPS)
├─ datos demo                      ├─ DB: SQLite en /data (persistente)
└─ aquí sigo trabajando yo         └─ datos REALES de la familia
```
**Promoción controlada (1×/semana):** tests+tsc verdes → revisión ChatGPT → respaldo → merge/tag a `family-pilot` → deploy → smoke online → familia actualizada. Nada llega al piloto sin ese ciclo. Los secretos de producción se generan y cargan **solo** en los paneles de Render/Vercel (regla ya canónica del runbook).

## 9. Backup, restore y rollback

- **Código:** protocolo `git archive` + SHA256 + Drive (probado 6 veces en este proyecto). Cada promoción = tag + respaldo.
- **Datos (nuevo, necesario ANTES de datos reales):**
  1. **Export JSON por hogar** (endpoint existente) — respaldo lógico diario descargable por el owner.
  2. **Copia del archivo SQLite** del Disk (`/data/vantdomus.db`) → script/endpoint admin de snapshot con fecha + descarga cifrable a Drive.
  3. **Restore probado:** procedimiento documentado (subir snapshot → reemplazar → reiniciar servicio) y **ensayado con datos de prueba antes del día 1**.
- **Rollback:** redeploy del tag anterior (Render/Vercel guardan historial de deploys) + restaurar snapshot de DB del mismo día. Criterio: probado al menos 1 vez antes de declarar "piloto activo".

## 10. Riesgos de privacidad (menores) y mitigaciones

1. **Registro público abierto** → flag cerrado + solo invitaciones (brecha #1, primer subcheckpoint).
2. **Datos de menores en servidores de terceros** (Render/Vercel, EE.UU.) → piloto cerrado familiar, datos de bajo riesgo primero, sin datos clínicos/bancarios/ubicación (lista de exclusión de ChatGPT), referencia a Ley 21.719 (Chile): minimización + derecho de supresión (export+delete por hogar ya existen).
3. **Visibilidad cruzada entre hijos** → self-visibility ya implementada; se verifica con tests por rol antes del día 1 (criterio de cierre).
4. **IA externa con datos de menores** → IA real APAGADA por defecto (flags server-side ya construidos); progresión A→B→C→D de ChatGPT; conversaciones de menores jamás a IA externa en el piloto.
5. **Consentimiento** → pantalla/registro de consentimiento explícito del owner + modo piloto visible en la UI ("Piloto familiar — datos reales").
6. **Secretos** → nunca en chat/repo/logs (canon vigente); producción: generados en paneles.
7. **Menores y contraseñas** → cuentas de hijos creadas por invitación del owner, contraseñas gestionadas en familia; sin email de verificación obligatorio para menores (flag existente `VANTDOMUS_REQUIRE_VERIFIED_EMAIL_FOR_SENSITIVE_ACTIONS` ya contempla entornos).

## 11. Roadmap en subcheckpoints pequeños

| Sub | Nombre | Contenido | Resultado usable |
|---|---|---|---|
| **1a** | **Base online cerrada** | Flag registro cerrado + auditar/ejecutar runbook Render+Vercel con código actual + rama `family-pilot` + snapshot/restore DB probado + smoke online | URL privada con login funcionando |
| **1b** | **Cuentas familiares** | Hogar real + 2 padres + 3 hijos vía invitaciones + `persons.is_minor` + persons↔users + tests de visibilidad por rol + consentimiento + banner "modo piloto" | Los 5 entran desde sus dispositivos |
| **1c** | **Modelo académico** | Migraciones `subjects`, `class_schedule`, `study_availability` + subtipo/asignatura en unit_functions study + CRUD + estado "atrasado" | Cargar horarios, pruebas, trabajos y tareas por hijo |
| **1d** | **Vistas académicas** | Página "Estudio" por hijo: Hoy/Semana/Calendario + dashboard padres (próximas pruebas, atrasados, carga) + alertas in-app de fechas próximas | La familia VE y organiza la semana académica |
| **1e** | **Planificador de estudio** | `study_plans` + generación de bloques por reglas (fecha, temario declarado, disponibilidad, pausas) + propuesta editable→confirmada (lifecycle MIN-3.2) + catálogo de estrategias por materia + reprogramación de sesiones incumplidas | "Organiza un plan para la prueba del viernes" funciona (sin IA externa) |
| **1f** | **Piloto activo** | Checklist completo de ChatGPT (permisos verificados, backup restaurable, rollback probado, mobile, cero secretos, Mock default) + declaración formal | **La familia usa VantDomus a diario** |

Después: Fase 2 pulir bandeja escolar (asignatura/fechas) · Fase 4 IA académica real (Fases B/C/D por usuario) · Fase 5 avisos push/email · **Medicamentos** (segunda línea, tras estabilizar Estudio).

**Criterio de avance (corrección ChatGPT — sin compromisos por "sesiones"):** el avance es **por evidencia, no por tiempo**: `PILOT-1a aprobado → PILOT-1b aprobado → PILOT-1c aprobado → carga de datos reales de bajo riesgo`. Cada subcheckpoint tiene matriz de aceptación verificable; ninguno inicia sin cierre formal del anterior.

## 12. Archivos exactos del primer subcheckpoint (PILOT-1a)

**Backend (flag de registro + snapshot DB):**
- `apps/api/app/config.py` — flag `VANTDOMUS_PUBLIC_REGISTRATION` (default: cerrado en prod/staging, abierto en local/demo)
- `apps/api/app/routes/auth.py` — gate en `/register` (403 con mensaje claro si cerrado; invitaciones siguen funcionando)
- `apps/api/app/routes/households.py` — endpoint owner-only de snapshot/descarga de DB (o script `tools/backup_db.py`)
- `tests/test_family_pilot_access.py` — nuevo: registro cerrado, invitación funciona, snapshot owner-only

**Deploy (sin código, ejecución del runbook re-auditado):**
- `docs/DEPLOY_FAMILY_PILOT_RUNBOOK.md` — actualización del runbook Sprint C al estado actual (flags del orquestador APAGADOS en prod incluidos)
- `apps/api/Dockerfile` — revisión (existe)
- `apps/web/vercel.json` + variable `NEXT_PUBLIC_API_BASE` — revisión (existe)
- Rama `family-pilot` — creación (operación git, no archivo)

**Fuera de alcance de 1a:** modelos académicos (1c), UI nueva (1d), IA (fases posteriores), medicamentos, home CP1b (no se toca).

---

# CORRECCIONES OBLIGATORIAS (revisión ChatGPT — v2)

Estas correcciones **sustituyen y endurecen** lo dicho arriba donde corresponda.

## A. Registro cerrado (UI + API, no solo ocultar)

- `VANTDOMUS_PUBLIC_REGISTRATION=false` **por defecto en prod/staging**; el **backend rechaza** `/auth/register` (403 con mensaje claro) aunque se llame directo al endpoint; la UI además no lo ofrece.
- Alta de integrantes **solo por invitación privada** del owner. El mecanismo existente se endurece a: token **de un solo uso** (ya es hash + `accepted_at`), **expirable** (ya existe `expires_at`), y ligado a **`household_id` + email + rol + persona esperada** (nuevo: columna `person_id` en `household_invitations` para vincular la invitación al perfil del hijo/padre correcto).
- **Rate limit** en `/register`, `/invitations` y aceptación (el rate limiter global existe; se agregan reglas específicas) + **auditoría** de creación/aceptación/revocación de invitaciones (audit_log).

## B. Menores y consentimiento (modelo consistente, no un booleano)

Migración propuesta (PILOT-1b, no 1a):
```
persons.date_of_birth          TEXT NULL      -- o age_band cuando no se quiera fecha exacta
persons.age_band               TEXT NULL      -- child|teen|adult (alternativa a DOB)
persons.is_minor               -- DERIVADO (vista/propiedad calculada, NUNCA columna suelta)
persons.guardian_person_id     TEXT NULL      -- adulto responsable
persons.guardian_consent_status TEXT          -- pending|granted|revoked
persons.guardian_consent_at    TEXT NULL
persons.guardian_consent_by    TEXT NULL      -- user_id del adulto que consintió
persons.privacy_profile        TEXT           -- standard|minor_restricted
```
- `is_minor` se **deriva** de `date_of_birth`/`age_band` (no puede quedar incoherente con la edad).
- **En pruebas se usan fixtures sintéticos** — no se cargan fechas reales de nacimiento hasta que la infra esté aprobada y el consentimiento registrado.

## C. Aislamiento entre hijos — matriz y tests OBLIGATORIOS

| # | Escenario | Resultado exigido |
|---|---|---|
| C1 | Hijo A lee datos privados (funciones/evidencia/memoria/plan) de hijo B | ❌ 403/filtrado |
| C2 | Hijo A modifica horario/tareas de hijo B | ❌ 403 |
| C3 | Hijo B consulta conversaciones/propuestas privadas de hijo C | ❌ filtrado (proposals ya filtran por person para no-admin) |
| C4 | Padre ve datos de cualquier hijo | ✅ según permiso (owner/admin) |
| C5 | Eventos compartidos vs personales | ✅ distinguibles (household vs person_id) |
| C6 | Cualquier query académica | ✅ filtrada por `household_id` **y** `person_id` |
| C7 | Usuario de hogar ajeno accede a cualquier recurso | ❌ 403 SIEMPRE |
| C8 | Enumeración de IDs (probar UUIDs ajenos secuencialmente) | ❌ 403/404 sin fuga de existencia; rate limited |

Cada fila = al menos un test automatizado en `tests/test_family_isolation.py`. **PILOT-1b no cierra sin C1–C8 verdes.**

## D. Scheduler — auditoría antes de confiar (no apto por existir)

El scheduler (`vantguide_scheduler.py`) existe pero **NO se declara apto para el piloto** hasta probar en `tests/test_scheduler_pilot.py` + ensayo en el entorno online:
1. Zona horaria `America/Santiago` (el código lee tz por hogar — verificar). 2. Cambio de horario de verano (fechas frontera). 3. Reinicio del servicio (Render reinicia; el scheduler debe correr como cron/loop que sobrevive). 4. **Catch-up**: recordatorios que vencieron durante downtime se emiten al reiniciar (una vez, marcados atrasados). 5. Idempotencia (dedupe_key ya existe — verificar bajo doble ejecución). 6. Cero duplicados. 7. Tareas vencidas → estado atrasado + evento. 8. Reprogramación de una función → recordatorios viejos no disparan. 9. Escalamiento al padre SOLO según regla (missed reiterado). 10. Comportamiento documentado si el backend estuvo detenido horas.
Además: decidir el **mecanismo de ejecución online** (Render cron job vs loop en proceso con lock) — hoy está pensado como cron local.

## E. Backup SQLite consistente (prohibido copiar en caliente)

- Método elegido: **`VACUUM INTO '/data/backups/vantdomus-YYYYMMDD-HHMM.db'`** (snapshot transaccional consistente sin detener escrituras) — con fallback documentado a SQLite Backup API. **Nunca** `cp` del archivo vivo.
- El gate PILOT-1a exige el ciclo completo: **crear backup → restaurarlo en entorno aislado → verificar conteos por tabla (origen == restaurado) → documentar RPO/RTO → rollback probado.**
- Objetivos iniciales: **RPO ≤ 24 h** (snapshot diario + export JSON por hogar) · **RTO ≤ 1 h** (procedimiento documentado y ensayado).

## F. Seguridad online mínima (checklist pre-deploy)

| Control | Estado actual | Acción |
|---|---|---|
| HTTPS | Render/Vercel lo dan | Verificar redirect http→https |
| Cookies `Secure/HttpOnly/SameSite` | Cookie de sesión del web (`vantdomus_access_token`) — auditar atributos en prod | Fijar Secure+HttpOnly+SameSite=Lax |
| CSRF | Ya implementado en el proxy (cookie+header `X-VantDomus-CSRF`) | Test en prod |
| CORS | `VANTDOMUS_ALLOWED_HOSTS` existe | Limitar a la URL EXACTA del frontend |
| Rate limiting | Global existe | Reglas específicas login/invitaciones/reset |
| Sesiones revocables | ✅ (jti + revoked_at) | Test logout en prod |
| Expiración de sesión | ✅ (exp en JWT) | Revisar duración para piloto |
| Rotación de secretos antiguos | Pendiente del incidente histórico | **Rotar TODOS los secretos al crear el entorno pilot (nuevos, generados en paneles)** |
| Logs sin datos escolares sensibles | Sanitización existente en asistente | Auditar logs de uvicorn/Render |
| `noindex` | No existe | Header `X-Robots-Tag: noindex` + meta + robots.txt |
| Headers de seguridad | Middleware existente | Verificar en prod |
| Separación pilot/dev | Diseñada (§8) | Ejecutar |

## G. Criterio de avance

Sin fechas ni "sesiones": **gates verificables** (ver §11 corregido). Cada subcheckpoint entrega evidencia, ChatGPT audita, se respalda, y recién entonces inicia el siguiente.

---

# MATRIZ DE ACEPTACIÓN — PILOT-1a (Base online cerrada)

| # | Criterio | Verificación |
|---|---|---|
| 1 | `VANTDOMUS_PUBLIC_REGISTRATION=false` default en prod; `/register` devuelve 403 vía API directa | test + curl en prod |
| 2 | Registro abierto solo en local/demo (dev no se rompe) | test |
| 3 | Invitación privada: token un solo uso, expirable, ligado a household+email+rol(+person) | tests |
| 4 | Rate limit + auditoría en invitaciones | test + audit_log |
| 5 | Backup `VACUUM INTO` creado, restaurado en aislado, conteos verificados | evidencia del ciclo completo |
| 6 | RPO/RTO documentados; rollback de código probado (tag anterior) | doc + ensayo |
| 7 | Deploy Render (API+Disk) + Vercel (web) desde rama `family-pilot` | URL privada respondiendo |
| 8 | Login/logout online multi-dispositivo | smoke manual Manuel |
| 9 | CORS exacto, cookies seguras, CSRF, noindex, headers verificados en prod | checklist F con evidencia |
| 10 | Secretos NUEVOS generados solo en paneles Render/Vercel; los históricos rotados | confirmación sin valores |
| 11 | Flags de IA apagados en prod (`mock/false/false/false`) | endpoint/env check |
| 12 | Smoke online: health, login, hogar demo sintético, chat Domi (mock) | evidencia |
| 13 | Working tree limpio + commits pusheados + respaldo del checkpoint | protocolo estándar |

**Datos en 1a: SOLO sintéticos.** La familia no entra aún (eso es 1b tras su propia matriz).

# ARCHIVOS EXACTOS A MODIFICAR (PILOT-1a)

**Backend:**
1. `apps/api/app/config.py` — flag `VANTDOMUS_PUBLIC_REGISTRATION` (+ default por entorno)
2. `apps/api/app/routes/auth.py` — gate 403 en `/register` cuando cerrado
3. `apps/api/app/routes/households.py` — invitaciones: columna `person_id` opcional + auditoría; endpoint owner-only `POST /households/{hid}/admin/backup` (VACUUM INTO) + listado/descarga
4. `apps/api/sqlite_migrations/280_invitation_person_link.sql` — vínculo invitación→persona
5. `apps/api/app/rate_limit.py` — reglas específicas login/invitaciones/reset
6. `apps/api/app/main.py` — header `X-Robots-Tag: noindex` (+ robots.txt en web)

**Web:** 7. `apps/web/app/login/page.tsx` — sin enlace a registro cuando cerrado (flag público NO sensible) · 8. `apps/web/public/robots.txt` — Disallow all

**Docs/ops:** 9. `docs/DEPLOY_FAMILY_PILOT_RUNBOOK.md` — runbook actualizado (incluye rotación de secretos históricos y flags IA off) · 10. rama `family-pilot` (operación git)

# TESTS EXACTOS (PILOT-1a)

`tests/test_family_pilot_access.py` (nuevo):
1. `test_register_blocked_when_flag_off` (403 API directa) · 2. `test_register_open_in_local_demo` · 3. `test_invitation_single_use` (segunda aceptación falla) · 4. `test_invitation_expires` · 5. `test_invitation_bound_to_household_email_role` · 6. `test_invitation_person_link` · 7. `test_invitation_rate_limited` · 8. `test_invitation_audited` · 9. `test_backup_vacuum_into_creates_consistent_snapshot` (conteos por tabla origen==snapshot) · 10. `test_backup_restore_cycle` (restaurar en tmp y verificar) · 11. `test_backup_owner_only` (403 para member) · 12. `test_noindex_header`
Más: regresión completa existente (55 tests) + tsc.

# PLAN DE ROLLBACK (PILOT-1a)

- **Código:** cada promoción a `family-pilot` = tag (`pilot-vN`); rollback = redeploy del tag anterior en Render/Vercel (ambos guardan historial de deploys — un clic) · ensayado 1 vez como parte del gate.
- **Datos:** restaurar el snapshot `VACUUM INTO` más reciente (procedimiento: detener servicio → reemplazar archivo en `/data` → iniciar → smoke) · ensayado con datos sintéticos.
- **Config:** flags y secretos viven en los paneles (no en el repo) → revertir un flag no requiere deploy.
- **Local (desarrollo):** intacto — el rollback del piloto jamás toca `development`.

# CONFIRMACIONES

✅ **Cero IA externa** (flags apagados; adapter solo alcanzable por shadow harness) · ✅ **Cero datos familiares reales** (solo sintéticos hasta aprobar infra + consentimiento) · ✅ **Cero deploy todavía** (esta entrega es documental) · ✅ **Cero secretos** en chat/repo/doc · ✅ **MockProvider por defecto** (verificado por código y tests).

**Frase de control adoptada:** *Primero cerraremos la puerta, separaremos correctamente a cada integrante y probaremos que los datos pueden recuperarse; solo después la familia entrará al piloto.*

---

## Restricciones vigentes (se acatan)
No registro público · no datos reales hasta aprobar infra · no IA real por defecto · no llamadas externas nuevas · no secretos en chat/repo · no rediseñar home CP1b · no medicamentos todavía · no deploy sobre infra antigua sin auditar · no mezclar datos de los tres hijos · **no implementar sin aprobación de Manuel y ChatGPT.**
