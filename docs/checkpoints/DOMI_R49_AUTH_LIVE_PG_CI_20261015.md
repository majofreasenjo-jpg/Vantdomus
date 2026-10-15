# DOMI R49 — PostgreSQL auth catalog live CI · 2026-10-15

Predecesor: docs/checkpoints/DOMI_R48_AUTH_CATALOG_FALSIFICATION_20261015.md.
Security Gate #254 (run 38770296157) SUCCESS on R48: backend/web/mobile/postgres-rls-pilot PASS; staging-smoke SKIPPED.

## Cambio material
- Nuevo tests/security/test_domi_pg_auth_readiness_live.py: utiliza servicio PostgreSQL 16 desechable, esquema y funciones sintéticas del piloto R8, crea LOGIN de inspección no privilegiado, concede las 9 funciones restringidas y ejecuta la CONSULTA REAL del nuevo gate R48.
- Casos de falsificación bajo transacción y ROLLBACK: permiso de columna, membresía con NOINHERIT, EXECUTE a PUBLIC, función extra legacy, cross-role EXECUTE, search_path inseguro, función sin SECURITY DEFINER, y sobrecarga adicional.
- GitHub workflow postgres-rls-pilot incorpora este test después del piloto R8 y antes del ensayo del esquema de 57 tablas.
- Commit prueba ef9e1e8dfe025dfe90edfec7c4e8549517df0503; CI c301b815dd820340667102181a072dc84d4cab4d.
- Ejecución CI R49 pendiente de confirmación; NO declarar PASS hasta leer resultado de GitHub.

## Restricciones
- El test solo acepta DSN localhost/127.0.0.1 sobre database domi_rls_ci.
- No se escribe en Neon, no se despliega Railway, no se mezclan datos reales ni se fusiona PR #2.
- Meta futura: migración real auth + RLS versionada para Neon validación, primero revisar y aprobar la operación; luego pruebas de acceso real PC/teléfono.

## Cápsula
DOMI=R49_LIVE_AUTH_GATE_CI_IMPLEMENTED_NOT_VERIFIED
R48_GATE_254=SUCCESS
R49_CI_COMMIT=c301b815dd820340667102181a072dc84d4cab4d
NEON_VALIDATION_RLS=0_OF_57_LAST_CONFIRMED
NEON_MAIN=UNTOUCHED
RAILWAY=NO_DEPLOY
OWNER_BETA_REAL=BLOCKED

## Exact Prompt Restart
Retoma DOMI desde R49, PR #2 draft rama domi-neon-staging-pg-startup-gate-20261010 repo majofreasenjo-jpg/Vantdomus. Primero revisa ejecución Security Gate del commit c301b815dd820340667102181a072dc84d4cab4d y sus logs, especialmente nuevo paso "R49 live PostgreSQL auth catalog falsification". Diagnostica cualquier fallo semántico real SQL y corrígelo sin relajar autorización. Después preparar de manera versionada la migración real de funciones auth y RLS sobre esquema público verdadero, usando pruebas desechables. No hacer escrituras Neon, cambios producción, merges, gastos ni Railway sin autorización diferenciada. Registrar todo append-only, nueva cápsula y exact prompt restart.
