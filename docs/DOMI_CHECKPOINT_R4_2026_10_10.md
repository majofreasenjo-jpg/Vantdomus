# DOMI — checkpoint R4 — 2026-10-10
Previous: DOMI_CHECKPOINT_R3_2026_10_10.md

## Verified GitHub Actions run
- Run 38076855961 at commit edef7124bf6bb2d7d79c8dd7a8c152bb117e0bcb: Security Gate FAILED.
- Backend secret scan PASS, web PASS, mobile npm ci PASS, tenant isolation test PASS.
- Mobile TypeScript TS5098: customConditions requires moduleResolution node16/nodenext/bundler.
- Backend full suite: 315 passed, 27 failed, 2 errors; most family-pilot failures because fixture DB_PATH is under /tmp. Other failures: shadow provider expected mock and build_study_steps missing.

## R4 corrections committed
- apps/mobile/tsconfig.json: moduleResolution bundler.
- .github/workflows/security-gate.yml: --basetemp moved to /home/runner/.cache/vantdomus-pytest to satisfy persistent path validator in isolated test harness; production validation not weakened.
- Correctness of these changes requires a subsequent full CI run; do not label PASS without results.

## Database and deployment checkpoint
- Neon project solitary-dawn-70172559, validation branch br-broad-poetry-aksbxhbf: 57 public tables, 0 with RLS, 0 with FORCE RLS, no policies.
- Foreign keys query returned 0; ownership/isolation therefore requires explicit schema mapping and negative tests.
- No restricted runtime role.
- Railway patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368 still 124 STAGED changes; do not deploy without cost authorization.
- Pull request #2 remains DRAFT, without merge.

## Blockers and next steps
1. Verify current PR HEAD GitHub Security Gate; classify remaining failures.
2. Investigate expected mock mode and missing build_study_steps without substituting unrelated application architecture.
3. Map complete 57-table RLS, including tables lacking tenant columns and auth bootstrap. Use trusted per-request authentication and transaction-scoped context, no BYPASSRLS and no USING(true).
4. Validate two households, two organizations, role privileges and missing/forged context in isolated Neon before changing main.
5. Complete physical cross-device tests only after security and staging approvals.

## Capsule of rehydration
DOMI R4: web, secret scan, mobile installation and existing tenancy suite achieved PASS in historical run 38076855961; full CI FAILED. TypeScript configuration and CI test fixture location subsequently corrected in PR #2, verification pending. Neon still 57/57 tables and RLS 0/57. Railway staged and un-deployed.

## Exact Prompt Restart
Resume DOMI at R4 in repository majofreasenjo-jpg/Vantdomus, PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Inspect latest commit Actions status and fix remaining backend functional failures and mobile typecheck. Keep secrets scanning enabled. Create the per-table 57-table least-privilege RLS mapping with verified transactional authenticated context, and test cross-household denials. Never use neondb_owner as runtime. Do not merge or deploy Railway without cost authorization. Maintain append-only evidence, capsule and exact restart.
