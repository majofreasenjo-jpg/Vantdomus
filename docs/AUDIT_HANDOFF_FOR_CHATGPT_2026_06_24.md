# VantDomus — Resumen para auditoría externa (ChatGPT / co-arquitecto)

> **Propósito:** entregar a un revisor externo el estado completo y verificable
> del proyecto en este corte, para auditar producto, arquitectura, seguridad y
> deploy. Documento autocontenido; sin secretos.
>
> **Fecha:** 2026-06-24 · **Commit HEAD:** `2bdb6a4` (en `main`) ·
> **Tests:** 52/52 verdes (última corrida verificada en commit anterior;
> ningún cambio de código posterior toca tests).

---

## 1. Identidad del proyecto

- **Producto:** VantDomus Hogar — guía familiar inteligente (modo familia del
  motor VantGuide). Mismo motor escala a B2B por preset (mining, oficina técnica,
  EPC, salud, PUMA, etc.).
- **Dueño:** Manuel (`majofreasenjo@gmail.com`).
- **Repo:** `https://github.com/majofreasenjo-jpg/Vantdomus` (privado), branch `main`.
- **Stack:** FastAPI (Python) + Next.js 16 (App Router) + Expo (mobile).
- **DB:** SQLite local; deploy intentado con SQLite en filesystem (Postgres rama
  frágil — ver §7).

## 2. Tesis de posicionamiento

VantDomus **no compite como agenda, recordatorio ni chat**. Compite como
**guía familiar inteligente con memoria, evidencia, funciones, documentos,
salud, estudio, presupuesto, roles y acciones auditables**. Confirmación humana
de la IA. Ningún competidor junta todo eso (ver `docs/COMPETITIVE_UX_AUDIT_2026.md`).

## 3. Estado actual — qué está hecho y verificado

### 3.1 Producto (todo aprobado por el co-arquitecto previo)
- **VG núcleo + VG+1** — UnitFunction transversal, versionado, evidencia (+/−),
  memoria, perfil adaptativo no clínico, AI gating, multi-responsables.
- **VG+2 UI** — Guía Familiar, Biblioteca, pantalla de Evolución (+41.7% wow).
- **VG+2.1 Limpieza familiar visible** (`f0c12b1`, aprobado):
  sin "Dirección Ejecutiva", sin "ESG", sin "Wealth Guard", sin
  "Planificador escolar IA", sin "VantGuide" como copy. Sí "Guía Familiar",
  "Pendientes de revisión", "Finanzas del hogar", "Documentos familiares",
  Salud con empty states.
- **VG+2.2 Bandeja Inteligente v1** (`c5ff09e`, aprobado):
  upload/pegar → `extract_text` (PDF) → `classify` (reglas) →
  `DocumentRouteCandidate` → preview editable → **confirmación humana** →
  crear destino (UnitFunction medication/study/document_deadline, expense,
  evidence, memory). Rechazo opcional como `negative_learning`. Auditoría
  completa. Sin OCR de fotos ni IA plena (preparado para enchufarlos).
- **AssistantOrb "Domi"** (`75599b4`): asistente vivo original (CSS, sin IP de
  terceros) en Guía y Bandeja; estados idle/thinking/success/alert/calm/listening;
  respeta `prefers-reduced-motion`. Preparado para upgrade a Lottie/Rive.

### 3.2 Smoke de visibilidad (pre-deploy gate — PASA)
- Owner ve todo · integrante (member) ve menos (11 vs 18 evidencias en demo).
- En un hogar donde NO es miembro: dashboard / evidencia / smart_inbox → **403**.

### 3.3 Tests
- Suite VG + smart_inbox + auth: **52/52 verdes** (última corrida tras VG+2.2).
- Cambios posteriores son solo de **deploy/config** (railway.toml, requirements,
  fallback de DB_PATH); no tocan lógica.

### 3.4 Documentos canónicos (en repo)
- `docs/PROJECT_RULES.md` · `docs/REHYDRATION_INDEX.md`
- `docs/VANTDOMUS_CANONICO_PROYECTO.md` (35 secciones)
- `docs/VANTDOMUS_MANUAL_USO.md` · `docs/VANTDOMUS_MANUAL_PROYECTO_TECNICO.md` (42 secciones)
- `docs/VANTGUIDE_ARCHITECTURE.md` · `docs/DEPLOY_DEMO_RUNBOOK.md`
- `docs/INFORME_AVANCE_FAMILIA_VG.md`
- `docs/COMPETITIVE_UX_AUDIT_2026.md` (matriz vs Teams/Cozi/Maple/Medisafe/ElliQ/…)
- `docs/PITCH_DEMO_SCRIPT.md` (guion 3 min)
- `docs/ASSISTANT_DOMI_CONCEPT.md`

