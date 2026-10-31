# DOMI R43 — verificación semántica del consentimiento · 2026-10-14

## Evidencia observada
- Security Gate #239, run 38613162009: backend, móvil, PostgreSQL PASS; autenticación 62/62, RLS y memoria HTTP 37/37; web FAIL en postbuild test domi-owner-private-ui-gate.test.mjs por comprobación de texto literal `/share/` inexistente en interfaz española. Auditoría npm 0 vulnerabilidades. Staging-smoke omitido.
- PR #2 DRAFT. Neon main, rama validación y Railway sin modificaciones; RLS en Neon real sin certificar ni aplicar.

## Cambio R43
- Commit b0fc904f0f074905286b21fc48762673e1089884: elimina aserción artificial basada en palabra inglesa `share` y precisa el texto de consentimiento en OwnerPrivateClient: la autorización es para hasta seis recuerdos privados recientes, no una selección inexistente.
- Commit f32f8093a71af58287dc8c53a1451aa251f51b69: corrige escapes de las nuevas expresiones regulares y exige comprobación explícita de guardia `!consent`, llamada autorizada a `ownerBetaChatWithMemory`, checkbox y reinicio de consentimiento.
- No se cambian permisos, políticas RLS ni backend. CI posterior al último commit todavía pendiente de lectura; **no certificar R43 sin el resultado del Security Gate más reciente**.

## Brechas de producto
- Aplicación real de migraciones Neon RLS y rol no privilegiado aún pendiente; comprobar integridad de 57 tablas y semántica de políticas antes de usar recuerdos personales.
- UI /owner-private sigue cerrada detrás de opt-in y solo Preview. No existe una demostración física validada PC→teléfono ni conversación con proveedor real y consentimiento auditado.
- No desplegar Railway, fusionar PR o tocar Neon main sin autorización.

## Cápsula de rehidratación
DOMI_R43_CONSENT_UI_SEMANTICS_20261014 | gate #239 62/62 auth +37/37 RLS+HTTP PASS, fallo web test textual | commits b0fc904f y f32f8093 reemplazan prueba por control efectivo y aclaran consentimiento, CI nuevo pendiente | Neon real no migrado, Railway no deploy, Owner Beta no abierta.

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde DOMI_R43_CONSENT_UI_SEMANTICS_20261014, GitHub majofreasenjo-jpg/Vantdomus PR #2 rama domi-neon-staging-pg-startup-gate-20261010, commit f32f8093a71af58287dc8c53a1451aa251f51b69. Verifica último Security Gate completo, exige backend/web/mobile PASS, auth PG 62/62, RLS/HTTP 37/37 y npm audit cero. Corrige fallos verdaderos sin eliminar guardia de consentimiento ni abrir memoria personal. Después abordar preflight y migraciones reales de Neon en rama aislada sólo con revisión/autorización de cambio; no production, no Railway deploy, no costos sin autorización. Mantener bitácora append-only, cápsula y reinicio exacto.
