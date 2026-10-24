# DOMI R20 — Security baseline upgrade and Owner Beta continuity (2026-10-12)

Append-only. Previous checkpoint: DOMI_CHECKPOINT_R19_2026_10_12.md.

## Evidence
- R18 GitHub Security Gate #180 (38203181584) SUCCESS with backend, web, mobile and PostgreSQL pilot PASS.
- R18 Vercel Preview deployment dpl_B9Zw2BuvWKw7hxmRWsvATVgD8dCd READY; protected HTTP GET /owner-beta returned 200 and correct synthetic SSR markup.
- Audited apps/web package and lock: Next.js 16.2.4 pinned; web npm audit had continue-on-error true despite high/critical advisory output.
- Direct, read-only official npm registry metadata retrieved for Next.js 16.2.6, @next/env and all eight optional SWC binaries. Ten exact SHA512 integrity hashes and associated tarball URLs verified; no invented lock hashes.
- PR #2 remains draft, not merged. Neon main and validation not changed, Railway stays STAGED, no manual deployment.

## R20 implementation — commit c4d2a026b5f8299dbb349d1f64fc4f05f90d7c35
- Updated apps/web/package.json Next.js to exact 16.2.6.
- Reconciled package-lock versions, URLs, SHA512 integrity for 10 packages, plus required @next/env and optional compiler dependency versions; all other lock packages retained.
- Web GitHub Security Gate now treats npm audit --omit=dev --audit-level=high as required: no more continue-on-error on web audit.
- Added 3 postbuild regression tests to prove patched Next version, compiler package alignment and required audit.
- No production code logic, identity, tenant rights, household contents, backend API or runtime secret changed.

## Gate semantics
- New R20 GitHub Actions outcome PENDING at time of initial observation.
- New Vercel Preview deployment dpl_EdNjz58Mie5GcTFpUdp4oZAUp9Sp QUEUED at initial observation.
- Do not claim patched build PASS, audit zero advisories, preview READY or interactive browser acceptance until specifically observed.
- Dependency audit may reveal further independent vulnerabilities. Fix them individually; do not relax security gate merely to obtain PASS.

## Remaining owner acceptance
1. Check GitHub Security Gate and Vercel deployment for exact R20 SHA; inspect any failures.
2. Verify protected GET /owner-beta HTTP 200 from R20 Preview and Owner's actual PC/mobile interaction using synthetic data.
3. Complete backend restricted auth bootstrap and RLS for 57 public tables on Neon validation branch (not main).
4. Deploy Railway staging only with explicit budget consent; verify authenticated persistent memory, cross-session recall, real PC-phone handoff, revocation and 48-hour Owner testing.

## Cápsula de rehidratación R20
DOMI_R20_NEXT_SECURITY_BASELINE_20261012 | R18 Security Gate #180 PASS; R18 protected Preview HTTP 200; R20 upgraded Next 16.2.4 -> exact 16.2.6 and pinned 10 registry-verified integrity hashes; web npm audit required; new CI and Preview pending. Neon RLS 0/57 last checked, Railway STAGED, no real owner memory.

## Exact Prompt Restart R20
Resume VANTDOMUS/DOMI from DOMI_R20_NEXT_SECURITY_BASELINE_20261012 in majofreasenjo-jpg/Vantdomus PR #2 branch domi-neon-staging-pg-startup-gate-20261010, implementation commit c4d2a026b5f8299dbb349d1f64fc4f05f90d7c35. Verify GitHub Security Gate required npm audit + backend/web/mobile/Postgres pilot, and Vercel preview READY for exact SHA; repair real regressions without weakening security. Verify HTTP 200 /owner-beta protected and physically test interactions on Owner PC and phone with synthetic examples only. Next implement secure auth/MFA/recovery/session and RLS 57-table policies on Neon validation branch, not main. Railway remains STAGED until explicit cost authorization; do not merge PR or deploy to production. Preserve append-only bitácora, capsule and Exact Prompt Restart.