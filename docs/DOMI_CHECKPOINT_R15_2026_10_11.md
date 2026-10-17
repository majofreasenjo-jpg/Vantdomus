# DOMI R15 — Bitácora append-only, cápsula y restart (2026-10-11)

Predecessor: DOMI_CHECKPOINT_R14_2026_10_11.md.

## Evidencia observada
- GitHub Security Gate #174, run 38165445534, result SUCCESS, jobs backend/web/mobile/postgres-rls-pilot all SUCCESS. Pilot 20 passed in 0.36s.
- PR #2 draft, without merge, head at start 40983b01aa919aa0173d648540c3b5b1bd7aeb61.
- Existing Neon validation branch previously observed 57 public tables, 0 with RLS and 0 policies; no Neon SQL migration in this step.
- Railway six services remain at 124 changes STAGED according to latest inspection; not deployed.

## R15 changes in code
- Commit f698725d8dfc0bc902b731c3b8fe70ca2ed3b60a.
- Added synthetic, isolated SQL credential-lookup routine domi_auth.lookup_password_credential to the disposable PostgreSQL CI fixture only.
- Added NOINHERIT, non-BYPASS, non-admin auth-only login domi_auth_lookup, distinct from ordinary household runtime role.
- Added trusted-server bcrypt proof component in pg_auth_bootstrap.py, *not connected to the login route*; requires all existing brute-force, MFA, audit and session-issuance controls separately.
- Extended the PostgreSQL pilot from 20 to 26 cases; denies direct auth-table reads, direct sessions writes, SET ROLE escalation and calls from the ordinary runtime user.
- Pinned bcrypt 4.2.1 in disposable CI pilot dependency installation. Actual app dependencies left unchanged.
- R15 CI has NOT been observed passing. No certification of the 26 tests until live run.

## Security limitations
- The isolated SQL lookup exposes password digests to a trusted authentication connection via a limited function. This interface requires additional review: separate secret storage, network isolation, auditing, throttles, pool restrictions, and server-only access. It is NOT a general client login credential.
- Direct SQL access to sensitive auth tables remains forbidden for household runtime and auth lookup roles.
- No MFA, registration, recovery, invitation or session issuance integration completed in real FastAPI. Existing methods unchanged.
- This is a synthetic proof, not real Neon RLS of all 57 tables; 0/57 last observed.
- Do not enable RLS blanket policies or deploy to Railway without security proof and cost authorization.

## Roadmap
1. Observe Security Gate R15 and verify exactly 26 PostgreSQL tests PASS plus backend/web/mobile. Fix any real failures.
2. Implement narrow, audited server-side auth bootstrap for login with bcrypt and MFA preservation, rate limits and revocation. Design registration/invitation/password-reset and email-verification interfaces by function.
3. Validate least-privilege roles and migration with two families and organizations on Neon validation branch, not main.
4. Roll out per-table RLS only once the bootstrap flows and rollback are proven; then prepare physical staging subject to cost approval.

## Cápsula de rehidratación
DOMI_R15_RESTRICTED_AUTH_LOOKUP_PILOT_20261011; baseline Security Gate #174 PASS and RLS pilot 20/20 PASS; new 26-test authentication pilot code committed f698725d8dfc0bc902b731c3b8fe70ca2ed3b60a, CI pending. Neon 57 tables/0 RLS, Railway 124 STAGED, PR #2 draft. No production changes.

## Exact Prompt Restart
Resume DOMI from DOMI_R15_RESTRICTED_AUTH_LOOKUP_PILOT_20261011 in majofreasenjo-jpg/Vantdomus PR #2. First inspect GitHub Actions for the latest head and demand 26 passed PostgreSQL pilot plus backend/web/mobile; correct failures without relaxing security. Preserve all earlier checkpoints and R1-R14 evidence. Audit authentication helper for unintended hash leakage, SQL privilege escalation, SQL injection and absence of rate-limiting if exposed. Complete authenticated FastAPI login/invite/verification/MFA/reset via minimal stored functions, no unrestricted table access. Then apply and test per-table RLS in isolated Neon validation branch and only afterward staging/physical computer-phone continuity. Never modify Neon main or merge/deploy Railway without explicit authorization and gates. Update append-only bitácora, capsule and Exact Prompt Restart.
