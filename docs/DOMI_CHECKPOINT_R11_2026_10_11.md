# DOMI — Checkpoint R11 (append-only), 2026-10-11

## Evidence
- Historical GitHub Security Gate R10 #169 (run 38152326829), RLS pilot PostgreSQL: **15/15 PASS**, with real restricted app login and separate non-BYPASS auth-definer. Web and mobile PASS, backend was running on initial check; overall CI must be re-verified before a global PASS statement.
- PR #2 in draft. Neon staging-validation branch br-broad-poetry-aksbxhbf has 57 public tables, 0 RLS enabled and 0 policies (read-only inspection). Railway remains 124 STAGED, no deployment.

## Code changes R11
- New apps/api/app/pg_session_context.py: SQL helper `domi_auth.activate_session(text,text)` is called using only parameterized claims (user_id/JTI already verified in signed JWT by FastAPI), validates session, and sets transaction-scoped PostgreSQL identity.
- db.py PostgresConnectionWrapper now binds identity from an authenticated session; cursor execution revalidates after COMMIT or ROLLBACK. Closing the request drops the remembered claims. SQLite fallback remains unchanged.
- deps.py get_current_user on PostgreSQL uses the restricted database auth helper instead of unrestricted SELECT from `auth_sessions`; SQLite retains the existing contract.
- The startup gate now requires an EXECUTE-granted SECURITY DEFINER auth helper owned by a NOLOGIN, non-BYPASSRLS, non-admin role.
- The disposable PostgreSQL CI fixture adds a `domi_auth.activate_session` compatibility function and 3 integration checks for the actual Python transaction context, bringing the synthetic pilot from 15 to 18 tests.

## Explicit limitations / hold
- The `domi_auth` helper has NOT been installed in real Neon. The pilot creates only a synthetic alias in an ephemeral CI database.
- The real unauthenticated register/invite/login/password-reset/MFA flows access private tables and still require a separate minimal auth-bootstrap data-access interface. DO NOT deploy this branch expecting those endpoints to operate under the restricted runtime role yet.
- RLS remains 0/57 in Neon. No real 57-table tenant security certification and no physical device test.
- PostgreSQL `last_seen_at` session heartbeat is not updated in this adapter until a narrow helper is provisioned.
- A database-level SQL injection might manipulate custom GUC values: protect with strict SQL parameterization, revocation/JTI verification in helpers, narrow privileges and full adversarial audit.
- The R11 code is not CI PASS until the new workflow outcome is observed; no merge/deploy.

## Roadmap
1. Verify GitHub CI including the 18 live synthetic PostgreSQL tests, repair failures.
2. Complete SQL authentication bootstrap contracts for login/registration/invitation/verification/MFA/reset with narrowly scoped definer functions and negative tests.
3. Apply 57 per-table RLS policies on isolated Neon branch with two-household adversarial test and real direct login.
4. Run staging only upon explicit authorized cost, then physical computer-phone transport and receipts; release only after operational checks.

## Cápsula de rehidratación
`DOMI_R11_PG_AUTH_TRANSACTION_REBIND_20261011`: R10 pilot 15/15 PASS, R11 runtime identity binding and transaction rebind implemented in PR #2; R11 18-test CI pending. Neon RLS 0/57. Railway STAGED 124. PR draft.

## Exact Prompt Restart
Resume DOMI at DOMI_R11_PG_AUTH_TRANSACTION_REBIND_20261011 in majofreasenjo-jpg/Vantdomus PR #2. First check the newest Security Gate and 18-test postgres-rls-pilot job; fix actual failures, preserve previously approved backend/web/mobile. Then implement and test the remaining FastAPI authentication bootstrap flows with a least-privilege data interface, no direct app access to password hashes, recovery tokens or sessions. Use real Neon validation branch br-broad-poetry-aksbxhbf exclusively for later reviewed migration and live two-household/family RLS proof. Do not touch Neon main, merge PR #2, or deploy Railway until gates and explicit cost authorization. Maintain append-only bitácora, cápsula and Exact Prompt Restart.
