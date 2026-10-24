# DOMI R45 — private schema catalog inspection correction · 2026-10-14

Predecessor append-only: DOMI_CHECKPOINT_R44_2026_10_14.md.

## Evidence
- Gate #244, run 38623494292: web/backend/mobile SUCCESS; PostgreSQL authentication 62 PASS; RLS/HTTP 37 PASS and 2 failures. Cause: PostgreSQL unprivileged LOGIN raises InsufficientPrivilege for schema domi_r31 when gate invokes to_regprocedure('domi_r31.subject_id()'). Security boundary correctly denies schema USAGE to LOGIN.
- Neon validation branch br-broad-poetry-aksbxhbf inspected read-only during R44: 57 tables, RLS/FORCE/policies 0; pgcrypto absent; only neondb_owner with BYPASSRLS among required roles. No modifications to Neon main or validation, no Railway.
- PR #2 DRAFT, no merge.

## R45 implementation
- Commit 15f983dd8bd288fddaea473b801e451c84c2952f.
- Signed startup check uses pg_proc namespace, proname='subject_id', zero arguments, return type TEXT, SECURITY DEFINER, restricted owner and EXECUTE privilege. Eliminates unprivileged regprocedure resolution which required forbidden schema USAGE.
- Adds negative contract assertion ensuring private schema name resolution is not attempted. No new privilege granted, no weakening of RLS or HMAC. Existing 39 real-schema cases preserved.
- Next Security Gate pending; do not claim R45 PASS without observing it.

## Critical remaining barriers
- Actual Neon branch not migrated (57/57 RLS work to follow with explicit change approval); role/pgcrypto provisioning and model-specific auth tests required.
- End-to-end Owner Beta with authentication, memory and physical phone untested. Owner-private page still gated and undeployed, Railway not deployed.

## Rehydration capsule
DOMI_R45_PG_PROC_PRIVATE_SCHEMA_GATE_20261014 | #244: auth 62 PASS, RLS 37/39 FAIL 2 due to private schema to_regprocedure; commit 15f983dd fixes by pg_proc metadata | next CI pending | Neon 0/57 RLS, no Railway, no Owner Beta real.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R45_PG_PROC_PRIVATE_SCHEMA_GATE_20261014 en GitHub majofreasenjo-jpg/Vantdomus, PR #2, branch domi-neon-staging-pg-startup-gate-20261010, commit 15f983dd8bd288fddaea473b801e451c84c2952f. Revisa latest Security Gate, requiere 62/62 authentication, 39/39 RLS, backend/web/mobile PASS y npm audit 0. Corregir error causal sin otorgar USAGE del schema privado al LOGIN ni relajar policies. Luego plan y ejecución autorizada en Neon validation solo, nunca main. Mantener docs append-only y seguridad para Owner Beta; no deploy Railway ni gastos sin consentimiento.
