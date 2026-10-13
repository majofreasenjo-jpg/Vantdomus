# DOMI R31 — primera migración RLS para el esquema real (2026-10-13)

Predecesor append-only: DOMI_CHECKPOINT_R30_2026_10_13.md.

## Evidencia de partida
- GitHub PR #2 en borrador. Security Gate #208, run 38407295150: SUCCESS (estado observado).
- Neon proyecto solitary-dawn-70172559 rama br-broad-poetry-aksbxhbf: 57 tablas públicas, 0/57 RLS, 0 FORCE, 0 políticas. Leídas tablas reales: fechas TEXT, flags INTEGER y propiedad neondb_owner con BYPASSRLS. No se modificó.
- Esquema PostgreSQL base existente en apps/api/postgres_staging_migrations/000_110_part_a.sql, 120_260_part_b.sql y 270_287_part_c.sql.
- Canon de memoria: private_self, household_shared, guardian_supervised, etc.; R31 solo abre lecturas privadas del propietario, no recuerdos compartidos ni datos sensibles.

## Implementación R31 en repositorio (NO aplicada en Neon)
- Commit b7435f8a226a084682ef10a4bfbec7db8972c7f4: `apps/api/postgres_staging_migrations/security/300_domi_r31_owner_beta_rls_up.sql` y `300_domi_r31_owner_beta_rls_safe_rollback.sql`.
- Preflight de inventario exacto de las 57 tablas; bloqueo de colisiones con políticas existentes; dos roles NOLOGIN, NOINHERIT y NOBYPASSRLS.
- RLS + FORCE RLS en las 57 tablas; todas las tablas distintas del dominio inicial reciben una política cerrada explícita para runtime.
- Funciones SECURITY DEFINER bajo rol aislado para identificar sesión/JTI y pertenencia de hogar. Acceso mínimo SELECT a hogares/membresías/personas, SELECT/INSERT/UPDATE de memoria private_self no sensible y con consentimiento; no se habilita DELETE, lectura de contraseñas, sesiones ni tablas financieras.
- Reversión **fail-closed**: revoca permisos y sustituye políticas abiertas por políticas cerradas, sin deshabilitar RLS/FORCE ni exponer datos.
- Commit 2a67ffdd30b5a83c6af754c801a7468af3cae20e: `tests/security/test_domi_r31_real_schema_rls.py`, nueve pruebas con esquema completo 000..287 en base PostgreSQL desechable, sujeto/jti, datos ficticios de dos hogares, acceso cruzado, bloqueo de tablas sensibles, expiración, borrado y rollback.
- Commit e23e72a72f4f0ffa3735e4a6f28563417af41cce: Security Gate incorpora de forma obligatoria el nuevo test PostgreSQL; el primer resultado de CI R31 **pendiente** y debe revisarse, sin afirmar PASS.
- No migraciones en Neon, no Railway deploy, no producción. No se han eliminado pruebas previas.

## Riesgos explícitos / condiciones de liberación
1. La función de identidad SQL usa GUC de sujeto/JTI. Antes de producción, el contexto debe ligarse al JWT verificado por el backend y los roles de runtime deben evitar que una sesión SQL reutilizada altere identidad. No afirmar cierre de auth sin prueba E2E.
2. R31 no entrega funcionalidad total: mantiene deliberadamente 53 tablas cerradas y solo permite el subconjunto mínimo de memoria propia. Es una primera fase y no debe habilitarse sola como producto.
3. El esquema real no tiene FKs; revisar consistencia org/hogar/persona. Fechas TEXT requieren validación de formatos; entradas defectuosas deben fallar sin filtrar datos.
4. Las consultas de memoria deben respetar consent_scope, visibility_scope, deleted_at, expiration, inference_status y sensitivity, tanto en RLS como en el backend.
5. Verificar CI completo incluyendo importación real del esquema, 57 FORCE RLS y pruebas adversariales, luego auditoría de migración y ensayos en rama aislada con aprobación antes de habilitar datos reales.
6. Completar auth/MFA/reset/invitaciones/revocación, políticas específicas de las otras familias, staging autorizado, memoria entre sesiones y prueba física PC→teléfono.
7. Ejecutar migraciones y cambios que creen roles, conecten backend o aumenten gasto únicamente mediante el gate de autorización y revisión del entorno aislado.

## Cápsula de rehidratación R31
DOMI_R31_REAL_SCHEMA_RLS_CANDIDATE_20261013 | Security Gate #208 inicial PASS | 57 tablas sin RLS real | primera migración reversible/cerrada y nueve pruebas CI preparadas y conectadas | CI nueva pendiente | Neon sin cambio, Railway sin desplegar, Owner Beta real NO LISTA.

## Exact Prompt Restart R31
Retoma DOMI R31 en majofreasenjo-jpg/Vantdomus PR #2, rama domi-neon-staging-pg-startup-gate-20261010. Verifica el Security Gate más reciente, exige que aprueben las 62 pruebas PostgreSQL R29 + las nueve de esquema real R31, backend/web/mobile y npm audit. Lee y corrige cualquier falla de `tests/security/test_domi_r31_real_schema_rls.py` o migración `apps/api/postgres_staging_migrations/security/300_domi_r31_owner_beta_rls_up.sql`, conservando fail closed. No aplicar migración a Neon main; rama validación br-broad-poetry-aksbxhbf sigue sin mutarse; Railway sin desplegar. Tras CI, revisar modelo de amenazas GUC/JWT, permisos de owner/roles y consentimientos antes de considerar aplicar en validación. Actualizar bitácora, cápsula y Exact Prompt Restart. Objetivo Owner Beta con recuerdos persistentes y continuidad real PC/teléfono.
