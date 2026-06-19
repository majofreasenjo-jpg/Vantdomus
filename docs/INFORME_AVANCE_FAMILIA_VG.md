# Informe de avance — VantDomus modo Familia (VantGuide)

> **Para revisión del co-arquitecto.** Estado al cierre de la sesión de Claude Code.
> Rama `master` → push a `main` (`github.com/majofreasenjo-jpg/Vantdomus`).
> Todo lo descrito está commiteado y pusheado salvo donde se indique.

---

## 1. Resumen ejecutivo

Se retomó el proyecto desde el handoff Cowork→Code. Se arrancó verificando el
demo local y se terminó haciendo un saneamiento amplio del **modo familia**:
correcciones de bugs que rompían pantallas clave, un flujo de IA que estaba
muerto, identidad/visibilidad por integrante, idempotencia del seed, suite de
tests reparada y verde, y un rediseño visual (tema cálido + niveles de detalle).

- **18 commits** desde el handoff (`a096a49..a2b2686`).
- **Suite de tests: 43/43 verde** (estaba en 0 ejecutables).
- **Hogar demo limpio nuevo**: `becba85b-80e7-4cce-8560-b7bd0495df44`.
- Quedan features grandes pendientes (la principal: **Bandeja Inteligente de
  documentos** — subir comprobante → leer → clasificar → enrutar).

Diagnóstico de fondo: el "modo familia" es hoy un **reskin** sobre el producto
B2B. Funciona, pero varias pantallas secundarias (Agenda, Documentos/ESG,
Presupuesto) todavía arrastran estilo y conceptos B2B. Convertirlo en un
producto familiar "vendible" es un mini-sprint de UX + 1–2 features.

---

## 2. Contexto y entorno

- **Stack**: API FastAPI (`apps/api`, SQLite local / Postgres prod), Web Next.js 16
  (`apps/web`, App Router, Server Components), mobile Expo (no tocado).
- **Entidad central**: `unit_functions` (VantGuide). Modo familia se activa con
  `households.meta.industry_preset = "family"`.
- **Local**: Python 3.14 + `requirements-local.txt`; web `npm run dev`.
  Scripts en `tools/windows/` (Setup-LocalDev, Run-API, Run-Web, Smoke-Local).
- **Cuenta admin/owner**: `manuel@vantdomus.local` / `Demo-Pass-2026!`.

---

## 3. Lo realizado (por área, con commits)

### 3.1 Bugs que rompían pantallas
- **Pantalla "Evolución" (la wow)** no mostraba el antes/después ni el `+41.7%`.
  Causa: los endpoints de **listado** devolvían columnas JSON (`schedule`,
  `metadata`) como string crudo (el GET individual sí parseaba). Se hidratan en
  `list_unit_functions` y `/library/evidence`. Además la página usaba el snapshot
  intermedio como "ANTES" en vez del original. `5f9200c`
- **Buzón (`/inbox`)** no compilaba: importaba `listHouseholds` inexistente
  (era `getHouseholds`). `9b7e614`
- **Salud**: "Asignar control"/"Registrar cuidado" guardaban pero la pantalla no
  refrescaba (faltaba `revalidatePath`) → se sentían muertos. `632ff68`
- **Flujo "Confirmar IA"** (atorvastatina) no aparecía: el `GET /unit_functions/{id}`
  (modelo `UnitFunctionResponse`) no exponía los campos `ai_*`, así que la página
  de detalle nunca mostraba el bloque confirmar/descartar. `6c18e88`
- **Contexto de hogar**: visitar `/dashboard/{id}` no fijaba el hogar activo;
  Guía/Biblioteca caían a `getHouseholds().items[0]`. Se fija la cookie `hid` en
  `proxy.ts` al visitar el dashboard. `fc19db7`
- **Fix inicial del handoff**: enums de `supervision_level` en el seed. `51024dc`

### 3.2 Identidad y visibilidad por integrante
- Migración `272_persons_user_link.sql`: `persons.user_id` (vincula integrante↔cuenta).
- `POST /demo/seed_members`: crea un usuario por integrante (rol `member`) y lo
  vincula; siembra una nota privada (`visible_to_roles=["self"]`) por persona
  para demostrar la restricción.
