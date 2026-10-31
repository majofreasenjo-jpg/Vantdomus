# DOMI R56 — puente Claude sintético a validador del gateway (append-only)
Fecha 2026-10-16; PR #2 DRAFT.

## Estado
- R55 Gate #274 se encontraba en ejecución al revisar; los jobs postgres-rls-pilot, postgres-real-auth-candidate, web y mobile mostraban SUCCESS en la última consulta, backend aún in_progress. No declarar SUCCESS general sin confirmación final.
- La prueba manual de Claude Haiku del usuario fue conversacional positiva: propuestas, horarios y solicitud de confirmación; no prueba integración backend.
- Adaptador R55 todavía no está conectado al chat familiar real.

## Material R56
- app/assistant/anthropic_shadow_bridge.py commit 0017db174965e592543e7b2824c9dac5192d01e2: entrada única 100% sintética, comparación contra MockProvider, reutilización de validate_provider_output y catálogo seguro, informe limitado a métricas; cero escrituras; bloqueo por proceso para evitar repetir llamadas tras un intento.
- tests/security/test_domi_anthropic_shadow_bridge.py commit ce870e08ca6fc95d0306ead9cbc1189b0c887ec3: negativos de fixture, flags, herramientas no autorizadas, fallas y reintentos.
- Security Gate actualizado commit ee7101790bcdd96ed34be53c4536dd57d87b2e8d para ejecutar test R56 en CI offline.
- CI R56 pendiente. Guard per-process NO reemplaza presupuesto distribuido ni contabilización facturación real. No habilitar antes de verificar.

## Restricciones
La clave Anthropic permanece solo en poder del usuario; ningún acceso a esa clave ni al backend suspendido de Render. No se hicieron llamadas Anthropic desde ChatGPT; no modificación de Neon/Railway, no despliegue Vercel/Render y no merge.
El puente NO está conectado a rutas HTTP ni a family-live. Ningún dato familiar real se transmite.

## Cápsula
STATUS=DOMI_R56_SHADOW_BRIDGE_CODE_COMMITTED_CI_UNVERIFIED
GATE_R55=IN_PROGRESS_LAST_OBSERVED
CLAUDE_PLAYGROUND=PASS_CONVERSATIONAL_ONLY
EXTERNAL_CALLS_BY_ASSISTANT=0
R56_CI_COMMIT=ee7101790bcdd96ed34be53c4536dd57d87b2e8d
PR_2=DRAFT
PRODUCTION_CHANGES=NONE
NEON_WRITES=NONE
PERSONAL_BETA=BLOCKED

## Exact Prompt Restart
Retoma DOMI desde checkpoint R56 PR #2 draft rama domi-neon-staging-pg-startup-gate-20261010. Comprueba Security Gate para commit ee7101790bcdd96ed34be53c4536dd57d87b2e8d, con énfasis tests R56 puente Claude sintético. Corrige fallos sin permitir datos reales ni llamadas extra. Puente apps/api/app/assistant/anthropic_shadow_bridge.py nunca está expuesto al chat real ni a una API HTTP. Exige validación del catálogo y autorización humana antes de acciones. Mantener costos promocionales Anthropic controlados, no desplegar ni reactivar Render (suspendido por billing), no Neon/main, y documentar cada avance con bitácora, cápsula y restart.
