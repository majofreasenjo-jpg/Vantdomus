# VantDomus — Rehydration Index

> Índice rápido para que cualquier chat nuevo o asistente nuevo se rehidrate sin
> perder contexto. Si el chat se corta, **empezá por acá**.

## Propósito

El chat es temporal y solo coordina. La continuidad del proyecto vive en GitHub,
Google Drive y los documentos canónicos. Este índice dice qué leer y en qué orden.

## Orden obligatorio de lectura (asistente nuevo)

1. `VANTDOMUS_REHIDRATACION_ULTIMO_CORTE` (Drive) — el estado más reciente.
2. `VANTDOMUS_CANONICO_PROYECTO_v1` (Drive).
3. `VANTDOMUS_MANUAL_PROYECTO_TECNICO_v1` (Drive).
4. `VANTDOMUS_MANUAL_USO_v1` (Drive).
5. `docs/PROJECT_RULES.md` (repo).
6. `docs/VANTGUIDE_ARCHITECTURE.md` (repo).
7. `docs/DEPLOY_DEMO_RUNBOOK.md` (repo).
8. `docs/INFORME_AVANCE_FAMILIA_VG.md` (repo).
9. `docs/COMPETITIVE_UX_AUDIT_2026.md` (repo, si existe).
10. `docs/PITCH_DEMO_SCRIPT.md` (repo, si existe).

Equivalentes canónicos en el repo (si no hay acceso a Drive):
`docs/VANTDOMUS_CANONICO_PROYECTO.md`, `docs/VANTDOMUS_MANUAL_PROYECTO_TECNICO.md`,
`docs/VANTDOMUS_MANUAL_USO.md`.

## Links Drive

- Carpeta canónica: `https://drive.google.com/drive/folders/1N-zSfErK7P57cGrKyX5lEy4rgSn1WPzd`
- Canónico proyecto: `https://docs.google.com/document/d/1C1AaM86MLCLkzC-h0VqQcwXuUictomNPtKY9SF2HrH8/edit`
- Rehidratación último corte: `https://docs.google.com/document/d/19__lWxvxNaBKJ83SelviG2m6B_ILk7hm7q_vUed3wJU/edit`
- Manual de uso: `https://docs.google.com/document/d/1IrBqm_qPuzZDjSrbRJmED9IlNb-JsabmcmJBSR-wQVo/edit`
- Manual técnico: `https://docs.google.com/document/d/18Rw3oyCuHdhrS52ctouL6MWazNZL-RTM6KjJtfRPmQA/edit`

## Estado actual del proyecto (al cierre de este corte)

- Producto: **VantDomus Hogar** (modo familia del motor VantGuide). B2B por preset.
- Repo `majofreasenjo-jpg/Vantdomus`, branch `main`.
- **VG+2.1** (limpieza familiar visible) ✅ aprobado.
- **VG+2.2** (Bandeja Inteligente v1) ✅ aprobado.
- Smoke de visibilidad por rol (local) ✅ aprobado.
- **AssistantOrb "Domi"** (CSS) integrado en Guía y Bandeja.
- **Auditoría externa (ChatGPT) respondió las 8 preguntas** → decisiones
  consolidadas en runbook + informe.
- **Sprint U1-LOCAL completo** (commit `724af80`): Panel del Hogar
  `/hogar/[hid]`, Domi narrador server-side, 3 módulos nuevos (Avisos /
  Compras + Carro Tentativo / Actividades del Día), seed v2 con Familia Demo
  VantDomus (Camila/Pedro/Diego/Sofía/Elena, sin duplicados). Ver
  `docs/DEMO_LOCAL_VANTDOMUS_HOGAR.md`.
- Tests: **63/63 verdes** (52 previos + 11 nuevos U1).
- **Pendiente activo (cuando Manuel apruebe la pasada local):** retomar
  **Sprint C — Deploy demo unificado** (SQLite + Disk en Render + Vercel
  **nuevo limpio** `vantdomus-hogar-demo`). Modo guía asistida; gate de
  entrega = smoke 21 puntos en deployado.

## Commits importantes

- `d309487` baseline de seguridad (tag `baseline-secure-2026-05`).
- `2a88144` Sprint familia.
- `1832615` Sprint VG (núcleo VantGuide).
- `3d3c618` Sprint VG+1 (versionado, scheduler lock, AI gating, multi-responsables).
- `f0c12b1` VG+2.1 limpieza familiar visible.
- `c5ff09e` VG+2.2 Bandeja Inteligente v1.
- `22766a2` informe de avance actualizado.
- `9bf1ef2` runbook de deploy corregido por seguridad de secretos.

## Sprints completados

VG núcleo · VG+1 consolidación · VG+2 UI (Guía/Biblioteca/Evolución) ·
VG+2.1 limpieza familiar · VG+2.2 Bandeja Inteligente v1 + smoke de visibilidad.

## Próximo paso activo

**Sprint C — Deploy demo unificado**: Render (SQLite + Disk `/data`) + Vercel
nuevo limpio (`vantdomus-hogar-demo`). Ver `docs/DEPLOY_DEMO_RUNBOOK.md`. Gate
de entrega de URL pública = smoke 21 puntos en ambiente desplegado.

**Después de Sprint C**: VG+2.3 — Panel del Hogar / VantHome Coordination v1,
en fases (Muro Familiar + Compras → Actividades → Check-in voluntario).
Sprint D (runtime real: scheduler, push, email inbound) queda diferido.

## Reglas de seguridad (resumen)

- No imprimir/commitear/documentar valores de secretos. Si aparecen, se queman y rotan.
- No pedir `DATABASE_URL`/`JWT_SECRET` por chat. Se cargan directo en el proveedor.
- `APP_ENV=demo` para la demo (no producción). AI features off.

## Qué hacer si el chat se corta

1. Abrir este índice. 2. Leer la cápsula de rehidratación en Drive. 3. Confirmar
estado con `git log` y `docs/INFORME_AVANCE_FAMILIA_VG.md`. 4. Retomar el "próximo
paso activo". 5. No re-hacer lo ya aprobado.

## Qué actualizar al cerrar un sprint

Commit + tests verdes + informe + docs afectados + cápsula de rehidratación en
Drive + estado de pendientes + riesgos + DoD + next step (ver `docs/PROJECT_RULES.md`).

## Qué NO hacer

No deploy fuera de sprint · no crear servicios sin permiso · no pedir/imprimir
secretos · no usar deploy viejo ni secretos quemados · no reabrir arquitectura
VantGuide · no agregar features fuera de alcance · no inflar marketing · no IP de
terceros · no activar IA plena/OCR de fotos si están fuera de alcance.

---

## CP1b Google Visual Port — companion-first Domi (2026-07-02)

Branch `u1-cp1b-google-visual-port`. Fuente: `vantdomus-hogar (6).zip` (Google
AI Studio, aprobado visualmente por el owner). Port en
`apps/web/app/components/domi/` — ver `DEMO_LOCAL_VANTDOMUS_HOGAR.md` (sección
CP1b) para URLs de prueba (`?theme=`, `?domiState=`, `?dev=1`) y real-vs-demo.
Regla vigente: no rediseñar; Domi propone, una persona confirma lo sensible.

**Estado (2026-07-03):** ChatGPT aprobó la base visual **condicionada**; drift de
grises corregido (preflight scoped a `#vantdomus-app` + utilidades sin capa,
commit `2cb92af`). **Referencia Google AI Studio = CONGELADA.** Siguiente fase:
integración funcional mínima sobre esta vista, sin rediseño. Domi Lab (temas/
estados/disfraces) es solo QA tras `?dev=1`, no feature de usuario.
