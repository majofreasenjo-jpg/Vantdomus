# DOMI R13 — CI fixture isolation repair / 2026-10-11
Previous: `DOMI_CHECKPOINT_R12_2026_10_11.md`.

## Verified failure before correction
- GitHub Security Gate #171, run **38160690241**, conclusion **FAILURE**.
- `backend`, `web`, `mobile`: SUCCESS.
- PostgreSQL pilot: **18 passed, 2 failed** (`test_invalid_empty_rebind_rolls_back_pending_writes`, `test_switching_valid_identity_rolls_back_prior_uncommitted_changes`).
- The earlier `test_runtime_context_revocation_after_commit` committed revocation of the shared synthetic session `s-a` without restoring it, causing unrelated tests to fail when executed later. `s-rev` was likewise not restored in its prior test.
- No evidence of a broken RLS policy from these failures: they are a reproducible fixture contamination defect. Security verdict remains FAIL until retested.

## R13 code change
- Update tests/security/test_domi_pg_rls_pilot.py: both revocation tests restore the synthetic session in a `finally` block after asserting that revocation is enforced, even if the assertion raises.
- No production SQL, authentication endpoint, RLS policy or privilege changes. Preserve existing 20 adversarial tests, especially all negative scenarios.
- CI must be run again; do not declare 20/20 PASS based on code inspection.

## Security milestone and remaining gate
- Neon validation `br-broad-poetry-aksbxhbf`: last observation 57 public tables, RLS 0/57.
- PostgreSQL auth bootstrap production flows (login, invite, reset, MFA, email verification) not integrated with least-privileged definer interface. Do not deploy.
- GitHub PR #2 remains DRAFT, not merged.
- Railway patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368 remains STAGED with 124 changes; no deploy permitted without cost authorization.

## Capsule de rehidratación
`DOMI_R13_FIX_RLS_TEST_ISOLATION_20261011`: R12 failed 18/20 due to synthetic auth-session state pollution; R13 restores s-a and s-rev post-revocation. New CI pending. Neon RLS 0/57. Railway staged; production unchanged.

## Exact Prompt Restart
Resume VANTDOMUS/DOMI from DOMI_R13_FIX_RLS_TEST_ISOLATION_20261011 on GitHub PR #2, branch domi-neon-staging-pg-startup-gate-20261010. Inspect the newest Security Gate; demand full backend/web/mobile success plus **20 passed** in PostgreSQL RLS pilot, no skipped tests. If green, proceed to a versioned, minimally privileged database authentication bootstrap for live FastAPI register-with-invitation/login/MFA/recovery, without direct runtime role access to private hash or token tables. Run adversarial test first on disposable Postgres and only then test on authorized Neon validation branch, not main. Keep Railway un-deployed; do not merge PR. Record append-only bitácora, cápsula and exact restart.