## 4. Diferenciadores (validados en código)

1. **UnitFunction transversal** (medicamento, estudio, cita, rutina = misma entidad).
2. **Evidencia positiva y negativa** (lo que funcionó + lo que no).
3. **Memoria estructurada** en VantDomus, no en el LLM (`memory_items`).
4. **Perfil de apoyo no clínico** (`attention_profile`, `calm_tools`, ...).
5. **Confirmación humana de IA** (`ai_needs_confirmation` + `/confirm` endpoint).
6. **Bandeja Inteligente** (documento → ruta → acción, con rechazo como aprendizaje).
7. **Roles/visibilidad** (`household_memberships.role` + `persons.user_id` +
   `visible_to_roles` + `consent_scope`).
8. **Multi-tenant + B2B por preset** (`INDUSTRY_PRESETS_UI` + `organization_id`).
9. **Auditoría** (`write_audit_log` en acciones sensibles).
10. **Migraciones versionadas** (SQLite, `apps/api/sqlite_migrations/`).

## 5. Brechas conocidas (honestas; pendientes de roadmap)

- **OCR de fotos** ausente (solo PDF + texto pegado).
- **Push real** y scheduler runtime (Sprint D pendiente).
- **Voz** (relevante vs ElliQ).
- **Vista calendario/agenda** (mes/semana) — clave de uso diario.
- **Mobile polish** incompleto.
- **Onboarding guiado** de 10 segundos.
- **Microinteracciones / loading states** pobres → sensación de prototipo.
- **Profundidad medicación** (interacciones, refill) menor que Medisafe.
- **Rama Postgres de migraciones** frágil (ver §7 — bloqueante para Neon).

## 6. Seguridad — postura y regla canónica

### 6.1 Reglas (en `docs/PROJECT_RULES.md`)
- Secretos **nunca** por chat, log, doc ni commit. Si aparecen, se queman y rotan.
- `DATABASE_URL`, `JWT_SECRET`, `VANTDOMUS_MFA_SECRET_KEY`,
  `VANTDOMUS_BACKUP_ENCRYPTION_KEY`, API keys, tokens de Render/Vercel/Neon,
  OpenAI/Anthropic, SMTP/SendGrid — solo en el panel del proveedor.
- `APP_ENV=demo` para la demo (no producción). `VANTDOMUS_AI_FEATURES_ENABLED=false`.

### 6.2 Incidente de secretos durante la sesión (a auditar)
- **Tres secretos generados por el asistente quedaron impresos en chat** y se
  consideran quemados; **nunca se cargaron en ningún panel**. Mitigación: nunca
  más generar secretos por chat (acordado y aplicado).
- **Una connection string Neon** real estaba commiteada en
  `docs/SECURITY_HARDENING_RUNBOOK.md` desde antes del sprint (incidente
  documentado por equipo previo). En el commit `0f7f1c1` se **redactó** ese
  valor del archivo actual; **sigue en el historial de git** → la DB
  (`ep-divine-violet-.../vantdomus_neon`) debe rotarse/retirarse y **no
  reutilizarse**.
- En la fase de deploy de hoy se mostró por captura una `DATABASE_URL` del
  proyecto Neon nuevo (`vantdomus-demo`); también se considera quemada por
  exposición visual. Esa DB **nunca conectó nada** y queda vacía/sin uso →
  pendiente rotar password o pausar/borrar el proyecto Neon.

### 6.3 Visibilidad de la app
- Smoke (§3.2) confirma: owner ve todo, member ve solo lo propio+compartido,
  403 cruzado entre hogares.
- `validate_runtime_security` exige infra dura (ClamAV/Redis/SMTP/webhooks) solo
  con `APP_ENV ∈ {production, prod, staging}`. `demo` relaja (sin ser producción).
- Frontend: `APP_ENV=demo` deja el proxy fail-closed (sin token de fallback local).
  ⚠ Riesgo legacy: el proyecto Vercel viejo `vantdomus-panel` tenía variables
  `NEXT_PUBLIC_ACCESS_TOKEN` y `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID` (modo demo sin
  login). Hay que **eliminarlas** antes de exponer URL pública.

## 7. Deploy — historia del día y estado actual

