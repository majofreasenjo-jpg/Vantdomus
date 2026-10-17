# DOMI — Checkpoint R10 (append-only), 2026-10-11

## Evidence verified before R10
- GitHub Security Gate #168, run 38147420242: **SUCCESS**. Backend, mobile, web and postgres-rls-pilot succeeded; staging-smoke skipped as designed.
- Job postgres-rls-pilot: **12 passed**. Previous run #167 (38147386313) was CANCELLED by later commit, though its pilot job independently succeeded (12 passed).
- Neon branch br-broad-poetry-aksbxhbf: 57 public tables, 0 RLS, 0 policy. Untouched. Main branch untouched.
- Railway environment 901c8c0c-ee6a-43de-a6da-76c59e444e7f: patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368, 124 changes STAGED, services not deployed.

## R10 changes
- Integrated local R9 test correction into PR #2 (instead of abandoning existing history): `domi_pilot_app` now authenticates via real direct PostgreSQL login using one-time random password, not `SET ROLE` from administrator.
- The SQL pilot now gives the three SECURITY DEFINER authentication helpers to a separate `domi_pilot_auth_owner` with NOLOGIN, no elevated admin rights and no BYPASSRLS. Private read access is limited to selected columns through explicit RLS policies for the auth-function owner; no direct private-table access for the app.
- Synthetic `password_hash` column added so a negative permission test targets an existing protected column.
- 15 adversarial test functions in dedicated pilot; `DOMI_RLS_REQUIRE_LIVE=1` makes missing DSN fail instead of silently skip.
- No production data, credential or paid deployment. This is a synthetic PostgreSQL exercise, **not** a 57-table Neon security certification.

## Gates remaining
1. Obtain R10 CI pass with all 15 adversarial cases; repair any genuine failure.
2. Separate FastAPI login, invite, MFA and reset bootstrap from the per-request RLS runtime; no unauthenticated direct access to password hashes.
3. Apply data-specific policies `USING`/`WITH CHECK`, permissions, referential consistency and non-bypass roles on isolated Neon validation branch; test real access across 2 households and 2 organizations.
4. No PR merge or Railway activation until all gates and explicit cost authorization.
5. Run computer-to-phone physical continuity tests, receipts, reconnect and restart only when staging is safe.

## Capsule de rehidratación
`DOMI_R10_RESTRICTED_PG_LOGIN_AUTH_DEFINER_20261011` | Historical CI R8 12/12 PASS, new R10 login and definer tests implemented, pending CI; Neon 0/57 RLS, Railway 124 STAGED.

## Exact Prompt Restart
Resume VANTDOMUS/DOMI at `DOMI_R10_RESTRICTED_PG_LOGIN_AUTH_DEFINER_20261011`, GitHub majofreasenjo-jpg/Vantdomus PR #2. Verify latest Security Gate, inspect pilot log for **15 passed**, and repair real failures without masking tests. Then implement secure FastAPI authentication bootstrap and restricted SQL identity context, mapping 57 RLS policies to real Neon schema only in validation branch and proving negative tenant tests. Never modify main or production, merge draft PR or deploy Railway without explicit cost authorization. Record bitácora append-only, cápsula and Exact Prompt Restart.