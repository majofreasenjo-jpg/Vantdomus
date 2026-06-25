# VantDomus — Documento Canónico del Proyecto (v2)

> Documento canónico completo dentro del repo, equivalente al documento maestro
> de Drive (`VANTDOMUS_CANONICO_PROYECTO_v2`). Fuente de verdad para consultas
> futuras. No contiene secretos.
>
> **v2 (2026-06-25):** consolidación con el "UNIVERSO VANTDOMUS" del owner.
> Cambios: definición integral en §1; Sprint U1-LOCAL + U1-FIX registrados;
> nuevos capítulos 36-46 (Canon v2 — Capas, Operación IA, Onboarding, Roles
> ampliados, Privacidad/menores/ubicación, Modelo comercial, Roadmap por
> dominios, Qué existe / qué no, Riesgos críticos, Checklist beta).

## 1. Resumen ejecutivo (definición consolidada v2)

VantDomus es una **plataforma SaaS de coordinación, cuidado y memoria familiar
asistida por IA**. Su producto principal, **VantDomus Hogar**, organiza a los
integrantes del hogar mediante una **Guía Familiar** que convierte documentos,
rutinas, medicamentos, estudio, compras, avisos, ubicación voluntaria, finanzas,
tareas y compromisos en **funciones trazables**.

Cada función puede tener responsables, eventos, evidencia, memoria, alertas,
**confirmación humana** y evolución. La IA actúa como **asistente-orquestador**:
interpreta entradas, resume, propone acciones y usa herramientas auditables, pero
la memoria, los permisos, los documentos y las decisiones sensibles viven en
VantDomus, **no en el modelo**.

La misma arquitectura escala a B2B como **Guía Operativa**, **Guía de Cuidado**
o **Guía de Equipo** para residencias, clínicas, colegios, faenas, oficinas
técnicas y otros contextos, cambiando el `industry_preset`. El motor interno se
llama **VantGuide** y su entidad central es `unit_function`.

**VantDomus no es** solo una agenda, ni solo recordatorios, ni solo una app de
medicamentos, ni un chat familiar. Lo que la diferencia es la combinación de
**función + evidencia + memoria + confirmación humana + alertas + evolución** sobre
un mismo modelo multi-tenant.

## 2. Identidad del proyecto

- Dueño: **Manuel** (majofreasenjo@gmail.com).
- Repo: `https://github.com/majofreasenjo-jpg/Vantdomus` (privado), branch `main`.
- Marca visible familia: "VantDomus Hogar — Tu hogar, organizado con ayuda de IA".
- Motor interno: VantGuide (no se muestra como copy al usuario final).
- Co-arquitecto externo: revisa decisiones grandes y emite bloques ejecutorios.

## 3. Historia del proyecto

Partió como base post-limpieza de seguridad (`d309487`, tag
`baseline-secure-2026-05`). Evolucionó: modo familia (`2a88144`) → núcleo
VantGuide (`1832615`) → consolidación VG+1 (`3d3c618`) → UI VG+2
(Guía/Biblioteca/Evolución) → limpieza familiar VG+2.1 (`f0c12b1`) → Bandeja
Inteligente v1 VG+2.2 (`c5ff09e`).

## 4. Estado actual

- VG+2.1 y VG+2.2 aprobados. Smoke de visibilidad aprobado. Tests 52/52.
- Pendiente activo: **Sprint C — Deploy demo** (Render/Vercel/Neon de Manuel),
  en modo guía asistida (no hay CLIs autenticadas en el entorno).
- AI features apagadas; OCR de imágenes y scheduler runtime pendientes (Sprint D).

## 5. Producto actual: VantDomus Hogar

Tablero familiar con: Dashboard (KPIs de Estabilidad/Bienestar/Rutinas/Finanzas),
Guía Familiar, Biblioteca, Bandeja Inteligente, Salud, Finanzas del hogar,
Documentos familiares, Agenda, Buzón, Ajustes. Tema cálido (Arena & Salvia),
niveles de vista Simple/Completo, copy familiar sin jerga B2B.

## 6. Producto B2B: VantUnit / presets operacionales

El mismo motor sirve presets B2B (minería, oficina técnica, EPC, oil, salud,
construcción, corporate, PUMA). Cada preset cambia copy, taxonomía y tema vía
`INDUSTRY_PRESETS_UI` (apps/web/lib/taxonomy.ts). En B2B el copy es operativo
(Dirección Ejecutiva, ESG, etc.); ese vocabulario NO aparece en modo familia.