### 7.1 Plan original (runbook)
Backend en Render (apps/api, Python 3.11, `APP_ENV=demo`, AI off) + Frontend en
Vercel (apps/web, `NEXT_PUBLIC_API_BASE`) + DB Neon. Documentado en
`docs/DEPLOY_DEMO_RUNBOOK.md`.

### 7.2 Lo que salió bien
- Gate pre-deploy ✅ (main sincronizado, tests verdes).
- Soporte `APP_ENV=demo` validado en `app/config.py`.
- Runbook completo con DoD y smoke de 21 puntos.

### 7.3 Lo que salió mal (con causa raíz documentada)
1. **Render #1**: build bloqueado por *pipeline minutes* agotados (no es código).
   → Upgrade de Render aplicado por el usuario.
2. **Render #2**: build pasaba antes de psycopg2-binary 2.9.9/PyMuPDF 1.24.0 sin
   wheels para builder. → Fix `2b2eaf3` (psycopg2 2.9.10, PyMuPDF 1.25.5).
3. **Pivote a Railway** por agotamiento del usuario con Render. Cadena de errores
   en Railway documentada en commits:
   - Railpack no detecta app → `3d7eb79` (railway.toml raíz).
   - `pip: command not found` (buildCommand corre antes de Python) → `c941c26`
     (mover railway.toml a `apps/api`, Root Directory).
   - **`$PORT` literal** (Nixpacks no expande sin shell) → `508a64e`
     (`sh -c 'uvicorn ... --port ${PORT:-8000}'`).
   - SQLite `unable to open database file` cuando `DB_PATH=/data/...` sin Volume →
     `2bdb6a4` (`os.makedirs(parent, exist_ok=True)` con fallback a `/tmp`).
4. **Vuelta a Render** (decisión del usuario; Railway descartado).
   Estado actual: pendiente borrar `DATABASE_URL` del Environment, agregar
   `DB_PATH=/tmp/vantdomus.db`, redeployar `main` (`2bdb6a4`). El último check
   automatizado a `https://vantdomus.onrender.com/health` devuelve **HTTP 502
   "Application failed to respond"** (deploy viejo todavía vigente o crash al
   arrancar; pendiente confirmar con log).

### 7.4 Frontend
- Vercel `vantdomus-panel` existe pero apunta a commit viejo (`8393b35`, mayo)
  con **Root Directory mal configurado**. Pendiente: Root → `apps/web`, agregar
  `NEXT_PUBLIC_API_BASE=<URL Render nuevo>`, eliminar variables legacy
  `NEXT_PUBLIC_ACCESS_TOKEN`/`NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID`, redeploy.
- Build de producción local **passes clean** (verificado en commit `75599b4`):
  todas las rutas nuevas (Guía, Bandeja, Documentos, etc.) compilan sin error.

### 7.5 Rama Postgres del backend (deuda técnica clave)
- `app/db.py` `ensure_schema()` rama Postgres parte SQL por `;` y traduce poco
  (`INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`; `ON CONFLICT DO
  UPDATE SET` con reemplazo trunco). **No probada contra Neon real.**
- Implicancia: con `DATABASE_URL` cargado la app intenta Postgres y las
  migraciones revientan → crash al arrancar. Por eso la demo va con SQLite.
- **Recomendación de auditoría:** decidir si arreglar la rama Postgres (varias
  horas, probar las 32 migraciones contra Neon) o consolidar SQLite + Disk
  persistente como camino oficial de demo y dejar Postgres para producción seria.

## 8. Commits relevantes (cronología corta)

```
2bdb6a4 fix(db): crear dir padre de SQLite si no existe; fallback a /tmp
508a64e fix(deploy): envolver startCommand en sh -c para que expanda $PORT
c941c26 chore(deploy): mover railway.toml a apps/api (Root Directory en Railway)
3d7eb79 chore(deploy): railway.toml en raíz para que detecte apps/api
bf7a988 chore(deploy): fijar Python 3.11.9 para el backend
2b2eaf3 fix(deploy): bump psycopg2-binary 2.9.10 + PyMuPDF 1.25.5
75599b4 feat(web): AssistantOrb "Domi" + competitive UX audit + pitch script
0f7f1c1 docs: add canonical continuity and project manuals
9bf1ef2 docs(security): los secretos se generan y cargan directo en R/V/N
485f934 docs: runbook de deploy demo (Sprint C)
22766a2 docs: informe actualizado con VG+2.1, VG+2.2 y smoke de visibilidad
c5ff09e feat(vantguide): Implement smart family inbox v1 (Bandeja Inteligente)
f0c12b1 feat(web): VG+2.1 limpieza familiar visible (sin jerga B2B/legacy)
6c18e88 fix(vantguide): GET /unit_functions/{id} expone campos ai_*
fc19db7 fix(web): visitar /dashboard/{id} fija el hogar activo (cookie hid)
27602b0 fix(vantguide): evento 'completed' idempotente (suite 43/43 verde)
2720cff test(vantguide): modernizar tests a rutas/policy actuales (0→41)
5f9200c fix(vantguide): pantalla Evolución + hidratar JSON en listados
51024dc fix(demo): supervision_level enums correctos para UnitFunction
a096a49 feat(vantguide-ui): Guía Familiar + Biblioteca + Evolución [VG+2]
3d3c618 Consolidate VantGuide core runtime architecture [VG+1]
1832615 feat(vantguide): núcleo transversal [VG]
2a88144 feat(family): Sprint 1 — modo familia sublime end-to-end
d309487 Initial commit: post-security-cleanup baseline (tag baseline-secure-2026-05)
```