- Visibilidad (`/library/evidence`, `/library/{person_id}`): nuevo
  `_is_visible_to_user` — owner/admin ven todo; un integrante ve `household`
  (compartido) + `self` (lo suyo). `01edf12`
- **Verificado**: owner ve las 4 notas privadas; Elena ve solo la suya; Diego la suya.

### 3.3 Escaneo de recetas (OCR v1, human-in-the-loop)
- `POST /unit_functions/scan_prescription` (multipart): extrae texto de PDF
  (PyMuPDF), heurística regex nombre+dosis, crea `unit_function` medication con
  `ai_needs_confirmation=true` (mismo patrón que la atorvastatina). UI: tarjeta
  "Escanear receta" en la Guía. `8e5afdd`
- Honesto: best-effort, sin OCR de imágenes garantizado; confirmación humana.

### 3.4 Seed idempotente
- `_seed_family` reusa personas por `(household_id, display_name)` y aborta la
  recreación si el hogar ya tiene funciones → re-clic en "Cargar datos de
  ejemplo" ya no duplica integrantes ni movimientos. `8bf787c`, `7fc263b`

### 3.5 Tests
- Fixtures rotos (no se disparaba el lifespan → sin tablas) y tests apuntando a
  rutas viejas (`POST /households/{hid}/persons` → hoy `POST /persons`). Se
  arreglaron fixtures (`with TestClient(...)` + host `testserver`) y se
  modernizaron rutas/policy. `5f9200c`, `2720cff`
- Bug real corregido: el evento `completed` no era idempotente (el `dedupe_key`
  incluía timestamp) → ahora solo se emite al transicionar a done. `27602b0`
- **Resultado: 43/43 verde** (core + consolidation + auth). `pytest`/`httpx`
  agregados a `requirements-local.txt`.

### 3.6 Diseño / UX (modo familia)
- **Tema "Arena & Salvia"** (elegido entre 3 opciones, alineado a tendencia
  Pantone 2026 de neutros cálidos): fondo arena, salvia, terracota, charcoal,
  tarjetas blancas. Solo aplica con `data-theme="family"`; el modo B2B sigue
  oscuro. `3e11f39`, `0661366`
- **Legibilidad**: `--muted` más oscuro, tamaños de fuente mayores. `1854fdf`
- **Panel escolar (Agenda)** dejó de ser oscuro (heredaba estilo B2B). `1854fdf`
- **Niveles de vista Simple/Completo**: cookie `view_level` + `data-level` en el
  body + botón en navbar; en *Simple* se ocultan `.advanced` (márgenes,
  intervalos de confianza, Sub-KPIs, jerga). Aplicado al dashboard. `8e826e2`
- **Botones legibles**: el salvia claro con texto blanco tenía bajo contraste;
  ahora salvia profundo. **Presupuesto**: moneda default CLP (era USD), nota que
  aclara ingreso/gasto e integrante responsable. `a2b2686`

### 3.7 Tooling Windows
- Scripts `tools/windows/*` commiteados; fix de `Setup-LocalDev.ps1`
  (`[Convert]::ToHexString` no existe en PowerShell 5.1). `5ffce13`

---

## 4. Estado de calidad

- **Tests**: 43/43 (verificado). Cubren VG core (CRUD, evidencia, memoria,
  perfiles, scheduler dedupe, school adapter), VG+1 (versionado, AI gating,
  multi-responsables) y auth/policy.
- **No hay** tests de las features nuevas (scan_prescription, visibilidad por
  persona, niveles de vista) — **deuda de test**.
- **No corre CI** todavía; los tests se corren a mano.

---

## 5. Demo limpio para mostrar

- **Hogar**: `becba85b-80e7-4cce-8560-b7bd0495df44` (4 integrantes, sin duplicados,
  evolución Losartán +41.7%, atorvastatina pendiente IA).
- **URL**: `http://localhost:3000/dashboard/becba85b-80e7-4cce-8560-b7bd0495df44`
- **Cuentas** (todas pass `Demo-Pass-2026!`):
  - `manuel@vantdomus.local` — **owner/administrador** (ve todo)
  - `elena@ / diego@ / camila@ / pedro@ vantdomus.local` — integrantes (rol member)
