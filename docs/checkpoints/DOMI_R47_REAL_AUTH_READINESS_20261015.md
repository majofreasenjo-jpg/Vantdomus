# DOMI R47 — real auth readiness gate · 2026-10-15

## Predecessor
docs/checkpoints/DOMI_R46_REHIDRATACION_20261015.md (append-only).

## R46 verification
- GitHub Security Gate #247, run 38678924571, SUCCESS: backend, web, mobile, postgres-rls-pilot PASS; staging-smoke SKIPPED.
- Backend full suite 352 passed / 101 skipped; postgres CI auth 62 passed and real-schema RLS 39 passed. All tests use synthetic/disposable environments, not Neon staging.

## Independent Neon inspection (read only)
- Project solitary-dawn-70172559; isolated validation br-broad-poetry-aksbxhbf.
- 57 ordinary public tables; 0 RLS; 0 FORCE RLS; 0 policies; 0 pgcrypto; domi_r31 schema absent; required restricted logins absent.
- Only relevant existing role neondb_owner is BYPASSRLS/CREATEROLE/CREATEDB and cannot act as application runtime.
- PostgreSQL tables use TEXT for timestamps, integer for is_active, etc.; no public foreign keys. Must not transplant synthetic CI schema unchecked.
- No schema, role, permission, secret or Railway changes were made.

## New blocking requirement and implementation
- R31 + R33 candidate migrates memory RLS in an offline test, but does not provision production-grade auth login functions and independent LOGIN DSNs.
- apps/api/app/pg_auth_readiness.py is a metadata-only fail-closed check: two restricted independent auth login identities, no direct grants on raw credential tables, nine allowlisted SECURITY DEFINER entrypoints with restricted owners and effective role privileges. This is strictly a necessary, NOT sufficient, gate.
- apps/api/app/main.py enforces this new check at signed PostgreSQL startup, in addition to existing 57-table RLS startup gate.
- tests/security/test_domi_pg_auth_readiness.py checks positive/negative contracts and catalog-safe lookup.
- R47 change commits 99f64c1224ccc9f0f8f98263c1b48343ab74187c, f7f2d0b5ccfbc0f15031197156f0ec8c6ec531ad and 1da5546b085bfce7c069365237ec8f7498709072.
- DO NOT declare R47 CI approved without checking workflow execution for latest commit; do not enable personal data.

## Known open requirements
1. Validate gate SQL against disposable PostgreSQL and production-shape schema, including public EXECUTE grants, default privileges, function search_path, policy semantics and actual role login connections.
2. Auth provisioning must be migrated from the disposable domi_pilot schema to actual public TEXT fields, with versioned migrations, precise least-privilege grants and rollback. Do not execute in Neon until approved.
3. Real Neon validation branch requires explicit change approval before writing any DDL; never modify Neon main.
4. Confirm cross-organization/cross-household RLS, password/MFA/recovery/reset, session issuance/revocation, consent, LLM provider isolation and physical PC/phone.
5. PR #2 stays DRAFT, Railway not deployed, no cost activation.

## Cápsula de Rehidratación
STATUS=DOMI_R47_AUTH_LOGIN_ADMISSION_GATE_COMMITTED_CI_UNVERIFIED
R46_SECURITY_GATE_247=SUCCESS
NEON_VALIDATION_PUBLIC_RLS=0/57
NEON_VALIDATION_FORCE_RLS=0/57
NEON_VALIDATION_AUTH_ROLES=ABSENT
NEON_VALIDATION_PGCRYPTO=ABSENT
OWNER_BETA_PERSONAL=BLOCKED
PRODUCTION_WRITES=NONE
RAILWAY_DEPLOY=NONE

## Exact Prompt Restart
"Retoma DOMI VANTDOMUS desde R47 (2026-10-15), repo majofreasenjo-jpg/Vantdomus PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Comprueba CI del cambio R47 (archivo pg_auth_readiness.py, llamada de main.py y pruebas test_domi_pg_auth_readiness.py). Audita semántica real de consultas de metadatos, roles, funciones y privilegios; falsifica positivos falsos. Luego implementa, sin ejecutar contra Neon, migración real reversible de autenticación y RLS para esquema público de 57 tablas, con pruebas adversariales de dos hogares y varios sujetos. Mantener fail closed, PR draft, sin datos reales, sin Neon main, Railway ni gastos. Documenta avance en nuevo checkpoint append-only y entrega nueva cápsula y Exact Prompt Restart."