## 7. Arquitectura general

Monorepo. Backend FastAPI (SQLite local / Postgres prod) con motor VantGuide.
Frontend Next.js 16 (App Router, Server Components + un proxy `/api/proxy` que
inyecta el token). Mobile Expo. Multi-tenant por household/organization con RBAC
por rol. Detalle en `docs/VANTGUIDE_ARCHITECTURE.md` y el manual técnico.

## 8. Componentes del monorepo

- `apps/api/` — FastAPI (rutas, migraciones SQLite, scheduler, assistant tools).
- `apps/web/` — Next.js 16 (Guía, Biblioteca, Evolución, Dashboard, Documentos,
  Salud, Finanzas, Bandeja Inteligente, login, ajustes).
- `apps/mobile/` — Expo/React Native (GuiaScreen, PersonLibraryScreen, etc.).
- `apps/marketing/` — landings Luxen (claims aspiracionales, NO usar como técnica).
- `docs/`, `tests/`, `tools/windows/` (Setup/Run/Smoke local).

## 9. Seguridad y baseline

Baseline `d309487` (credenciales filtradas borradas, path traversal cerrado).
`validate_runtime_security` exige infra dura (ClamAV/Redis/SMTP/webhooks/https)
solo si `APP_ENV ∈ {production, prod, staging}`. Secretos por env, nunca en repo.
Ver `docs/SECURITY_BASELINE.md`, `docs/SECURITY_HARDENING_RUNBOOK.md`.

## 10. Sprints y commits relevantes

`d309487` baseline · `2a88144` familia · `1832615` VG · `3d3c618` VG+1 ·
`cf3df81` VG+1 micro · `a096a49` VG+2 UI · `f0c12b1` VG+2.1 · `c5ff09e` VG+2.2 ·
`22766a2` informe · `9bf1ef2` runbook (seguridad de secretos).

## 11. VantGuide / UnitFunction Engine

Motor transversal. Cualquier cosa que una persona/rol debe cumplir (estudio,
medicación, rutina, cita, protocolo B2B) es un `unit_function`. Soporta
versionado, gating de IA (confirmación humana), múltiples responsables y dual-write
opcional a `task_items` (backward compat).

## 12. Modelo de datos conceptual

- `unit_functions` — entidad central.
- `function_events` — timeline (scheduled/reminded/completed/missed/escalated); dedupe_key.
- `evidence_items` — prueba concreta, positiva o **negativa** explícita.
- `memory_items` — memoria estructurada de largo plazo (vive en VantDomus, no en el LLM).
- `progress_snapshots` — agregados por persona+categoría+período.
- `person_support_profile` — perfil adaptativo, lenguaje **no clínico**.
- `reward_rules` + `reward_events`.
- `unit_function_versions` — snapshot de cada cambio.
- `unit_function_responsibles` — roles múltiples (primary_caregiver, parent, doctor_viewer, etc.).
- `scheduler_runs` — métricas + sentinel lock fallback (SQLite).
- `persons.user_id` (migración 272) — vincula integrante ↔ cuenta (visibilidad por persona).
- `document_route_candidates` (migración 273) — Bandeja Inteligente (routing de documentos).

## 13. Guía Familiar

`/guia`: lista funciones agrupadas por persona y categoría; KPIs (activas,
"Pendientes de revisión", vencidas, completadas); badge de confirmación IA. Copy
familiar; "VantGuide" no se muestra. Detalle de función en `/guia/[id]` con el
bloque de confirmar/descartar IA (usa campos `ai_*` del GET).

## 14. Biblioteca / evidencia / memoria

`/biblioteca`: por integrante, evidencia positiva y "lo que no funcionó"
(negativa), memoria, y "Ver evolución" (antes/después de una función versionada,
con % de mejora). Materializa la trazabilidad del cuidado.

## 15. Bandeja Inteligente v1

