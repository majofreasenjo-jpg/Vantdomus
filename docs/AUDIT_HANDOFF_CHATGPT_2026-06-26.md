# VantDomus Hogar — Informe de Auditoría para ChatGPT (2026-06-26)

> **Propósito:** que ChatGPT audite el estado actual de VantDomus Hogar tras una
> jornada intensa de sprints (UX premium + asistente Domi + diferenciadores).
> **No hay URL pública** (deploy pausado): la app corre local. ChatGPT audita
> **este informe + el código fuente** (zip adjunto en la misma carpeta de Drive).
>
> Branch: `main` · Commit auditado: **`2df3190`** · Repo: `majofreasenjo-jpg/Vantdomus`
> Stack: FastAPI (apps/api, SQLite local) + Next.js 16 App Router (apps/web) + Expo (apps/mobile).

---

## 0. Cómo correr y verificar localmente

```
# Terminal 1 (API)
cd apps/api && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
# Terminal 2 (Web)
cd apps/web && npm run dev   # http://localhost:3000
```
- Usuario demo: `manuel@vantdomus.local` / `Demo-Pass-2026!` (MFA vacío).
- Hogar demo: crear hogar + `POST /demo/seed?household_id=<HID>&mode=home_v2`.
- Panel: `http://localhost:3000/hogar/<HID>`.
- AI features OFF por defecto (sin API key). No hay secretos en el repo.

---

## 1. Qué es VantDomus Hogar (resumen)

Guía familiar asistida por IA: convierte documentos, rutinas, salud, compras,
avisos, actividades y presupuesto del hogar en funciones trazables, con
confirmación humana. Motor transversal VantGuide; modo familia por preset.
Asistente visible **Domi** ("Constelación inteligente del hogar"). Dirección
canónica de Domi y reglas del proyecto en `docs/ASSISTANT_DOMI_CONCEPT.md` y
`docs/VANTDOMUS_CANONICO_PROYECTO.md`.

---

## 2. Trabajo realizado en esta jornada (29 commits, `4535c1d`..`2df3190`)

### Sprint U1-LOCAL — universo local de alta fidelidad
- Migraciones 274 family_board, 275 household_shopping, 276 daily_activities.
- Routers `/family_board`, `/household_shopping` (+`/cart`), `/daily_activities`.
- Seed v2 (`mode=home_v2`): "Familia Demo VantDomus" (Camila/Pedro/Diego/Sofía/Elena).
- Frontend: Panel del Hogar `/hogar/[hid]` (Domi narrador server-side por reglas),
  `/avisos`, `/compras`, `/actividades`. 11 tests `tests/test_u1_local.py`.

### Sprint U1-FIX — saneo de inmersión familiar
- `/settings` family: oculta Oficina Técnica/PUMA (tras `?advanced=1`), conectores
  "Próximamente" sin claims falsos, "Asistente Domi" en vez de jerga (Codex/Cursor).
- Navbar family: Mural + Compras; item activo resaltado; login sin links B2B.
- Etiquetas en formulario de compras; tarjetas de Documentos con paleta cálida.
- Canon v2 (capítulos 36-47).

### Sprint U2-UX — pulido (tras barrido competitivo)
- Identidad de color por integrante (Cozi); tipografía Nunito; skeletons (Linear);
  Domi celebra con confetti; pie "tus datos son tuyos" + export JSON (CareZone).

### Sprint U3 — Identidad & Social
- Avatares (set ilustrado + foto, migración 277); Estados del hogar nativos
  (En casa/En camino/Llegué/Necesito ayuda) — `/perfiles/[hid]`.
- Login social Google/Facebook: **scaffolding gateado por configuración**
  (`auth_oauth.py`); sin credenciales redirige al login con mensaje honesto.
  Guía: `docs/SOCIAL_LOGIN_SETUP.md`.

### Sprint U4 — Domi "Constelación inteligente del hogar"
- DomiOrb (núcleo+rostro+halo+órbitas+chips), DomiPanel, DomiStateBadge,
  DomiContextChip (CSS/SVG). Estados: sereno/motivado/atento/cariñoso/protector
  + pensando/logro/organizando.
- Domi flotante persistente (`DomiFloating`) que acompaña en toda la app.
- **3D WebGL REVERTIDO**: three.js + react-three-fiber chocaba con el React de
  Next 16 (`ReactCurrentOwner`); se volvió al Domi CSS (estable, multi-dispositivo)
  + sheen premium. El 3D exacto se deja para Rive/Lottie (futuro).
- Responsive canónico (móvil/tablet/reloj/notebook) — `globals.css` breakpoints.

### Sprint copilot — Domi chat
- `/assistant/chat`: con API key → LLM; sin key → **copilot por reglas**
  (`domi_rules.py`) sobre datos reales (integrantes, compras, actividades,
  medicamentos, avisos, presupuesto, resumen). Chat en el Domi flotante.

