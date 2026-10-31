# DOMI R70 — compras reales con fuente de verdad de servidor
Fecha: 2026-10-20. PR #2 DRAFT.

## Certificación previa
R69 Security Gate run 39364663581 SUCCESS. R68 scorecard de diez ejes aprobado. Ninguna de estas pruebas acredita Family E2E de producción.

## Implementación R70
- apps/web/lib/domiShoppingProjection.ts commit 023bbe9b66868a34c6701adaf792b26b2977a3e7: proyección única desde household_shopping_items; estados backend purchased/cancelled; rechazo de respuesta mal formada.
- apps/web/app/components/domi/DomiCompanionHome.tsx commit d72d854f59f17c2acf0569f4685576b4637694f7, hotfix a7e01581b7b01954c2d34deb68f9359832590b05: Quick Add, mark purchased y cancel de la vista real invocan API autenticada existente. Luego GET shoppingList y refresco desde resultado real. Preview demo mantiene solo arreglo local identificado como tal; fallo de sesión/API bloquea mutaciones; concurrent actions se evitan mediante shoppingBusyRef. Tras confirmación humana de propose_shopping_item se dejó de inventar IDs locales: se relee servidor.
- apps/web/tests/domi-r70-real-shopping-contract.test.mjs commit 6eaa72b0db770906092e920243f83aac073ec85e: prueba de regresión de API, segregación demo y estado canónico.
- CI step R70 commit 91c3c280fb6c1de0015c34fef03702409d0da90c.
- R70 CI NO VERIFICADO al corte; no declarar PASS hasta que GitHub Actions confirme, tampoco desplegado en producción.

## Límites importantes
1. Los botones directos de despensa ejecutan acciones del usuario sin autorización conversacional adicional; la propuesta del chat sigue requiriendo confirmación. Cancel no equivale a borrar físicamente, y los registros comprados permanecen como historial.
2. Fallos después de write pueden tener resultado incierto; UI obliga consultar estado antes de reintentar. No afirmar “nada guardado” sin evidencia.
3. Se requiere todavía navegador autenticado→backend→DB→recarga→segundo dispositivo sobre un hogar de ensayo; sin autorización no se probó.
4. Backend real de producción y Neon permanecen sin cambios; también Render y Anthropic.
5. Los modos y secciones médicas/estudio deben seguir auditándose para evitar telemetría ficticia en hogar real.

## Tablero V2.1 + Addenda31/32, anterior→actual→delta
D01 Personal 45→45 (0), identidad individual server auth/persist pendiente.
D02 Familiar 45→45 (0), R70 API UI implementada sin CI/E2E completo.
D03 Desarrollativo 25→25 (0), afecto causal integrado pendiente.
D04 Federado 45→45 (0), multi-proveedor live pendiente.
D05 Multisuperficie 45→45 (0), TV/auto e integración completa pendiente.
D06 Organizacional 10→10 (0), precedentes autorizados pendientes.
D07 DOMI–EDIS 10→10 (0), contrato ejecutable pendiente.
D08 Legado 10→10 (0), voluntad/revocación/custodios pendientes.
D09 Titan 25→25 (0), bench/demos pendientes.
D10 MICR/ciencia 25→25 (0), validación independiente y no conciencia pendiente.
GLOBAL 28.5→28.5 (0): no acreditar E hasta browser+DB+persistencia+autorización/segregación.

## Doce órganos
Identity parcial; Constitution/Obligation parcial; Self/Metacognition parcial; Memory parcial; Relational parcial; Affective runtime causal pendiente; Epistemic/Abstention parcial; Authority/Delegation parcial; Presence/Voice bounded; Recovery/Migration bounded; Multi-surface bounded; Evidence/Audit parcial. R70 solo toca representación y ejecución de tareas, no prueba DSR.

## Cápsula
R70_STATUS=SHOPPING_API_UI_COMMITTED_CI_UNVERIFIED
R69_CI=SUCCESS_39364663581
R70_CI_SHA=91c3c280fb6c1de0015c34fef03702409d0da90c
CANON=V2.1_ADD31_ADD32
GLOBAL=28.5
D02=45
PR2=DRAFT
NEON_WRITES=NONE
PRODUCTION_DEPLOY=NONE

## Exact Prompt Restart
Retoma DOMI R70 PR #2 draft branch domi-neon-staging-pg-startup-gate-20261010. Verifica CI al menos sobre workflow commit 91c3c280fb6c1de0015c34fef03702409d0da90c; si TypeScript/test falla, corregir sin bajar seguridad. R70 reemplazó Quick Add/mark/cancel local por API autenticada con GET posterior y chat proposal por lectura real. Próximo paso E2E en hogar ficticio autorizado y dos dispositivos; todavía no afirmar Family beta operativa. En todo avance informar DIEZ ejes canónicos con % anterior/actual/Δ y 12 órganos. No tocar Neon/Render/producción ni gastar sin autorización.
