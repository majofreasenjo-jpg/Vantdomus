# DOMI R61 — Atomic confirmation and reminder rollback
Date 2026-10-17 · PR #2 draft · append-only.

## Verified predecessor
Security Gate #293, run 39057199927, SUCCESS (backend, web, mobile, postgres-rls-pilot, postgres-real-auth-candidate); staging-smoke SKIPPED. R60 HTTP tests passed against temporary SQLite, not Neon nor production.

## R61 work
- apps/api/app/assistant/proposals.py commit b81fe7bf6f6430bf0454e30cf949c25fd9b77814: SQL compare-and-set updates proposed status only if status/id/household/expiry match; stale second confirmation cannot claim an already executed proposal. ProposalConflict is explicit.
- R61 reminder savepoint: on failure AFTER insert, rollback reminder-side transaction writes to the savepoint, then persist failed status and error audit; on success release and commit. Changes are confined to reminder rollback and shared proposal claim logic.
- tests/security/test_domi_r60_reminder_http_e2e.py commit e85c699738ceaa19d9d9447f4a54008b22aede30: stale confirmation rejected; injected late success-audit failure must leave zero reminders, and controlled retry creates one. No external network, no Anthropic costs.
- R61 CI UNVERIFIED; check GitHub Actions and fix any failure before declaring pass.
- Further review necessary: concurrent requests using separate DB sessions, precise SQLite/Postgres lock behavior, failure of failure-audit itself, uniqueness guarantees, and cross-household RLS in disposable PostgreSQL. No claims of real deployed staging.

## Gates / restrictions
Neon validation RLS last observed 0/57; no Neon writes, no Render reactivation or Railway deployments, no merging PR, no real family data.
Claude shadow remains synthetic, not routed to real user chat. Promotional credit remains limited/expiry 2026-11-13.

## Roadmap
Code HTTP/SQLite reminders: advanced to atomic confirmation candidate. CI R61 pending.
PostgreSQL real E2E, Neon staging security, backend deploy, PC-phone memory, and full owner beta remain OPEN.

## Rehydration capsule
STATUS=DOMI_R61_ATOMIC_CONFIRM_COMMITTED_CI_UNVERIFIED
R60_GATE_293=SUCCESS
R61_CODE=b81fe7bf6f6430bf0454e30cf949c25fd9b77814
R61_TESTS=e85c699738ceaa19d9d9447f4a54008b22aede30
PR_2=DRAFT
REAL_BETA=BLOCKED
NEON_WRITES=NONE
RENDER=UNCHANGED
CLAUDE_EXTERNAL_CALLS=NONE

## Exact Prompt Restart
Retoma DOMI VANTDOMUS desde R61 checkpoint DOMI_R61_REMINDER_ATOMIC_CONFIRM_20261017.md. Comprueba Security Gate para último commit y logs del test R61. Corrige cuidadosamente cualquier falla en compare-and-set y savepoint de recordatorio; comprobar que un fallo de auditoría tras INSERT no deja un registro y que intento stale no ejecuta. Ampliar pruebas de concurrencia separadas y pruebas de PostgreSQL transaccional desechable, sin tocar Neon ni activar Render. PR #2 permanece draft, Claude solo sintético, no datos reales, sin gastos. Mantener bitácora y nueva cápsula append-only.
