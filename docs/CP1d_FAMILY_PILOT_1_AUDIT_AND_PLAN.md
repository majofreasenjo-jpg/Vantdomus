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

**Estimación honesta:** 1a-1b = 2-3 sesiones · 1c-1d = 2-3 sesiones · 1e = 2 sesiones · 1f = 1 sesión. La familia podría estar **cargando horarios reales al final de 1c/1d**.

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

## Restricciones vigentes (se acatan)
No registro público · no datos reales hasta aprobar infra · no IA real por defecto · no llamadas externas nuevas · no secretos en chat/repo · no rediseñar home CP1b · no medicamentos todavía · no deploy sobre infra antigua sin auditar · no mezclar datos de los tres hijos · **no implementar sin aprobación de Manuel y ChatGPT.**
