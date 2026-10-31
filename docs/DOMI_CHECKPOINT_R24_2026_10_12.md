# DOMI R24 — transacción entre roles de autenticación (2026-10-12)

Documento append-only. Predecesor: DOMI_CHECKPOINT_R23_2026_10_12.md.

## Evidencia verificada
- PR #2, rama domi-neon-staging-pg-startup-gate-20261010, DRAFT sin fusionar.
- GitHub Security Gate #194, run 38290568140, FAILURE global: backend, web, mobile SUCCESS; PostgreSQL piloto 45 passed, 1 failed.
- Falla única: test_throttle_attempt_window_and_case_normalization esperaba ver dos intentos fallidos desde la conexión lookup antes del COMMIT del emisor. La lectura devolvió cero como corresponde al aislamiento transaccional.
- La separación en roles domi_auth_lookup (lectura) y domi_auth_session_issuer (emisión y escritura) se conserva; 46 funciones de prueba.

## Cambio R24
- Commit ad23212948282c8388aa3e9f9a2b3e64ab554d63 actualiza exclusivamente tests/security/test_domi_pg_rls_pilot.py.
- La prueba afirma visibilidad cero antes del COMMIT y dos intentos después; conserva los 46 casos.
- No se cambian permisos SQL, funciones de autenticación reales ni código de producción. Nuevo CI pendiente de resultados; **no declarar 46/46 PASS hasta leer logs**.

## Seguridad y roadmap
- Las funciones del fixture son sintéticas y no están instaladas en Neon real.
- 57 tablas públicas, RLS 0/57, último estado; no se tocó Neon main ni la rama de validación.
- Antes de utilizar DOMI con datos personales faltan autorización de emisión ligada a identidad, completitud de login/MFA/reset/invites/logout, auditoría y políticas RLS de 57 tablas con pruebas adversariales.
- Railway permanece STAGED, sin desplegar ni generar nuevos costos.

## Cápsula de rehidratación
DOMI_R24_TRANSACTION_ISOLATION_FIX_20261012. R23 CI #194 falló 45 PASS / 1 FAIL por falta de COMMIT entre roles; R24 añade comprobación de visibilidad antes/después del COMMIT; CI pendiente. PR draft. Neon 0/57 RLS. Railway sin desplegar.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R24_TRANSACTION_ISOLATION_FIX_20261012, GitHub majofreasenjo-jpg/Vantdomus PR #2, rama domi-neon-staging-pg-startup-gate-20261010, implementación ad23212948282c8388aa3e9f9a2b3e64ab554d63. Verifica Security Gate nuevo, exige 46/46 PostgreSQL PASS, backend/web/mobile PASS y auditoría web cero. Corrige cualquier fallo auténtico sin reducir seguridad. A continuación refuerza autorización de emisión de sesión ligada a una prueba de identidad y completa flujos auth restantes, auditoría y RLS en la rama de validación Neon, no main. Nunca fusionar PR o desplegar Railway sin autorización; registrar bitácora append-only, cápsula y reinicio exacto.
