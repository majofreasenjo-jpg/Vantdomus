# VantDomus — Documento Canónico del Proyecto

> Documento canónico completo dentro del repo, equivalente al documento maestro
> de Drive (`VANTDOMUS_CANONICO_PROYECTO_v1`). Fuente de verdad para consultas
> futuras. No contiene secretos.

## 1. Resumen ejecutivo

VantDomus **no es solo una agenda**, ni solo recordatorios, ni solo una app de
medicamentos. Es una **guía familiar inteligente** con funciones, memoria,
evidencia, documentos, salud, estudio, presupuesto, roles y acciones auditables.
El motor técnico interno se llama **VantGuide** y su entidad central es
`unit_function`. En modo familia se presenta como **VantDomus Hogar**; el mismo
motor escala a B2B (minería, oficina técnica, clínica, etc.) cambiando el preset.

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

## 24. Deploy pendiente

Sprint C: backend a Render (apps/api, Python 3.11, `APP_ENV=demo`, AI off),
frontend a Vercel (apps/web, `NEXT_PUBLIC_API_BASE`), DB Neon de Manuel. Ver
`docs/DEPLOY_DEMO_RUNBOOK.md`.

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