## 9. Preguntas concretas para la auditoría

1. **Rama Postgres**: ¿se rescata para soportar Neon en demo (estimación de
   esfuerzo), o se consolida SQLite + Disk persistente como camino oficial de
   demo y se difiere Postgres a producción seria?
2. **Seguridad de secretos**: ¿se considera suficiente la mitigación actual
   (regla canónica + redacción en doc del incidente previo + DB Neon
   `vantdomus-demo` pendiente de rotar) o exige acciones adicionales antes de
   exponer URL pública?
3. **Visibilidad por integrante en producción**: el smoke pasa, pero todavía no
   se ejecutó la fase "ver como integrante" en la demo desplegada. ¿Es
   bloqueante para el pitch o aceptable demostrarlo en local primero?
4. **Vercel `vantdomus-panel`**: ¿reutilizar (con los fixes de §7.4) o crear
   proyecto nuevo limpio para evitar arrastrar config legacy?
5. **Persistencia demo**: sin Disk, `/tmp` se borra en cada redeploy → seed
   manual recurrente. ¿Aceptable para pitch (re-seed en demos) o agregar Disk
   `1 GB / /data` antes de mostrar?
6. **Domi (AssistantOrb)**: CSS suficiente para el pitch, o priorizar migración
   a Lottie/Rive para sentirse "vivo de verdad"?
7. **Profundidad medicación**: si Medisafe es referencia, ¿qué piezas mínimas
   sumar (interacciones, refill, "medfriend") en próximo sprint para no perder
   en pitch frente a clientes con foco salud/adulto mayor?
8. **Roadmap orden A→B→C→D**: ya cubrimos A (VG+2.1) y B (VG+2.2). C (deploy)
   está trabado en infra. ¿Pasar a D parcial (scheduler + push) sin demo
   pública, o resolver C primero con la decisión de §1?

## 10. Cómo rehidratar (si el chat se cae)

1. Leer `docs/REHYDRATION_INDEX.md` (orden obligatorio).
2. Confirmar HEAD con `git log -1` (debe ser `2bdb6a4` o posterior).
3. `git ls-remote origin main` para verificar sync.
4. Suite de tests local (52/52 esperados): ver `docs/VANTDOMUS_MANUAL_PROYECTO_TECNICO.md` §29.
5. Documentos canónicos en `docs/` y Drive
   (`G:\Mi unidad\GMATIVE\VantDomus_Backups\<fecha>\`).
6. Próximo paso operativo: resolver §7.3 punto 4 (Render redeploy con
   `DB_PATH=/tmp/vantdomus.db` y sin `DATABASE_URL`), luego §7.4 (Vercel).

## 11. Lo que el asistente NO debe hacer

- No pedir/imprimir/commitear valores de secretos.
- No tocar arquitectura VantGuide sin OK explícito.
- No agregar features fuera de alcance.
- No usar IP de terceros (Disney, celebridades, voces famosas).
- No activar IA plena / OCR de fotos si están fuera de alcance del sprint.
- No usar deploys viejos (Render/Codex, Vercel sin Root Directory corregido).
- No prometer claims aspiracionales (PCI, HL7, SLA 99.99%, WhatsApp, voz,
  integraciones).

---

*Documento generado para auditoría externa. No contiene secretos. Para detalle
operativo, leer en orden: `docs/PROJECT_RULES.md`, `docs/REHYDRATION_INDEX.md`,
`docs/VANTDOMUS_CANONICO_PROYECTO.md`, `docs/VANTDOMUS_MANUAL_PROYECTO_TECNICO.md`.*
