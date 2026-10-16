# DOMI R54 — Private Anthropic key readiness; R53 CI certified; Render billing suspension

2026-10-16 · PR #2 draft · append-only.

## Confirmed new facts
- The user confirms successful Anthropic key creation for DOMI-ANTHROPIC-TEST, selected default workspace, and privately saved it; neither value nor key prefix has been obtained, seen or stored in this project by this assistant.
- R53 Security Gate #269 / run 38943129079 = SUCCESS. Jobs backend, web, mobile, postgres-rls-pilot, postgres-real-auth-candidate all SUCCESS; staging-smoke SKIPPED. This validates isolated synthetic checks, not a live family backend.
- Render workspace My Workspace read-only inspection: Vantdomus family-pilot, Vantdomus and vantdomus-backend are SUSPENDED with suspender billing as of last Render status; automatic deployment is disabled for family-pilot; cannot claim usable backend today. No Render actions or payments.
- Promo screenshot (user-provided): USD 100 credit available, expiring 2026-11-13. No API call or spend in this assistant session. Using an API key is not itself proof of confirmed credit routing.
- Anthropic official documentation confirms /v1/messages API format, JSON structured outputs via output_config.format, Haiku 4.5 support, price of USD 1 / 1M input tokens and USD 5 / 1M output tokens. No credentials committed.
- R52 one-shot fixed-fictitious harness exists at tools/domi_anthropic_promo_smoke.py, off by default. Only operate it with private key, local runtime and explicit one-shot toggle; do not use personal family memory.

## Next practical actions
1. Run one fictitious no-side-effects Playground / private local test with Claude Haiku 4.5, after confirming credits and no auto-recharge; do not share any secret or screenshots containing it.
2. Report token counts and check the promotional balance. Claude provider integration will be developed behind flags with no production deployment and with privacy/access controls.
3. Do not set Anthropic key in public frontend/Vercel NEXT_PUBLIC variables. Render backend is suspended by billing; reactivation requires separately approved costs.
4. Keep PR draft and protect Neon, owner memory; no production change and no actual RLS migration in Neon.

## Cápsula de rehidratación
DOMI_R54=ANTHROPIC_KEY_USER_CREATED_PRIVATE
KEY_VALUE_IN_ASSISTANT=NONE
R53_GATE_269=SUCCESS
RENDER_FAMILY_PILOT=SUSPENDED_BILLING
RENDER_BACKEND=SUSPENDED_BILLING
PROMO_CREDIT_USER_SCREENSHOT=USD_100_EXPIRES_2026-11-13
CLAUDE_API_CALLS_BY_ASSISTANT=0
PR_2=DRAFT
NEON_WRITES=NONE
PRODUCTION_CHANGES=NONE
OWNER_BETA=BLOCKED

## Exact Prompt Restart
Retoma DOMI desde R54 en GitHub majofreasenjo-jpg/Vantdomus PR #2 draft rama domi-neon-staging-pg-startup-gate-20261010. La clave DOMI-ANTHROPIC-TEST fue creada y guardada de manera privada por el usuario, nunca compartirla ni extraerla. CI R53 Security Gate #269 completado SUCCESS; la ejecución staging-smoke quedó SKIPPED. Render indicó servicios familiares/backend suspendidos por billing; no desplegar ni incurrir gastos sin aprobación. Utilizar crédito Anthropic promocional USD 100 hasta 2026-11-13 únicamente para una primera prueba Haiku 4.5 con datos ficticios mediante Playground o arnés privado de una llamada, midiendo tokens y confirmando que la operación se deduce del crédito. Después integrar el proveedor bajo puertas fail-closed, sin activar producción ni memorias privadas. Mantener bitácoras append-only, nueva cápsula y Exact Prompt Restart.
