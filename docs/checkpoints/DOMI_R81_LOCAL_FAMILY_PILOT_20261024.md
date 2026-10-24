# DOMI R81 — Primer planificador familiar sin backend (ensayo local ficticio)
Fecha: 2026-10-24. Canon V2.1 + Addenda31/32. PR #2 draft.

## Objetivo y límite
Entrega visible de utilidad familiar SIN reactivar Render ni tocar Neon. Una ruta Preview separada /family-local-pilot permite experimentar con integrantes ficticios, horario de estudio, tareas y pruebas, lista de compras, recetas, faltantes y conflictos de horario. Los datos se guardan en localStorage del MISMO navegador, no persisten en servidor, no viajan a celular, no son memoria real, no usan LLM, no generan acciones externas. Está prohibido incluir PII o claves; no se presenta como beta familiar de producción.

## Implementación realizada
- apps/web/lib/domiLocalFamilyPilot.mjs: contrato sintético; parseo/saneamiento, cuotas, calendario local, conflicto determinista, ingredientes faltantes y acción explícita de confirmación.
- apps/web/app/family-local-pilot/FamilyLocalPilot.tsx: interfaz interactiva de integrantes/estudio/eventos/compras/recetas, guardado local y borrado.
- apps/web/app/family-local-pilot/page.tsx: sólo Preview de rama domi-neon-staging-pg-startup-gate-20261010; resto responde 404.
- apps/web/tests/domi-r81-local-family-pilot.test.mjs: tests de estructura y reglas, incorporados al workflow de Security Gate.
- HEAD R81 inicial: 7c09bb08e0b8b6da1be00c142773f49374afee21. Security Gate en progreso al registrar checkpoint. NO afirmar PASS, ni link operativo hasta GET validado.

## Bloqueo principal del producto auténtico
Render vantdomus-family-pilot suspendido por BILLING desde 2026-09-30, GET health Preview HTTP 503. No reactivado ni autorizado gasto. El CI previo R79/R80 #39965702757 fue SUCCESS y Next.js 16.4.2. El entorno de ensayo local R81 NO reemplaza la E2E real.

## Scorecard canónico obligatorio
D01 Personal 45→45 (0), D02 Familiar 45→45 (0), D03 Desarrollativo 25→25 (0), D04 Federado 45→45 (0), D05 Multisuperficie 45→45 (0), D06 Organizacional 10→10 (0), D07 DOMI–EDIS 10→10 (0), D08 Legado 10→10 (0), D09 Titan 25→25 (0), D10 MICR/Ciencia 25→25 (0). GLOBAL 28,5→28,5 (0). Se registra una utilidad nueva en ensayo local, pero no se acredita puerta E (integración completa) ni A (aceptación operativa) del D02.
Los 12 órganos siguen vigentes: Identity parcial; Constitución/Obligación parcial; Self/Metacognition parcial; Memory parcial; Relaciones parcial; Afectividad causal pendiente; Epistemic/Abstention parcial; Authority/Delegation parcial; Presence/Voice parcial; Recovery/Migration bounded; Multi-Surface bounded; Evidence/Audit parcial.

## Cápsula de rehidratación
R81_STATUS=LOCAL_FAMILY_PILOT_IMPLEMENTED_CI_PENDING
D02=45
GLOBAL=28.5
RENDER=REMAINS_SUSPENDED_BILLING
PRODUCTION=UNCHANGED
NEON=UNCHANGED
PREVIEW_ACCESS=VERIFY
CLAIMS=NO_REAL_MEMORY_NO_EXTERNAL_AI_NO_CROSS_DEVICE

## Exact Prompt Restart
Retoma DOMI R81 desde PR #2 branch domi-neon-staging-pg-startup-gate-20261010 y canon V2.1 Addenda31/32. Verifica CI del HEAD > 7c09bb08e0b8b6da1be00c142773f49374afee21 y Vercel Preview GET /family-local-pilot. Corrige fallos TS/build. Prueba añadir dos alias ficticios, dos eventos coincidentes, supermercado, receta, propuesta de ingredientes, confirmar, recargar y comprobar persistencia local. NO confundir con Family E2E real; backend continúa suspendido por Billing y no se autoriza gastar. Para beta real sigue siendo imprescindible login, servidor, base, recarga, teléfono. Mantener diez ejes y 12 órganos, proyectos MICR, EDIS, FCF, legado y Titan.
