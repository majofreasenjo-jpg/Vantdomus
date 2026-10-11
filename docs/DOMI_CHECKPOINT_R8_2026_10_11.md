# DOMI R8 — BITÁCORA APPEND-ONLY / CÁPSULA / EXACT PROMPT RESTART
Fecha: 2026-10-11. Predecesor: DOMI_CHECKPOINT_R7_2026_10_10.md.

## R8: hechos ejecutados
- GitHub PR #2 permanece DRAFT, base domi-p5-staging-provisioning-preauth; sin merge.
- El CI R7 GitHub Actions run 38088935609 fue PASS. Commit anterior 08b1fd28540b90bffc4a1ec50b26e4625659eb6d.
- Inspección real de apps/api/app/deps.py, db.py, routes/auth.py, security.py, rbac.py y workflow.
- Hallazgo: get_current_user valida JWT y verifica auth_sessions por SQL con get_db; autenticación previa y recuperación de contraseña/MFA requieren tratar acceso privilegiado separadamente. Los commits durante requests hacen que los claims SET LOCAL caduquen.
- Añadido piloto PostgreSQL real **en GitHub Actions**, aislado y totalmente sintético: pruebas de pertenencia multi-hogar, dos organizaciones, expiración, revocación, cambio de tenant por INSERT/UPDATE, acceso cruzado, rol sin BYPASSRLS, identidad vacía después de COMMIT y conexiones independientes.
- Implementación: tests/security/sql/domi_rls_pilot_v1.sql, tests/security/test_domi_pg_rls_pilot.py, .github/workflows/security-gate.yml, docs/DOMI_R8_PG_RLS_LIVE_PILOT_CONTRACT_2026_10_10.md.
- Commit de implementación: db84ac62b6f84739b73012cf6a7c2e40c56e7829.
- GitHub Actions Security Gate run 38147386313 al momento de este checkpoint inició, sin conclusión certificada. No presentar piloto PASS hasta comprobarlo.
- Neon validation br-broad-poetry-aksbxhbf conserva 57 tablas, 0 RLS/57, 0 políticas; NO fue modificada.
- Railway conserva 124 cambios STAGED, sin servicios desplegados ni costos autorizados.
- Esta prueba usa postgres efímero de CI; NO valida aún RLS en Neon ni prueba física computador-teléfono. El rol de SQL se simula con SET ROLE y los SECURITY DEFINER son propiedad de fixture CI. Son límites obligatorios de transferibilidad.

## Decisiones de seguridad
- Mantener acceso de login/MFA/reset separado de datos de aplicación y no permitir SELECT directo a secretos de autenticación.
- No aplicar políticas universales USING(true), no otorgar privilegios del propietario, no confundir claims SET LOCAL con una defensa absoluta contra SQL injection.
- Certificar previamente el piloto y diseñar cada una de las 57 políticas en base a la matriz R6 y controles WITH CHECK.

## Cápsula de rehidratación R8
CHECKPOINT=DOMI_R8_DISPOSABLE_POSTGRES_RLS_PROOF_20261011
PR=2; SOURCE_COMMIT=db84ac62b6f84739b73012cf6a7c2e40c56e7829
CI_LAST_KNOWN_PASS=38088935609
CI_NEW_RUN=38147386313 (QUEUED/IN_PROGRESS al registrar)
NEON_RLS=0/57; RAILWAY=STAGED_124, NO_DEPLOY
NEXT=verificar CI del R8, corregir pruebas reales, luego diseñar e implementar acceso de autenticación restringido y RLS en Neon aislado.

## Exact Prompt Restart R8
Retoma inmediatamente VANTDOMUS/DOMI desde DOMI_R8_DISPOSABLE_POSTGRES_RLS_PROOF_20261011 en majofreasenjo-jpg/Vantdomus PR #2. Lee el workflow 38147386313 asociado al commit db84ac62b6f84739b73012cf6a7c2e40c56e7829. Si falla el job postgres-rls-pilot, analiza logs, corrige las pruebas y preserva el resto del Security Gate. Si pasa, distingue PASS de piloto sintético de prueba de aislamiento real Neon. Inspecciona los flujos auth/register/login/verify/reset/MFA y desarrolla permisos mínimos y canal autenticación bootstrap sin exponer contraseñas ni tokens; ensaya contexto y RLS por clases de las 57 tablas en rama validación, usando datos sintéticos y barreras de rollback. Mantén Neon main sin modificación, Railway 124 cambios STAGED sin desplegar hasta autorización de costos. No fusionar PR antes de cerrar gates. Actualiza bitácora append-only, cápsula de rehidratación y Exact Prompt Restart.