### Sprint U5/U6 — diferenciadores
- **Ingesta inteligente**: Bandeja extrae de boleta real el TOTAL correcto
  ($36.988, no el ítem) + comercio real (Líder, no la sucursal); y **lista de
  compras pegada/PDF → crea ítems en Compras** (ruta `shopping_list_to_items`).
- **Onboarding cálido** `/onboarding/[hid]` (4 pasos → invitar familia, `/join/[token]`).
- **Quick-add lenguaje natural** ("Diego fútbol mañana 17:00") — `lib/nlDate.ts`.
- Emoji por producto en Compras (Bring!).

---

## 3. Estado vs barrido competitivo (20 brechas)

Cerradas (✅): color por integrante, avatares, Domi-como-personaje + celebración,
export/portabilidad, tipografía, **ingesta foto/PDF (#4)**, **onboarding (#3)**,
**quick-add (#12)**, emoji compras (#7 parcial), skeletons.
Parciales (⚠️): confirmación humana salud (badge sí, escalada no), optimistic UI,
empty states, progreso/rachas, responsive (falta QA en dispositivos reales).
Pendientes (❌): **comentarios/reacciones (#11)**, **medicamentos por franja (#10)**,
**modo compra full-screen + pasillos (#8)**, visibilidad granular (#17),
recurrencias/recordatorios (#19), recap carga mental (#6).

**Progreso estimado: ~65-70%.** Diferenciadores grandes (ingesta + onboarding)
hechos. Falta profundidad de uso diario para "nivel titán" completo.

---

## 4. Qué es REAL vs PREVIEW (honestidad)

**Real (funciona local):** los módulos (Mural, Compras+Carro, Actividades, Salud,
Documentos, Presupuesto), avatares/estados, Domi narrador y copilot **por reglas**,
ingesta por reglas (boletas/listas), onboarding, quick-add, export JSON, scoping
por household, auditoría.

**Preview / no activo:**
- **IA conversacional plena (LLM)**: cableada pero **OFF** (requiere API key del
  owner; decisión: activar después del demo).
- **Login social**: scaffolding; requiere credenciales OAuth del proveedor.
- **3D de Domi**: revertido; hoy es CSS premium (no WebGL).
- **Push/SMS/email inbound, scheduler runtime, WhatsApp**: fuera de alcance.
- **OCR de fotos**: la ingesta lee PDF/texto; fotos quedan a revisión manual.
- **Deploy público**: pausado (Sprint C).
- **Reloj inteligente**: la web degrada a vista compacta; app nativa = roadmap.

---

## 5. Qué pedimos auditar a ChatGPT

1. **Arquitectura y seguridad**: scoping multi-tenant (household), `require_household_role`,
   manejo de secretos (¿algo filtrado?), el scaffolding OAuth (`auth_oauth.py`),
   el endpoint `/households/{id}/profile` y `/persons` (PATCH/status).
2. **Honestidad del producto**: ¿algún claim aspiracional sin respaldo? ¿la
   separación real/preview es clara para un cliente?
3. **Copilot por reglas** (`domi_rules.py`): cobertura, riesgos de respuestas
   engañosas, límites bien comunicados.
4. **Ingesta** (`smart_inbox.py`): robustez del parseo de boletas/listas; falsos
   positivos; confirmación humana.
5. **UX/diseño** vs líderes (Cozi/Maple/Skylight/Bring!/Medisafe): ¿qué falta
   para "titán"? Priorización de las brechas pendientes.
6. **Decisión 3D revertido**: ¿de acuerdo con CSS-now + Rive/Lottie-después, o
   vale la pena forzar WebGL?
7. **Riesgos**: privacidad (menores/salud/ubicación), datos reales en demo,
   dependencia del LLM, calidad de extracción.

---

## 6. Pendientes / próximos pasos sugeridos

1. Comentarios/reacciones por aviso (Mural) — mata el "lo hablamos por WhatsApp".
2. Medicamentos por franja del día + alerta de dosis no confirmada (Medisafe).
3. Modo compra full-screen + orden por pasillo.
4. Verificación visual del owner (Domi, responsive, chat, ingesta) — pendiente.
5. Cuando el owner lo decida: activar LLM (API key) y/o login social (credenciales).
6. Sprint C — deploy demo (SQLite+Disk Render + Vercel) para tener URL pública.

---

## 7. Tests

- `tests/test_u1_local.py`: 11/11 verdes (módulos U1 + scoping/403).
- 4 tests legacy (`test_chat`, `test_dashboard`, `test_dashboard_404`,
  `test_render_db`) fallan por llamadas de red externas (HTTP 503) — **pre-existentes**,
  no relacionados con esta jornada. Recomendación: marcarlos skip o aislarlos.

---

## 8. Reglas de seguridad vigentes

No imprimir/commitear secretos (DATABASE_URL, JWT_SECRET, OAuth client secrets,
API keys). OAuth secrets sólo en panel del proveedor. `APP_ENV=demo`. No tocar
deploy/Postgres/Neon en sprints locales. Si un secreto aparece en chat/log/commit
→ quemado, rotar.
