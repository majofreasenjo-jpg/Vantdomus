# DOMI R52 — Uso seguro de crédito Anthropic, checkpoint append-only
Fecha: 2026-10-16.

## Evidencia externa entregada por usuario
Captura Claude Console Billing: crédito PROMOCIONAL disponible USD 100, concedido 2026-10-16 y vence 2026-11-13 UTC. El crédito comprado es USD 0. Esto NO demuestra que exista una clave API configurada ni que el crédito cubra otras plataformas intermediarias, y no autoriza recargas o compras.

## Implementación
- tools/domi_anthropic_promo_smoke.py: interfaz Anthropic /v1/messages con x-api-key, versionada, payload ficticio fijo, salida JSON estructurada, sin escritura, sin memoria, una petición como máximo y sin reintentos.
- Inactivo por defecto; exige APP_ENV=local, ANTHROPIC_API_KEY local y DOMI_ANTHROPIC_PROMO_ONE_SHOT=1; expiración comprobada 2026-11-13 UTC.
- El script NO ofrece presupuesto acumulado ni detecta saldo real: usar por ahora UNA sola prueba tras confirmar el coste y controles de facturación desde la consola. Ningún crédito consumido desde ChatGPT.
- tests/security/test_domi_anthropic_promo_smoke.py: pruebas sin red de bloqueo, expiración, payload sintético y salida fail-closed.
- commits 2abeedf65c933b3ac32f4f75ee553b76f121b391, ac7b0e2d7bd8ea7c5add10a4dde506c91b8c1a70 y b8455f9df7747394560f69c4475e0294032f0d47.
- No sustituye OpenAIProvider ni habilita family-live; tampoco altera Vercel, Render, Neon, Railway, ni secretos.

## Riesgos activos
- El modelo exacto habilitado, tarifas y condiciones promocionales deben comprobarse con la cuenta Anthropic al activar. El script usa un único ID versionado, configurable por revisión del código.
- Falta CI R52 tras el commit último; no declarar PASS anticipadamente.
- El gate R51 #263 anterior FALLÓ debido a que el fixture reutiliza domi_auth creado en la suite piloto R8; arreglar aislamiento de base de datos, no rebajar preflight.
- No compartir claves API por chat ni en GitHub. Solo en gestor secreto o entorno local privado.

## Cápsula de Rehidratación
DOMI_R52=ANTHROPIC_PROMO_SYNTHETIC_ONE_SHOT_CODE_READY_UNVERIFIED
PROMOTIONAL_CREDIT_USD=100
PROMOTIONAL_EXPIRY_UTC=2026-11-13
SPEND=0_FROM_THIS_SESSION
EXTERNAL_ANTHROPIC_CALLS=0
KEY_STATUS=NOT_CONFIGURED_BY_ASSISTANT
REAL_MEMORY=BLOCKED
R51_CI=FAIL_PREEXISTING_SCHEMA_FIXTURE
PR_2=DRAFT

## Exact Prompt Restart
Retoma DOMI desde checkpoint R52 de Anthropic en GitHub PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Comprueba CI después de commit b8455f9df7747394560f69c4475e0294032f0d47. El usuario dispone de crédito promocional Anthropic USD 100 hasta 2026-11-13, pero no ha habilitado clave; solo se preparó herramientas/domi_anthropic_promo_smoke.py sin red real y tests sintéticos. Verifica modelo/precios y condiciones antes de primera llamada aprobada, evita secretos en chat, despliegues, recargas y gastos fuera de crédito. Corrige aparte CI R51: fallo de preflight por domi_auth preexistente de piloto R8; aislar fixture desechable, sin quitar barrera. Mantener bitácoras append-only; no tocar Neon, Render o Railway, ni datos personales.
