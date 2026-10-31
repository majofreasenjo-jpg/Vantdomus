# DOMI R21 — security-gated Owner Beta dependencies (append-only, 2026-10-12)

## Observed baseline
- PR #2 draft on branch domi-neon-staging-pg-startup-gate-20261010.
- R20 Security Gate #183, run 38205343922: **FAILURE**. Backend, mobile and PostgreSQL PASS; web build/typecheck/postbuild PASS; required production npm audit FAILED.
- Web audit identified 6 vulnerabilities: 1 critical, 4 high, 1 moderate. Directly in the resolved tree: next 16.2.6, postcss 8.5.10, sharp 0.34.5, nanoid 3.3.11, source-map-js 1.2.1, baseline-browser-mapping 2.10.25.
- R20 Vercel Preview deploy dpl_9NdUYSoPwUCrG2dxW3HqdmMPnCra READY despite CI failure. This is NOT a release approval.
- Owner Beta R18 previously passed protected HTTP 200 with synthetic data. No physical owner-browser or authenticated-memory acceptance.
- Neon real RLS last verified 0/57; Railway 124 STAGED, no deploy. Main untouched.

## R21 implementation
- Implementation commit 1626c24f666646f52bbca41bb9ebe1be412e90a4.
- Upgraded exact web Next.js 16.4.0; postcss 8.5.23; sharp 0.35.5; nanoid 3.3.18; source-map-js 1.2.2; baseline-browser-mapping 2.11.20; @swc/helpers 0.5.23.
- Reconciled package lock with **45** verified npm registry metadata records including Next compiler variants, Sharp/Libvips platform binaries, wasm and associated runtime. Did not invent tarball integrity hashes.
- Preserved the required web high/critical npm audit gate and added a version/security transitive-lock test (baseline test total 4).
- No feature behavior or auth/data access change and no deliberate production deployment.
- R21 CI and Vercel Preview outcome pending until observed. DO NOT claim audit cleared before reading live audit report. Critical risk remains if audit fails.

## Owner acceptance roadmap
1. GitHub CI: backend/web/mobile/postgres all PASS; npm audit --omit=dev --audit-level=high must pass (not advisory). Inspect failures and remediate.
2. Vercel Preview READY for exact R21 SHA and protected HTTP 200 /owner-beta. Owner physically tests PC and phone with synthetic data.
3. Complete real auth bootstrap (login, MFA, reset, invites, sessions) with restricted roles and 57-table Neon RLS in isolated validation branch; prove positive/negative tenant tests before real owner-data access.
4. Railway staging only after explicit spending authorization, then persistent owner memory E2E and physical PC-phone handoff plus 48h trial.

## Cápsula de rehidratación
DOMI_R21_WEB_SECURITY_AUDIT_REPAIR_20261012 | R20 CI #183 FAIL web required audit (6 vulnerabilities). R21 upgraded 45 registry-verified package entries and added patched dependency tests; new CI pending. Neon 0/57 RLS; Railway STAGED; owner memory real NOT READY.

## Exact Prompt Restart
Resume VANTDOMUS/DOMI from DOMI_R21_WEB_SECURITY_AUDIT_REPAIR_20261012 in GitHub majofreasenjo-jpg/Vantdomus PR #2 branch domi-neon-staging-pg-startup-gate-20261010, implementation commit 1626c24f666646f52bbca41bb9ebe1be412e90a4. Inspect the newest GitHub Security Gate, particularly the now mandatory production web npm audit and Next.js 16.4.0 build. If any fail, fix their real cause (including package-lock reproducibility) without removing tests, pinning insecure versions or relaxing the audit. Verify Vercel Preview exact commit and protected HTTP /owner-beta. Then implement least-privilege FastAPI auth bootstrap and 57-table Neon RLS in validation branch only, then physical Owner beta with memory after explicit Railway cost consent. Never touch Neon main, merge draft PR or deploy Railway without authorization. Update append-only bitácora/capsule/restart.
