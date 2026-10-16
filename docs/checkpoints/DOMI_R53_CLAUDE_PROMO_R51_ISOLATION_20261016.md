# DOMI R53 — Claude promotional pilot + R51 CI isolation
2026-10-16 · PR #2 draft · append-only

## User decision
Approved using USD 100 Anthropic promotional credit (screenshot of billing 2026-10-16, expiry 2026-11-13). Approval covers controlled synthetic evaluation. It does NOT constitute an API key, prepaid billing guarantee, permission for purchased credits, deployment, use of real family memories or unrestricted external calls.

## Implemented
- tools/domi_anthropic_promo_smoke.py from R52, one synthetic Anthropic API call *only* when local flag and private API key are supplied. Default dry run, no token consumption. Fixed Claude Haiku 4.5 model, strict JSON, no automatic retry.
- R52 no-network negative and positive synthetic tests added as an enforced CI step in new isolated PostgreSQL candidate job (commit 9a4cfd5fc1a08f045d76e8870084d1ae5ac359dc).
- Previous CI #267 FAILED solely in postgres-rls-pilot due to R51 preflight: domi_auth namespace or roles already present from R8 fixture. Backend/web/mobile SUCCESS, staging-smoke SKIPPED.
- Security policy preserved: moved R51 tests to separate disposable PostgreSQL service/job, first provisioning clean R31 full 57-table schema; no weakening of R50 preflight (commit 435adc7d25ec10d9b0df7fe363f02a079c2306da).
- Latest CI pending; exact pass/fail must be checked after new commit.

## Evidence requirements
- Before any real API request verify key and promo eligibility privately in Anthropic Console; avoid automating billing or using intermediary gateway.
- Use dummy household; one call per explicit flag invocation; verify input/output tokens; do not spend beyond promo budget. No API calls made in this turn.
- Diagnose any remaining actual SQL failures in isolated CI.
- Real owner memory requires auth/RLS, PC-phone test and explicit external memory consent; remains OFF.

## Cápsula de rehidratación
DOMI_R53=CLAUDE_PROMO_SAFE_CI_ISOLATED_UNVERIFIED
CLAUDE_PROMO_USD=100_USER_SCREENSHOT
CLAUDE_PROMO_EXPIRY=2026-11-13
CLAUDE_REAL_CALLS_THIS_TURN=0
R51_ISSUE=PREEXISTING_AUTH_FIXTURE
R51_FIX=ISOLATED_POSTGRES_SERVICE_JOB
R53_CI_SHA=9a4cfd5fc1a08f045d76e8870084d1ae5ac359dc
NEON_WRITES=0
RAILWAY_DEPLOYS=0
PR=2_DRAFT
BETA_PERSONAL=BLOCKED

## Exact Prompt Restart
Retoma DOMI desde R53, GitHub majofreasenjo-jpg/Vantdomus PR #2 draft, rama domi-neon-staging-pg-startup-gate-20261010. Verifica CI del commit 9a4cfd5fc1a08f045d76e8870084d1ae5ac359dc y depura específicamente postgres-real-auth-candidate, sin debilitar permisos. Continúa piloto Anthropic promocional R52/R53 con datos ficticios, OFF por defecto, Claude Haiku, sin exposición de secretos; cuando el usuario configure la clave en privado y verifique que sus USD 100 de crédito se aplican, permitir como máximo una llamada controlada y reportar consumo real en tokens y no confundir crédito promocional con gastos Vercel. No cambiar producción, Neon, Render, Railway, no hacer compras, no ejecutar acciones del hogar ni acceder a recuerdos reales. Mantener bitácora, cápsula y restart.
