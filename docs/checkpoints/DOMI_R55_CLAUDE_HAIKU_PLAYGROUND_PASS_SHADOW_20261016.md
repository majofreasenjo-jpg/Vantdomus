# DOMI R55 — Claude Haiku Playground PASS + shadow adapter isolation
Fecha: 2026-10-16 · PR #2 draft · bitácora append-only

## Evidencia real aportada
Usuario ejecutó una petición en Anthropic Claude Console Playground, modelo claude-haiku-4-5-20251001. La respuesta distinguió lista de compras y reunión al día siguiente a las 19:00, pidió confirmación y no afirmó haber guardado ni ejecutado. Evaluación cualitativa puntual PASS de conversación y consentimiento. No es prueba de API propia, persistencia de base de datos, RLS, calendario real ni móvil. El crédito promocional previo fue de USD 100 hasta 13/11/2026, pero saldo posterior/consumo exacto no se ha comprobado. Usuario guardó clave API en privado sin compartirla.

## Implementación R55
- Nuevo apps/api/app/assistant/providers/anthropic_shadow.py (commit 8a688e115c34f97030add6cdfa756e899a94687b): Claude Haiku 4.5 con contrato propose-only, JSON estructurado, función de parsing estricta, sin ejecución y sin persistencia. Servicio externo OFF por defecto; solo APP_ENV=local y flags múltiples, clave privada; fixture absolutamente sintético fijo. Rechaza mensajes arbitrarios, memorias reales, IDs reales, documentos, roles y herramientas fuera del contrato. Nunca se enruta desde el chat familiar normal.
- Nuevo tests/security/test_domi_anthropic_shadow.py (commit a39864969a7b880e5392287171ec4b3c9b3171e6): sin red, verifica flags, fixture, salida válida, rechazo de acciones no permitidas, ausencia de ejecución, aislamiento de producción.
- CI step incorporado al job postgres-real-auth-candidate (commit 015aae3efaf1c240a7f529b3034563ab6c604506) para exigir los tests R55.
- Último R53 Gate #269 anterior PASS; R55 CI pendiente de resultado: NO declarar certificado antes de verificar los logs.

## Límite y tareas
- No se utilizó clave Anthropic en ningún conector, no se generó gasto por parte de ChatGPT. Playground fue utilizado manualmente por el usuario.
- Neon no modificado, Render backend suspendido por billing, no despliegue Vercel/Railway, PR no fusionado.
- Tras aprobar R55 en CI, auditar diseño del gateway shadow para conservar exclusivamente fixture ficticio y aprobar una llamada API real controlada en entorno local del usuario, solo si se confirma gasto promocional; luego estudiar provider real con consentimiento granular independiente y backend seguro, nunca usar memoria privada hasta asegurar RLS/ACL.

## Cápsula de Rehidratación
DOMI_R55=ANTHROPIC_SYNTHETIC_SHADOW_ADAPTER_COMMITTED_CI_UNVERIFIED
HAIKU_PLAYGROUND_USER_MANUAL=PASS_CONVERSATIONAL_ONLY
ANTHROPIC_API_KEY_PRIVATE=USER_ONLY
ANTHROPIC_CALLS_BY_CHATGPT=0
R53_GATE_269=SUCCESS
R55_LAST_CI_COMMIT=015aae3efaf1c240a7f529b3034563ab6c604506
NEON_WRITES=NONE
RENDER_FAMILY_BACKEND=SUSPENDED_BILLING_LAST_CHECKED
PR_2=DRAFT
OWNER_BETA_REAL=BLOCKED

## Exact Prompt Restart
Retoma DOMI VantDomus R55 en GitHub PR #2 borrador, rama domi-neon-staging-pg-startup-gate-20261010, revisa Security Gate del commit 015aae3efaf1c240a7f529b3034563ab6c604506 y logs; corrige directamente fallos de tests/security/test_domi_anthropic_shadow.py sin habilitar el proveedor en chat familiar. Cliente Claude Haiku de sombra aislado solo datos ficticios en apps/api/app/assistant/providers/anthropic_shadow.py; se comprobó a mano Playground Claude Haiku que propone compras y recordatorio pidiendo confirmación, pero esto no prueba persistencia ni autorización end-to-end. Credencial privada del usuario jamás se pega en chat. Crédito Anthropic USD 100 vence 13/11/2026 (último balance no verificado). No gastar fuera del crédito, no Neon, no Railway/Render pagos, no despliegues, ni producción. Continuar con bitácora append-only, nueva cápsula y exact prompt restart.