- (El hogar viejo `1b79f92b…` quedó con integrantes duplicados de pruebas; usar el nuevo.)

---

## 6. Decisiones de arquitectura tomadas (a validar)

1. **Identidad por persona**: se agregó `persons.user_id` y la visibilidad
   resuelve `self`/`household` según el usuario logueado. (`responsible` aún no
   se resuelve fino — se trata como no-visible salvo household.)
2. **Sistema de tema por `data-theme`/`data-level` en el `<body>`** + variables
   CSS, con override solo para familia. El modo B2B no se toca.
3. **Niveles de detalle** vía cookie + clase `.advanced` (progressive disclosure).
4. **Seed idempotente** por clave natural + guard de "ya sembrado".
5. **Escaneo = human-in-the-loop** (propone, no decide); IA/OCR reales quedan
   detrás de flags (`VANTDOMUS_AI_FEATURES_ENABLED=false`).

---

## 7. Lo que falta (priorizado)

### P1 — Bandeja Inteligente de documentos (núcleo de valor pedido por el dueño)
Un repositorio único: subir **cualquier** comprobante → el sistema lo **lee,
clasifica y enruta** (receta→Salud, boleta→Presupuesto, póliza/contrato→Documentos,
circular→Colegio) y **carga los datos** (monto/comercio/fecha) para evitar
digitar, con confirmación humana. Respaldo + lectura.
- **v1 factible ya**: PDFs (texto), clasificación por reglas, confirmación.
  Reutiliza `scan_prescription`.
- **v2 (requiere inversión)**: OCR de **imágenes/fotos** (instalar tesseract o
  servicio OCR) + clasificación robusta con LLM (activar IA). Hoy no están.
- Referentes: Maple "Fast" (IA convierte avisos/cuentas en tareas), SparkReceipt
  (extrae comercio/monto/fecha y categoriza), Picniic (bóveda de documentos),
  Cozi (no tiene bóveda → hueco de mercado).

### P2 — Coherencia de UX familia
- Extender **Simple/Completo** y el tema a Guía, Biblioteca, Agenda, Presupuesto
  (hoy solo el dashboard tiene `.advanced` marcado).
- **"Ver como"**: selector para que el owner vea todo o filtre por integrante
  (descongestiona; el backend de visibilidad ya existe).

### P3 — Presupuesto claro
- Escaneo de boleta → autocompletar monto/comercio/fecha (depende de P1).
- Ver gasto **e ingreso** por integrante; reportes simples.

### P4 — Familizar "Documentos" (`/esg`)
- Hoy arrastra jerga/estética B2B ("ESG"). Convertir en un "Documentos del hogar"
  simple (que además sea la cara de la Bandeja Inteligente).

### P5 — Recordatorios estilo calendario
- Vista de agenda tipo Teams/celular: clic en el día → crear inline (pedido del
  dueño; hoy son formularios de campos sueltos).

### P6 — Deploy VG+4 (Render + Vercel + Neon)
- Pendiente; runbook preparado (`docs/HANDOFF_TO_CLAUDE_CODE.md` §8). App lista
  para deploy con `APP_ENV=local` (bypass de `validate_runtime_security`).
  Necesita cuentas/credenciales del dueño.

### Otros / deuda
- Tests de las features nuevas; CI.
- Etiquetar explícitamente el rol "Administrador del hogar" en la UI.
- Mobile (Expo) no tocado; el copy/tema familiar no está replicado.

---

## 8. Límites técnicos honestos (para no sobreprometer)

- **Lectura automática de documentos**: PDF con capa de texto = OK (PyMuPDF).
  **Fotos/escaneos imagen** = requiere OCR no instalado. Clasificación por reglas
  es básica; la robusta necesita un LLM con `VANTDOMUS_AI_FEATURES_ENABLED=true`.
- **Visibilidad**: `self`/`household` resueltos; `responsible` no fino.
- **Mobile** no incluye nada de este trabajo.
- El demo corre con `APP_ENV=local`; producción dura (ClamAV/Redis/SMTP) no está
  configurada.

---

## 9. Preguntas para el co-arquitecto

