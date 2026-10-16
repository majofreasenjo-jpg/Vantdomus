# DOMI R57 — CLI local Claude, checkpoint append-only

Fecha: 2026-10-16.

## Evidencia
- R56 Security Gate #278 SUCCESS, run 38950649847. Backend/web/mobile, postgres-rls-pilot y postgres-real-auth-candidate SUCCESS. Staging-smoke SKIPPED.
- PR #2 draft sin merge.
- Prueba manual Haiku 4.5 en Playground: respuesta correcta que solicitó confirmación y no fingió guardar. No certifica integración API.

## Cambios
- tools/domi_claude_shadow_once.py (commit 6cea672787316e85e0ee551ced4eb898376d7bdb): CLI local, DRY_RUN predeterminado, --execute requiere confirmación textual e ingreso privado y oculto de clave API, sin guardar secreto; usa fixture sintético fijo y puente R56; marca local de un intento previo a la llamada, sin reintentos.
- tests/security/test_domi_claude_shadow_once.py, commit 5962a6bc2e6aac9425d554815c2a885b732d98bb: casos dry-run, vencimiento, confirmación, conservación de confidencialidad y bloqueo de segundo intento, transporte simulado sin red.
- GitHub workflow incluye paso de pruebas R57 con PYTHONPATH=apps/api, commit cc9a36f2691d6f092b6e687585e61cc1bd3e8f69.
- No se ha comprobado CI de R57 aún: no declarar PASS.
- No se ha ejecutado prueba API Claude mediante el CLI, solo ensayo anterior del usuario en Playground.

## Restricciones y siguientes prioridades
- El usuario conserva la clave Anthropic en privado; jamás compartirla aquí, logs, GitHub, Vercel NEXT_PUBLIC ni Render suspendido.
- Comprobar saldo promocional de USD 100 (vence 2026-11-13) y deshabilitar compras/auto-recharge antes de --execute. La marca local no garantiza límite de facturación entre equipos.
- Para ejecutar en computador local: clonar repo y usar entorno Python preparado; por defecto ejecutar python tools/domi_claude_shadow_once.py, que NO usa la red. --execute es opcional y se reserva para operación privada, manual y consentida.
- Backend Render de DOMI se encontró suspendido por billing. No reactivar sin presupuesto autorizado. Neon real tiene 0/57 RLS en la rama de validación según inspección previa: no habilitar memorias reales.
- No hubo modificaciones Neon, Render, Railway, Vercel ni producción; PR draft.

## Cápsula de Rehidratación
STATUS=R57_LOCAL_CLAUDE_CLI_ADDED_UNCERTIFIED
R56_SECURITY_GATE=278_SUCCESS
R57_CI_SHA=cc9a36f2691d6f092b6e687585e61cc1bd3e8f69
ANTHROPIC_CREDIT=USD100_USER_SCREENSHOT_EXPIRY_2026_11_13
CLAUDE_ACTUAL_CALLS_BY_THIS_SESSION=0
PRODUCTION_WRITES=0
NEON_WRITES=0
OWNER_BETA=BLOCKED

## Exact Prompt Restart
Retoma DOMI R57 repo majofreasenjo-jpg/Vantdomus PR #2 borrador en rama domi-neon-staging-pg-startup-gate-20261010. Verifica Security Gate del commit cc9a36f2691d6f092b6e687585e61cc1bd3e8f69, especialmente tests/security/test_domi_claude_shadow_once.py y nuevo CLI tools/domi_claude_shadow_once.py. Corrige CI sin debilitar security gates. La primera prueba manual Haiku Playground salió bien; el CLI es DRY RUN por defecto, con opción --execute solo local, confirmación, clave ingresada temporalmente, fixture sintético fijo y bloqueo de repetición. No efectuar API request real sin intención explícita adicional; nunca exponer key, datos familiares o exceder crédito. Mantener Render suspendido sin gastos, Neon intacto, PR sin merge, cápsulas append-only.