`/documents` (Documentos familiares) incluye el panel "Bandeja inteligente".
Pipeline: `upload/pegar → extract_text (PDF; imagen → revisión manual) →
classify (reglas) → DocumentRouteCandidate → preview editable → confirmación
humana → crear destino`. Endpoints `/smart_inbox/analyze|candidates|confirm|reject`.
Rutas: receta→medication (pendiente confirmar), boleta→gasto, circular→estudio,
cuenta/póliza→vencimiento, médico/general→evidencia. Todo auditado. Sin OCR de
fotos robusto ni IA plena (preparado para enchufarlos luego).

## 16. Salud / medicamentos / adulto mayor

`/health/[personId]`: plan de cuidado (asignar control), check-in, historial
(events domain=health). Empty states útiles con CTAs. Adherencia/alertas
(`/health/adherence`, `/health/checkin`, `medication_state`, `alerts`).

## 17. Estudio / funciones académicas

El estudio es una **categoría** de la Guía (`category=study`), no un producto
aparte. La ingesta de circulares/agenda escolar (componente "Guía de estudio y
compromisos") crea `unit_functions(category=study)`.

## 18. Finanzas del hogar

`/finance/[householdId]`: registrar ingresos y gastos (tabla `expenses`),
integrante responsable, moneda (CLP por defecto en familia), categorías
familiares. La Bandeja puede crear gastos desde boletas.

## 19. Documentos familiares

Ruta `/documents/[householdId]` (alias del componente de `/esg`, familizado).
"Documentos familiares" = repositorio + Bandeja Inteligente. ESG queda reservado
a presets B2B; no aparece en familia.

## 20. Roles / permisos / scoping

RBAC por household: `owner > admin > member > viewer` (`app/rbac.py`).
`persons.user_id` permite resolver la persona del usuario logueado. Owner ve
todo; integrante (member) ve lo propio + lo compartido (household); no accede a
hogares ajenos (403). Visibilidad fina por `visible_to_roles` (evidencia) y
`consent_scope` (memoria).

## 21. IA / memoria / assistant tools

Memoria estructurada en `memory_items` (no en el LLM). Assistant tools en
`apps/api/app/assistant/`. IA gobernada por `VANTDOMUS_AI_FEATURES_ENABLED`
(hoy false). La clasificación de la Bandeja v1 es por reglas, no IA.

## 22. Confirmación humana / AI confidence

Las funciones creadas por IA llevan `ai_needs_confirmation`, `ai_confidence`,
`ai_explanation`, `ai_extraction_source`. La IA propone; el humano confirma.
Medicación/salud siempre requieren confirmación antes de activar recordatorios.

## 23. Scheduler / runtime pendiente

`vantguide_scheduler.tick()` + CLI existen; el runtime real (cron/worker, push
Expo, email inbound) es **Sprint D**, aún no desplegado. No meter Celery/Redis todavía.

## 23-bis. Sprint U1-LOCAL — VantDomus Hogar Universe Preview (cerrado, commit `724af80`)

Decisión de Manuel (jun 2026): antes de exponer demo pública, validar
experiencia local con un universo cohesivo. Implementado:

- **Panel del Hogar** (`/hogar/[householdId]`) como home principal en family.
  Compone Domi narrador (server-side por reglas), Avisos, Actividades del día,
  Compras + Carro Tentativo, accesos rápidos a Salud/Documentos/Presupuesto/
  Biblioteca. `layout.tsx` redirige "Inicio" a `/hogar/{hid}` en family.
- **3 módulos nuevos** con tabla, endpoints CRUD y scoping por household:
  - `family_board_posts` (migración 274) — muro familiar.
  - `household_shopping_items` (275) — lista + carro tentativo (sin checkout).
  - `daily_activities` (276) — actividades del día con visibilidad.
- **Pantallas dedicadas** `/avisos/[hid]` y `/compras/[hid]` con creación inline
  y acciones vía server actions.
- **Seed v2** (`mode=home_v2`) con familia curada "Familia Demo VantDomus"
  (Camila, Pedro, Diego, Sofía, Elena). Sin duplicados. Idempotente. Convive
  con seed v1 (`mode=home`).
- **Tests:** 11 nuevos (`tests/test_u1_local.py`) + 52 previos = **63/63 verdes**.

Detalle de uso en `docs/DEMO_LOCAL_VANTDOMUS_HOGAR.md`.

## 24. Deploy pendiente (decisiones del auditor, 2026-06-24)

Sprint C unificado tras respuestas del auditor externo (ChatGPT):

- Backend en **Render** (`apps/api`, Python 3.11.9, `APP_ENV=demo`, AI off).
- **DB de demo = SQLite + Disk persistente** (`DB_PATH=/data/vantdomus.db`,
  Disk 1 GB en `/data`). **NO Postgres/Neon** en este sprint.
- **NO `/tmp`** para clientes. **NO arreglar la rama Postgres** ahora (deuda
  diferida).
- Frontend en **Vercel nuevo limpio** (`vantdomus-hogar-demo`, root `apps/web`).
  **NO reusar** `vantdomus-panel` viejo como demo principal.
- Domi CSS alcanza para el pitch.
- Gate de entrega de URL pública = **smoke 21 puntos en deployado**.
- No Sprint D (scheduler/push/email inbound) hasta cerrar C.

Detalle operativo en `docs/DEPLOY_DEMO_RUNBOOK.md`.

## 25. Vercel viejo y Render viejo

Existe un proyecto Vercel viejo `vantdomus-panel` apuntando a una versión
antigua (reutilizable corrigiendo Root Directory a `apps/web`). El deploy Render
antiguo de Codex NO se usa. No usar secretos quemados.

## 26. Neon y DB

Local: SQLite (`vantdomus.db`, gitignored). Prod/demo: Postgres Neon controlado
por Manuel (`DATABASE_URL`, nunca por chat). `psycopg2-binary` en
`requirements.txt`; si falla en Render, subir a 2.9.10+ o `psycopg[binary]` 3.x.

## 27. Riesgos de seguridad

Exposición de secretos (regla estricta: quemar y rotar) · CORS mal configurado ·
`APP_ENV` incorrecto · datos sensibles en demo · fuga de visibilidad entre
hogares (validada con 403). Mitigaciones en `docs/PROJECT_RULES.md`.

## 28. Claims aspiracionales que NO deben usarse

PCI/HL7/SLA 99.99%, IA plena, OCR de fotos robusto, integraciones con
aseguradoras, wearables, WhatsApp real, VantHealthLink médico, marketplace de
voces, acompañantes humanos, voz. No prometer nada de esto hasta que exista.

## 29. Diferenciadores actuales

UnitFunction transversal · Biblioteca de evidencia positiva/negativa · memoria
estructurada · perfil adaptativo por persona · confirmación IA · Bandeja
Inteligente · salud+estudio+hogar+documentos+finanzas en una sola guía ·
escalable a B2B por preset · roles/visibilidad · enfoque LATAM/español.

## 30. Brechas actuales

UI puede verse menos pulida que productos top · falta onboarding guiado real ·
falta asistente/personaje vivo · calendario robusto · push/scheduler runtime ·
OCR de fotos · voz · integraciones externas · microinteracciones · mobile polish.

## 31. Roadmap inmediato

A. Deploy demo (Sprint C). B. Auditoría competitiva/UX. C. PITCH_DEMO_SCRIPT.
D. AssistantOrb (personaje original). E. Polish pre-pitch.

## 32. Roadmap futuro

Sprint D runtime real (scheduler cron, push Expo, email inbound, métricas).
Luego: OCR de imágenes + clasificación IA en la Bandeja, vector embeddings de
memoria, mobile completo, pack legal revisado.

## 33. Reglas de continuidad

Ver `docs/PROJECT_RULES.md`. Cada corte importante actualiza
`VANTDOMUS_REHIDRATACION_ULTIMO_CORTE` en Drive. El chat solo coordina.

## 34. Manual de rehidratación

Ver `docs/REHYDRATION_INDEX.md` (orden de lectura, estado, próximo paso, qué
hacer si el chat se corta).

## 35. Fuentes de verdad

GitHub · Google Drive (carpeta + docs canónicos) · `docs/` del repo · runbooks ·
commits · tests · respaldos. El chat NO es fuente de verdad.

---

# Canon v2 — capítulos integrales (consolidación 2026-06-25)

> Esta sección consolida lo que el documento "UNIVERSO VANTDOMUS" del owner
> identificó como faltante en `v1`. No reemplaza los capítulos 1-35; los
> extiende. **Sin claims aspiracionales** (SLA 99.99%, PCI/HIPAA/HL7, 140 APIs,
> core bancario, OCR de fotos en producción, IA plena, scheduler runtime, etc.):
> esos siguen como roadmap, no como producto.

## 36. Mapa de capas

VantDomus se entiende mejor por capas. Cada una es transversal y se compone
con las siguientes; cambiar una no debe romper las otras.

1. **Identidad** — VantDomus Hogar / Guía Familiar (marca visible y narrativa).
2. **Personas y permisos** — hogar, integrantes, roles, cuidadores, consentimientos.
3. **Funciones** — `unit_function`, responsables, estados, vencimientos.
4. **Evidencia** — check-ins, documentos, eventos, omisiones; `evidence_items`.
5. **Memoria** — `memory_items`, aprendizajes, preferencias, patrones (no vive en el modelo).
6. **Documentos** — Bandeja Inteligente, clasificación, archivo, acciones.
7. **Coordinación diaria** — Panel del Hogar: avisos/mural, actividades, ubicación voluntaria, compras + carro tentativo.
8. **IA** — asistente-orquestador, herramientas, confirmación humana.
9. **Alertas y runtime** — scheduler, push, email, WhatsApp (pendientes en este orden).
10. **Masificación** — multi-tenant, Postgres gestionado, storage, billing, admin, observabilidad.
11. **Extensión B2B** — presets de cuidado, operación, colegios, clínicas, empresas.

## 37. VantHome Coordination / Panel del Hogar

Implementado en Sprint U1-LOCAL (commit `724af80`) y reforzado en Sprint
U1-FIX (commit posterior). Es la **capa diaria** que convierte VantDomus de
"demo interesante" en "producto usable a diario".

Componentes:

- **Mural del Hogar** (`/avisos/[hid]`) — muro familiar (canon UNIVERSO §15):
  publicar avisos, alertas, recordatorios, mensajes logísticos/colegio/finanzas/
  salud. Cada aviso puede convertirse en **compra** o **actividad** (botones
  "→ Compra" / "→ Actividad").
- **Actividades del Día** (`/actividades/[hid]`) — agenda por integrante con
  visibilidad family/caregivers/private. Vista "Hoy en la familia".
- **Compras + Carro Tentativo** (`/compras/[hid]`) — lista colaborativa con
  estado needed/in_cart/purchased/cancelled; carro agrupado por tipo de tienda
  con total estimado. **Sin checkout, sin precios reales, sin scraping.**
- **Ubicación voluntaria / check-in** — DIFERIDO a fase 3 de VG+2.3. Diseño
  obligatorio: opt-in, frases tipo "Estoy en casa / Llegué / Necesito ayuda",
  sin tracking continuo, sin geofencing v1.

Panel del Hogar (`/hogar/[hid]`) compone los tres en una sola pantalla, con
**Domi narrador server-side** (frases por reglas a partir de datos reales, sin
LLM). Reemplaza al `/dashboard/[hid]` como home en modo familia.

## 38. Operación de la IA (asistente-orquestador)

Qué **puede** hacer la IA:

- Interpretar entradas (chat, documento subido, texto pegado).
- Proponer una clasificación, una función, una memoria o un movimiento.
- Resumir estado del hogar a partir de datos ya cargados.
- Llamar herramientas auditables del backend con permisos del usuario.

Qué **no** puede hacer:

- Activar medicamentos, instrucciones médicas, safety checks o protocolos
  operativos sin **confirmación humana**.
- Acceder a datos de otra familia, persona o categoría sin que el usuario
  tenga permiso.
- Guardar memoria propia: la memoria vive en `memory_items` de VantDomus, no
  en el modelo.
- Modificar permisos, finanzas sensibles, o documentos privados sin que un
  humano confirme.

Cuándo **debe** pedir confirmación: medicamentos, salud, menores, ubicación,
finanzas, compras sensibles, documentos privados, alertas críticas, permisos.

Tools auditables actuales: clasificar documento (Bandeja Inteligente),
proponer medicación/movimiento/función, marcar evidencia, narrar resumen.
Cada llamada queda en `audit_log`.

Control de costo: AI features apagadas por defecto
(`VANTDOMUS_AI_FEATURES_ENABLED=false`). Por hogar, plan y volumen mensual
(definición pendiente en §41). Anti-fuga entre hogares: la IA solo recibe
contexto recuperado del `household_id` activo del usuario.

## 39. Onboarding familiar (objetivo)

Flujo objetivo (no necesariamente implementado al 100%):

1. Crear cuenta (email + password, MFA opcional).
2. Crear hogar (nombre familiar, no UUID visible).
3. Invitar integrantes (email o link de invitación).
4. Crear perfiles/personas (incluyendo menores y adultos mayores).
5. Asignar roles (ver §40).
6. Configurar **3 cosas mínimas** para que el hogar sienta valor:
   - una receta o medicamento de un integrante,
   - un documento (boleta o circular) en la Bandeja,
   - un aviso en el Mural.
7. Activar la Guía Familiar.

Onboarding **NO debe** pedir todos los integrantes de golpe ni exigir
configuración avanzada antes del primer "wow". El primer aviso de Domi debe
basarse en datos reales del paso 6.

## 40. Roles y permisos ampliados

Roles actuales: owner / admin / member / viewer.

Roles objetivo (canon UNIVERSO §13/§89):

| Rol | Alcance |
|---|---|
| owner | Configura hogar, integrantes, datos, revisa evidencia, confirma IA |
| admin | Mismas capacidades que owner excepto eliminar el hogar |
| integrante adulto | Ve sus funciones y lo compartido con su rol |
| menor / restringido | Ve solo lo que el owner habilite (sin finanzas) |
| cuidador familiar | Ve salud asignada + alertas |
| cuidador externo | Acceso temporal scoped a salud/medicación |
| solo lectura | Ve sin modificar |
| profesional externo (futuro) | Acceso por consentimiento granular |

Permisos por: hogar · persona · categoría · documento · función · salud ·
ubicación · finanzas · compras · evidencia. **Default deny.**

## 41. Modelo comercial (borrador, sin compromiso comercial)

Borradores (no son precios, no son SKUs):

- **Gratis limitado** — 1 hogar, hasta N integrantes, sin IA, almacenamiento
  básico, sin push productivo.
- **Familiar básico** — Mural, Compras, Actividades, Bandeja con clasificación
  por reglas, sin IA generativa.
- **Familiar plus** — IA propone (no decide), recordatorios push, almacenamiento
  ampliado.
- **Cuidado adulto mayor** — Add-on: alertas a cuidador, evidencia de
  medicación, panel de cuidador externo.
- **Familia extendida** — Multi-hogar bajo un mismo owner (abuelos +
  hijos/padres).
- **B2B2C** — empresa/colegio/residencia ofrece VantDomus a sus familias /
  pacientes / alumnos / colaboradores.

Pendiente de validación con clientes reales. **NO compromete precios hasta
después del pitch.**

## 42. Privacidad, menores, salud, ubicación

Regla raíz: **el dato sensible no sale de VantDomus** salvo consentimiento
explícito del owner del dato (o de su tutor en caso de menores).

- **Salud y medicamentos:** sin diagnóstico, sin reemplazo médico. Disclaimer
  visible. Confirmación humana obligatoria.
- **Menores:** sin compartir documentos médicos con externos sin consentimiento.
- **Ubicación:** opt-in puntual. Sin tracking continuo. Sin geofencing v1.
  Compartir solo cuando el integrante envía el check-in.
- **Documentos:** scoped por household y por integrante. Cuidador externo solo
  ve lo asignado.
- **IA:** el modelo recibe solo el contexto del household activo del usuario.
- **Borrado/exportación:** roadmap (pendiente, ver §44).

## 43. Roadmap por dominios (separado, no mezclado)

| Dominio | Próximo |
|---|---|
| Uso diario (Coordinación) | Polish del Mural + Actividades + Compras tras revisión del owner; Check-in voluntario (fase 3 VG+2.3). |
| IA | Mantener AI off por defecto; subir confirmación humana visible (hecho en U1-FIX); estructurar outputs en tools auditables. |
| Salud y cuidado | Sumar perfiles de apoyo más finos; cuidador externo scoped. |
| Documentos | OCR de fotos diferido; entrada por texto pegado y PDF estable. |
| Compras | Mantener carro tentativo. Integraciones externas (supermercado/farmacia) DIFERIDO. |
| Infraestructura | Sprint C deploy (SQLite+Disk Render + Vercel nuevo). Para masificación: Postgres gestionado, storage, scheduler/workers, observabilidad, backups. |
| B2B | No distraer ahora. La arquitectura ya lo permite (industry_preset). |
| Comercial | Validar con familias reales antes de cerrar planes. |

## 44. Qué existe vs qué NO existe (al cierre v2)

**Existe (verificado):** API FastAPI, Web Next.js 16, Mobile Expo, motor
VantGuide, UnitFunction/Event/Evidence/Memory/ProgressSnapshot,
PersonSupportProfile, RewardRule, Bandeja Inteligente v1 (texto+PDF),
Family Board + Compras + Carro + Actividades del Día (Sprint U1-LOCAL),
Panel del Hogar `/hogar/[hid]`, Mural `/avisos/[hid]`, Compras
`/compras/[hid]`, Actividades `/actividades/[hid]`, Domi narrador
server-side, AssistantOrb CSS, settings familiares limpios (Sprint
U1-FIX), navbar coherente Mural+Compras, badge "Confirmación humana"
en avisos de salud, botones "→ Compra" / "→ Actividad" en cada aviso,
tests 63/63 verdes locales.

**NO existe todavía:** deploy público final · Postgres producción ·
scheduler runtime · push notifications productivas · email inbound real ·
WhatsApp real · OCR robusto de fotos · IA generativa plena con
structured output · ubicación/check-in implementada (fase 3) · billing ·
onboarding masivo guiado · invitaciones familiares completas · panel admin
SaaS · observabilidad producción · backups restaurables probados ·
política de retención · Términos/Privacidad finales · mobile polish
completo · App Store/Play Store · integraciones supermercado/farmacia ·
integraciones clínicas/colegios · borrado/exportación de datos por owner.

## 45. Riesgos críticos (a manejar antes de beta real)

1. **Promesas que no se pueden cumplir** — claims B2B aspiracionales
   (WhatsApp, Teams, Drive, SLA, IA "que decide"). Mitigación: copy
   "Próximamente", deshabilitar selectores muertos, no usar logos
   externos sin acuerdo.
2. **Datos sensibles en demo** — un cliente sube boleta/receta real y
   queda en SQLite local. Mitigación: `APP_ENV=demo` visible,
   disclaimer, sin datos reales de terceros sin consentimiento.
3. **Confianza familiar** — si Domi alguna vez "decide" algo importante
   sin confirmar, la familia pierde la confianza para siempre.
   Mitigación: badge "Confirmación humana requerida" en salud/alertas
   (implementado en U1-FIX); ninguna acción sensible automática.
4. **Fuga entre hogares** — error en scoping de queries. Mitigación:
   `require_household_role` en todos los endpoints + tests 403
   cross-household (existentes).
5. **Falsa sensación de cobertura** — si el navbar promete "Operaciones"
   o "Seguridad/Fatiga" en family, el usuario asume que existen.
   Mitigación: navbar y settings condicionados por preset (U1-FIX).
6. **Ubicación** — riesgo legal y emocional alto si se implementa mal.
   Mitigación: opt-in puntual, sin background tracking, fase 3 separada.
7. **Costo IA descontrolado** — sin control de tokens por hogar.
   Mitigación: AI off por defecto; cuando se prenda, contar por hogar
   con tope mensual.

## 46. Checklist antes de beta real (criterios mínimos)

- [ ] Sprint C cerrado: deploy demo SQLite+Disk + Vercel limpio + URL
  pública estable + smoke 21 puntos verde.
- [ ] Migración a Postgres gestionado decidida y probada en staging.
- [ ] Scheduler runtime (cron externo) con al menos 1 recordatorio que
  llega a un canal real (email transaccional mínimo).
- [ ] Borrado/exportación de datos por owner implementado.
- [ ] Términos y Privacidad legibles, con dueño legal claro.
- [ ] Onboarding guiado (5-7 pasos) que termina en un "wow" real (no
  con la pantalla vacía).
- [ ] Pruebas de visibilidad por rol en cada módulo (owner, member,
  viewer, menor) cubiertas.
- [ ] Disclaimers claros en salud y finanzas.
- [ ] 0 claims aspiracionales en copy visible (auditoría de copy).
- [ ] Smoke en mobile (Expo) mínimo.
- [ ] Plan de soporte y respuesta a incidentes.
- [ ] Política de retención y de respuesta a borrado por usuario.
- [ ] Estrategia de datos reales: qué se permite y qué no, en demo /
  beta / producción.

Sólo cuando esta checklist esté verde se abre **beta real** con familias
externas. Hasta entonces: demo local + revisión con co-arquitecto + pitch
controlado.