1. **Bandeja Inteligente**: ¿v1 por reglas + PDF ahora, o esperar a habilitar
   OCR de imágenes + LLM para hacerla bien de una? ¿Qué motor OCR/IA se prefiere
   (tesseract local vs servicio; qué proveedor LLM)?
2. **Modelo de routing**: al clasificar un documento, ¿creamos directamente la
   entidad destino (gasto/receta) en estado "pendiente de confirmar", o lo
   dejamos en una bandeja y el humano decide el destino?
3. **Niveles de detalle**: ¿2 niveles (Simple/Completo) o 3 (Básico/Medio/Experto)?
   ¿Por hogar o por usuario?
4. **Identidad/visibilidad**: validar el enfoque `persons.user_id` + `self/household`.
   ¿Cómo modelar `responsible` y el caso de un integrante sin cuenta (menor)?
5. **Documentos/ESG**: ¿se reemplaza la página `/esg` por la Bandeja en familia,
   o conviven?
6. **Deploy**: ¿seguimos con Render/Vercel/Neon del runbook?

---

## 10. Actualización post-revisión del co-arquitecto (VG+2.1 y VG+2.2)

El co-arquitecto revisó el avance, lo aprobó y respondió las 6 preguntas. Se
ejecutaron dos sprints según sus instrucciones (sin tocar arquitectura interna
ni VantGuide como motor).

### Sprint VG+2.1 — Limpieza familiar visible (commit `f0c12b1`)
- Dashboard: sin "Volver a Dirección Ejecutiva" en family; `unit` → "Núcleo familiar".
- Guía: sin breadcrumb "VantGuide"; KPI "Pendientes de revisión" + subtítulo.
- "VantGuide" visible → "VantDomus" o quitado (sigue como motor interno).
- Agenda: "Planificador escolar IA" → "Guía de estudio y compromisos".
- Finanzas: "WEALTH GUARD FAMILIAR" → "Finanzas del hogar".
- Documentos: ruta `/documents`, pantalla "Documentos familiares", ESG solo B2B,
  bloque oscuro "Aporte concreto" → paleta clara.
- Salud: empty state útil con CTAs.
- DoD verificada por grep sobre el HTML real. Tests 43/43.

### Sprint VG+2.2 — Bandeja Inteligente v1 (commit `c5ff09e`)
Pipeline: `upload → extract_text (PDF) → classify (reglas) → DocumentRouteCandidate
→ preview → confirmación humana → crear destino`.
- Migración 273: tabla `document_route_candidates` (routing explícito + auditoría).
- Reglas: receta, boleta, circular, doc médico, póliza/seguro, cuenta/vencimiento, general.
- Endpoints: `/smart_inbox/analyze | /candidates | /candidates/{id}/confirm | /reject`.
- Destinos: receta→medication (ai_needs_confirmation=true), circular→study,
  boleta→gasto, cuenta/póliza→document_deadline, médico/general→evidencia;
  rechazo opcional como negative_learning.
- UI "Bandeja inteligente" en Documentos familiares (subir/pegar, preview editable).
- Límites honestos: imagen sin OCR → "revisión manual"; no inventa datos;
  medication/health siempre requieren confirmación; nada de IA si está apagada.
- Tests: 9 nuevos (10 casos del DoD). Suite total **52/52 verdes**.

### Smoke de visibilidad pre-deploy (gate decisión #4) — PASA
- Owner ve todo; integrante (role member) ve menos (11 vs 18 evidencias).
- Integrante accede a los hogares de los que es miembro.
- Hogar donde NO es miembro: dashboard / evidencia / smart_inbox → **403**.

### Pendiente / notas
- **Dato**: el hogar demo `1b79f92b` tiene integrantes duplicados (re-seeds
  viejos); para el pitch usar el hogar limpio `becba85b` ("Familia Demo VG").
  En producción (Neon nueva) un solo seed da datos limpios.
- Próximo (orden A→B→C→D): **C = deploy demo** (Render/Vercel/Neon), luego
  **D = runtime real** (scheduler, push, email inbound).

---

*Generado por Claude Code. Detalle por commit disponible en el historial de git
(`git log a096a49..HEAD`).*
