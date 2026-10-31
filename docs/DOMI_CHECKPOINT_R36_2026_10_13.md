# DOMI R36 — integración firmada y rollback (append-only, 2026-10-13)

## Evidencia
- Security Gate #221 run 38488387840 SUCCESS: backend/web/mobile PASS, PostgreSQL auth 62/62 PASS, RLS R35 17/17 PASS, npm audit web 0.
- PR #2 DRAFT, branch domi-neon-staging-pg-startup-gate-20261010, sin merge.
- Neon real (última observación) 57 tablas y 0/57 RLS. Neon main y validación no modificados; Railway sin desplegar.

## Implementación R36
- Commit 5360875709f2f02038593bea930039b93aa023bc: PgSessionContext soporta modo firmado opt-in `DOMI_ENABLE_SIGNED_RLS_RUNTIME=1`. Requiere rol de LOGIN PostgreSQL no privilegiado y asume `domi_app_runtime` solo durante la transacción. Firma sujeto/JTI después de JWT comprobado por dependencia FastAPI. Revalida al cambiar transacciones; revocación/expiración niegan acceso. Si opt-in está activo sin `DOMI_ENABLE_PG_AUTH_LOGIN=1`, connect() falla cerrado. Por defecto conserva el modo heredado.
- Commit b93e0b54771554c58bac71e421c8b3b825608529: 2 pruebas de integración nuevas sobre wrapper real con reactivación tras COMMIT/ROLLBACK, token rechazado y ausencia de identidad; suite RLS 19 pruebas definidas.
- Nuevo rollback candidato `security/302_domi_r36_owner_beta_rls_safe_rollback.sql`: revisa 57/57 RLS/FORCE, revoca todos los GRANT de runtime, revoca firma y membresía, elimina políticas permisivas y restrictivas correspondientes, deja políticas de denegación en las cuatro tablas y retira clave de contexto. No deshabilita RLS. Se ejerce al final de la suite desechable.
- **CI R36 no certificada** al registrar este documento. La existencia de casos no constituye PASS.

## Riesgos aún abiertos
- La identidad llega a bind_verified_session desde un caller que debe comprobar JWT criptográficamente. No abrir interfaz SQL arbitraria a los clientes ni secretos HMAC. Falta E2E HTTP con datos sintéticos, rotación de claves, nuevas sesiones/revocación y validación de endpoints.
- No se han aplicado migraciones reales a Neon. El contexto de PostgreSQL y funciones SQL requieren auditoría adicional en rama aislada antes de habilitar datos personales.
- 53 tablas deliberadamente cerradas en R31, rutas de invitación, MFA y recuperación incompletas.
- Railway sin desplegar; Owner Beta personal no lista.

## Cápsula de rehidratación
DOMI_R36_SIGNED_WRAPPER_AND_ROLLBACK_20261013 | baseline #221 auth 62 PASS, RLS 17 PASS, web audit 0; R36 integración opt-in en wrapper y rollback 302, 19 pruebas RLS definidas, nuevo CI PENDING. Neon 0/57 RLS; Railway undeployed.

## Exact Prompt Restart
Retoma DOMI en GitHub majofreasenjo-jpg/Vantdomus PR #2 branch domi-neon-staging-pg-startup-gate-20261010 desde DOMI_R36_SIGNED_WRAPPER_AND_ROLLBACK_20261013. Revisa Security Gate posterior a b93e0b54771554c58bac71e421c8b3b825608529: exige 62/62 auth, 19/19 RLS, backend/web/mobile PASS y npm audit 0. Corrige fallos auténticos conservando auth por JWT, rol NOINHERIT, pruebas de cambio transaccional y rollback fail-closed. Luego ensaya auténtico contrato HTTP/DB y auditoría RLS en Neon validación con aprobación de cambio; no Neon main, no PR merge ni Railway deployment sin autorización explícita. Registrar bitácora, cápsula y reinicio exacto en cada avance.
