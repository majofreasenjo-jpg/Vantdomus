# DOMI R69 — datos reales, hogar vacío, fidelidad canónica
Fecha 2026-10-20, PR #2 DRAFT.

## Verificación y hallazgo
Security Gate R68 run 39356118007 SUCCESS; job previo de workflow cancelado (no contar doble). Vercel producción family-pilot READY en branch cp1d-ops1-family-live commit f852543, distinto del PR #2. Configuración Vercel NEXT_PUBLIC_API_BASE existe en production y preview (se consultó sólo el nombre, sin descifrar el secreto): NO afirmar que está ausente o apunta a localhost. HTTP /login responde 200, pero sin credencial no es posible certificar recorrido autenticado. Vercel sin errores agrupados últimos 7 días, insuficiente para acreditar uso real. Render workspace visible My Workspace; NO hubo acción sobre servicios.

Hallazgo P0: apps/web/app/hogar/[householdId]/page.tsx usaba persons.length > 0 para clasificar dataState='real'. Una familia autenticada con 0 fichas de persona podía recibir dataState='demo' y 4 personas ficticias en DOMI; un éxito parcial con respuesta no válida también podía acabar en demo, ocultando error. No corresponde inventar familia por ausencia de miembros registrados.

## Corrección
- apps/web/lib/domiHouseholdDataState.mjs a9834308b211166454d5346a11c774bd1be271f9: función pura classifyHouseholdData que exige dashboard.persons y shopping.items como arreglos, cero errores, y acepta arreglos vacíos reales. Falla 401/403 => session; cualquier otra falla/formato inválido => api; nunca convierte fallo en demo.
- apps/web/app/hogar/[householdId]/page.tsx 0e226d5fa2566b638604a54eb3cb159e1921d994: usa nueva clasificación, no persons.length.
- apps/web/tests/domi-r69-household-truth.test.mjs 2b1e9765232a4cb83849457dd3b9d29dede5b46f: negativas de partial, auth, malformed y familia real vacía.
- workflow Security Gate R69 step 6e5bc38086eb1c8c0c8dfd62d26e45d3401eff65. CI R69 PENDIENTE; no declara PASS aún.

## Auditoría adicional NO RESUELTA
DomiCompanionHome mantiene botones de compras local-only incluso bajo dataState real: quick-add/toggle/delete no garantizan escritura persistente; no declarar e2e hasta sustituirlos por API autenticada y recarga. Otras tarjetas conservan textos de ejemplo/telemetría estática; se requiere product truth. La etapa debe seguir con browser→login→API→DB→acción→reload. No desplegar ni usar familias reales prematuramente.

## Scorecard obligatorio V2.1 Addenda31/32 (anterior→actual; pp)
D01 Personal 45→45 (0): R67 vínculo sintético aprobado; DB/persona pendiente.
D02 Familiar 45→45 (0): R69 clasificación corregida, CI pendiente; backend E2E real no verificado.
D03 Desarrollativo 25→25 (0): DSR/afecto causal no validado.
D04 Federado 45→45 (0): fabric software probado; multi-provider live pendiente.
D05 Multisuperficie 45→45 (0): P5 bounded; TV/auto pendiente.
D06 Organizacional 10→10 (0): modelo documental; precedentes ejecutables pendientes.
D07 DOMI–EDIS 10→10 (0): bridge contrato receptor pendiente.
D08 Legado 10→10 (0): consentimiento premortem y runtime pendientes.
D09 Titan 25→25 (0): dossier interno listo; bench/demo pendiente.
D10 MICR/Science 25→25 (0): método/experimentos acotados; sin conciencia demostrada.
GLOBAL 28.5→28.5 (0): ninguna puerta C/I/T/E/A nueva certificada.

## 12 órganos canon
Identity kernel parcial; Constitution/Obligation parcial; Self & Metacognition parcial; Memory kernel parcial; Relational model parcial; Affective runtime producto causal pendiente; Epistemic/abstention parcial; Authority/delegation parcial; Presence/voice no certificada; Recovery/migration ensayos bounded; Multi-surface adapters ensayos bounded; Evidence/audit parcial. R69 afecta a la capa de evidencia/representación del hogar, no supone nuevo órgano completado.

## Cápsula rehidratación
R69_STATUS=REAL_EMPTY_HOUSEHOLD_CLASSIFICATION_IMPLEMENTED_CI_UNVERIFIED
CANON=V2.1_ADD31_ADD32
GLOBAL=28.5
D02=45
REAL_E2E=NOT_VERIFIED
PROD_BRANCH=cp1d-ops1-family-live
PR2=DRAFT
NEON_WRITE=NONE
RENDER_ACTION=NONE
COST=NONE

## Exact Prompt Restart
Retoma VANTDOMUS DOMI desde R69 PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Verifica Security Gate R69 commit 6e5bc38086eb1c8c0c8dfd62d26e45d3401eff65 y logs. Corregir fallos sin permitir que familia real vacía se convierta en demo. Próximo cuello directo: los botones de despensa local-only en dataState real; conectar a rutas autenticadas existentes con confirmación y refresh, prueba contract/e2e. Mantener siempre 10 ejes y Global 28.5 hasta nueva puerta verificada, seguimiento 12 órganos, no producción/Neon/Render pagos ni datos familiares sin autorización.