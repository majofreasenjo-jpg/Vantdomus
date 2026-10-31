# DOMI R71 — lectura canónica en recarga y ausencia de datos ficticios en sesión vencida
Fecha: 2026-10-20. PR #2 borrador, sin merge ni producción.

## Evidencia
Security Gate R70 #338 (run 39446740361) SUCCESS: backend, web, mobile, 3 PostgreSQL jobs; staging-smoke SKIPPED. R70 contrato web y Typecheck PASS.

## Auditoría
Hogar/[householdId]/page.tsx mantenía su proyección propia para shopping (place_hint/category), distinta de R70 domiShoppingProjection que se ejecuta después de confirmar. Esto podía cambiar agrupación y conteos visuales al refrescar. Además, DomiCompanionHome seguía sembrando datos familiares ficticios ante dataState=session o api (aunque marcados como tal); la decisión rectora exige fail-closed sin crear identidades simuladas durante fallos reales.

## Cambios
- app/hogar/[householdId]/page.tsx commit 7a94fe8db938c129c307d19fcb0994dc1812ad35: clasificar respuestas antes de mapear y solo preparar family/shopping si dataState=real, usar misma proyección canónica de compras R70 en SSR.
- DomiCompanionHome.tsx commit 4bb15ee56fc43dd002379e78f4072579485fa308: seed de arrays de ejemplo SOLO en dataState='demo', no ante session/api.
- apps/web/tests/domi-r71-hydration-truth.test.mjs commit fdce6b44c3a590e4a9fd55c261746962f30e214c: contratos de proyección SSR/CSR idéntica y ausencia de fixtures cuando falla sesión/API.
- CI step commit 1c3e34e448068ad28eb47774813851adbe344eed; CI R71 todavía NO certificado al crear esta cápsula.

## Bloqueo terminal
El paso navegador→autenticación→backend→BD→confirmación→recarga→segundo dispositivo sigue NO VERIFICADO en despliegue real. Auth de producción y disponibilidad de servicio no se demuestran con build ni request anónima. No crear credenciales/hogares reales, no reactivar backend facturable ni modificar Neon sin autorización. Los tests HTTP SQLite con dos sesiones pueden reforzarse en CI, pero NO sustituyen prueba física del usuario.

## Tablero Addendum 32 (anterior → actual, delta)
D01 Personal 45→45, 0; D02 Familiar 45→45, 0; D03 Desarrollativo 25→25, 0; D04 Federado 45→45, 0; D05 Multisuperficie 45→45, 0; D06 Organizacional 10→10, 0; D07 DOMI–EDIS 10→10, 0; D08 Legado 10→10, 0; D09 Titan 25→25, 0; D10 MICR/Ciencia 25→25, 0. GLOBAL 28.5→28.5, 0. Ninguna puerta terminal E/A adicional aceptada.

## Doce órganos
Identity parcial; Constitution/Obligation parcial; Self/Metacognition parcial; Memory parcial; Relational parcial; Affective causal pendiente; Epistemic/Abstention parcial; Authority/Delegation parcial; Presence/Voice parcial; Recovery/Migration limitado; Multi-Surface limitado; Evidence/Audit parcial.

## Cápsula y restart
R71=RELOAD_TRUTH_IMPL_CI_PENDING; PREV_R70_GATE=SUCCESS_39446740361; FAMILY_LIVE_E2E=NOT_VERIFIED; PR2=DRAFT; CANON=V2.1_ADD31_ADD32; GLOBAL=28.5; NO_PRODUCTION_MUTATION=TRUE.
EXACT PROMPT RESTART: Continuar DOMI PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Verificar Security Gate commit 1c3e34e448068ad28eb47774813851adbe344eed (o último checkpoint) en especial R71 web, typecheck y build. Resolver cualquier fallo. Próximo ensayo es dos hogares ficticios y sesiones autenticadas independientes en SQLite desechable: chat propose → confirm → GET y nueva sesión → cancelar → GET → prohibición hogar ajeno; cotejar datos iniciales SSR vs cliente. Luego verificación física desde navegador y móvil con usuario autorizado antes de elevar D02. No despliegues, migraciones, gastos ni datos privados sin consentimiento. Siempre reportar diez ejes con porcentajes y doce órganos.
