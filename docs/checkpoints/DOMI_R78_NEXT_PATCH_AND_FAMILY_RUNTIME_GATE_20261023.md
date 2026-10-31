# DOMI R78 — Parche Next.js y bloqueo Family Render
Fecha 2026-10-23. Canon V2.1 Addenda 31/32; PR #2 DRAFT.

## Evidencia primaria
- Render My Workspace confirmado por Owner. Servicio familiar srv-d9e38trbc2fs73f5ct50 = SUSPENDED, causa BILLING desde 2026-09-30, plan Starter, autoDeploy=no, branch cp1d-ops1-family-live. No se reactivaron servicios.
- Vercel Preview check /api/domi-family-backend-check => upstream HTTP 503, login real sin probar.
- GitHub Security Gate R76 39852134639 falló en auditoría Next 16.4.0 (vulnerabilidades críticas conocidas).
- Candidato npm y audit generado en GitHub Actions run 39956895035 = SUCCESS. Actualización exacta Next 16.4.2; el npm audit de high/critical pasó durante regeneración.
- package.json commit 3258a6584e8f866dc2ced4aa3db698209210ec7e; package-lock.json commit d4ad5083f1dd7778595a01a927ffb04fb652c6d9.
- El lock tuvo seis nuevas entradas opcionales wasm/transitivas. Las versiones de los paquetes no-Next no cambiaron.
- Gate completo de CI R78 run 39957134227 iniciado: el resultado debe verificarse antes de declarar PASS.
- Sin producción, migraciones Neon, reactivación Render ni gastos.

## Dos gates de salida
1. Seguridad: aprobar npm ci, audit high/critical, TypeScript, build y suites de regresión con parche 16.4.2.
2. Operación: resolver suspensión Billing con consentimiento explícito de Owner; comprobar health y login sintético, propuesta de compra, confirmación, lectura persistente, recarga y segundo dispositivo. No levantar los tres servicios antiguos.

## Tablero canónico: anterior -> actual, delta
D01 Personal 45 -> 45 (0), almacenamiento auth por persona pendiente.
D02 Family 45 -> 45 (0), backend suspendido, E2E pendiente.
D03 Desarrollo 25 -> 25 (0), afectividad causal pendiente.
D04 Federado 45 -> 45 (0), proveedor/agent live pendiente.
D05 Multisuperficie 45 -> 45 (0), TV/auto pendiente.
D06 Organizacional 10 -> 10 (0), memoria institucional pendiente.
D07 EDIS 10 -> 10 (0), bridge pendiente.
D08 Legado 10 -> 10 (0), programa de custodia pendiente.
D09 Titan 25 -> 25 (0), benchmark OEM pendiente.
D10 MICR/Ciencia 25 -> 25 (0), R3 acotado, no conciencia probada.
GLOBAL = 28.5 -> 28.5, delta 0. Ponderación de puertas C10, I15, T20, E25, A30.

## Doce órganos
Identity parcial; Constitution/Obligation parcial; Self/Metacognition parcial; Memory parcial; Relational parcial; Affective causal pendiente; Epistemic/Abstention parcial; Authority/Delegation parcial; Presence/Voice parcial; Recovery/Migration acotado; Multi-Surface Adapter acotado; Evidence/Audit parcial.

## Cápsula y Exact Prompt Restart
R78_NEXT_PATCH=16.4.2; CANDIDATE_AUDIT_PASS=39956895035; FULL_CI_VERIFY=39957134227; RENDER_FAMILY_SUSPENDED_BILLING=TRUE; OWNER_BILLING_APPROVAL=FALSE; GLOBAL=28.5; PRODUCTION_CHANGED=FALSE.
RETOMA: DOMI PR#2 rama domi-neon-staging-pg-startup-gate-20261010. Verifica CI del parche Next.js (SHA d4ad5083... y checkpoint posterior). El backend familiar srv-d9e38trbc2fs73f5ct50 sigue suspendido por facturación; no activarlo ni incurrir gastos sin consentimiento. Tras reparación de CI, preparar plan de activación del servicio único y E2E de familia, sin datos familiares reales. Mantener diez ejes, 12 órganos y canon integral.
