# DOMI R62 — concurrent PostgreSQL confirmation, append-only checkpoint
2026-10-17 · PR #2 DRAFT.

## Certified predecessor
Security Gate #296, run 39061777953 SUCCESS: backend, web, mobile, postgres-rls-pilot, postgres-real-auth-candidate. Staging-smoke SKIPPED. R61 tests validated SQLite and CAS/savepoint unit integration, but not two PG sessions.

## R62 work
- tests/security/test_domi_r62_pg_reminder_concurrency.py commit a1342e88e53435215a4299e17971ebfd3bd2f79f.
- Uses only a loopback disposable DSN to domi_rls_ci, requires preprovisioned exact R31 57-table schema, checks 57 RLS+FORCE tables.
- Two physical PostgreSQL connections receive same pending reminder proposal. Leader holds row CAS update while follower attempts; observer checks pg_blocking_pids(follower). Release, assert exactly one 'executed' and one 'stale_rejected', one family_reminder, one action/audit event.
- Separate fault-injection trial: failure of assistant_executed audit after reminder insertion must roll back reminder insertion and success audit, mark proposal failed, then authorized retry creates one reminder.
- CI isolated postgres-real-auth-candidate step added commit 35570a48f452fe5cfb95e97236b54d0e7a3520f1; runs before R50 SQL temporary activation; no Neon.
- This tests transaction semantics with disposable PG superuser, NOT complete authenticated RLS runtime; separate restricted role coverage remains necessary. New R62 CI not yet observed: do not claim PASS.

## Roadmap snapshot
- Propose / confirm / dedupe reminder SQLite E2E: certified R61.
- PG two-connection contention and rollback: coded R62, CI pending.
- Claude actual API call through DOMI: NOT done; user's Playground test successful only.
- Neon real RLS (last observed 0/57), runtime signed auth and backend deployment: BLOCKED.
- PC↔phone family memory E2E: BLOCKED.
- Production/owner beta: NOT activated.

## Rehydration capsule
DOMI_R62=PG_CONCURRENCY_TEST_CODE_COMMITTED_CI_UNVERIFIED
R61_SECURITY_GATE_296=SUCCESS
R62_CODE=a1342e88e53435215a4299e17971ebfd3bd2f79f
R62_CI=35570a48f452fe5cfb95e97236b54d0e7a3520f1
PR_2=DRAFT
NEON_WRITES=0
RENDER_CHANGES=0
ANTHROPIC_API_CALLS_BY_ASSISTANT=0

## Exact Prompt Restart
Retoma DOMI R62 desde PR #2 draft rama domi-neon-staging-pg-startup-gate-20261010. Verifica el Security Gate del nuevo checkpoint/commit y los logs del paso R62 tests/security/test_domi_r62_pg_reminder_concurrency.py en job postgres-real-auth-candidate. Ante falla, corregir test o implementación sin debilitar guardias. Probar contención real de dos conexiones, un solo reminder y savepoint rollback tras falla de auditoría. Mantener CI solo DB PostgreSQL desechable loopback, no Neon remoto, no Render deploy, no gastos, no merge, no datos familiares. Documentar próximo checkpoint append-only con estado exacto.
