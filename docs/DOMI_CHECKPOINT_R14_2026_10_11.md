# DOMI R14 — checkpoint append-only — 2026-10-11

Predecessor: DOMI_CHECKPOINT_R13_2026_10_11.md. Keep all older checkpoints.

## Evidence
- GitHub Security Gate #172 run 38163476850: conclusion FAILURE, but PostgreSQL pilot 20/20 PASS (0.40 s), backend SUCCESS, mobile SUCCESS.
- Web FAILED at Next.js 16.2.4 Turbopack resolution of `next/font/google` in owner-alpha, 35 font-loader errors.
- Verified Neon validation branch br-broad-poetry-aksbxhbf: 57 tables, 0 with RLS, 0 FORCE, 0 policies.
- Railway six staging services have patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368, 124 STAGED changes. No deployment.
- PR #2 is draft, not merged.

## R14 implementation
- In commit 97a505f68f8b08899dfae9163a03e01b927dea78 removed remote build-time font loader calls from app/layout.tsx and owner-alpha/page.tsx, preserving preview-only route authorization.
- Defined established --font-nunito, --domi-font-inter, --domi-font-grotesk, --domi-font-jetbrains variables with local fallback stacks in globals.css.
- Appended web postbuild regression tests for no Google font imports and presence of all font variables, without removing previous build checks.
- The fallback font can differ visually if local named fonts are absent; licensed self-hosting is a later visual parity improvement.
- CI for R14 not yet certified when recorded.

## Holds
- No FastAPI restricted bootstrap implementation for real login, invitation, reset, MFA, email verification; current handlers still perform SQL directly against sensitive tables.
- Pilot's 20/20 PASS does not prove real Neon RLS. Remain 0/57.
- No PR merge, production/main changes or Railway deployment.

## Capsule of rehydration
DOMI_R14_NEXT_FONT_CI_REPAIR_20261011 | GitHub Security Gate #172 failed web only, PostgreSQL 20/20 PASS, backend/mobile PASS. Commit 97a505f68f8b08899dfae9163a03e01b927dea78 fixes source of web build failure by removing next/font/google. Verify newer CI. Neon 0/57 RLS, Railway 124 STAGED.

## Exact Prompt Restart
Resume VANTDOMUS/DOMI from DOMI_R14_NEXT_FONT_CI_REPAIR_20261011 in GitHub majofreasenjo-jpg/Vantdomus PR #2, head after checkpoint. First verify new Security Gate: web build and postbuild font test, backend, mobile, PostgreSQL 20/20. Diagnose and correct any fail. Next create versioned, least-privilege FastAPI auth bootstrap for invitation registration, login, recovery, MFA and email verification, ensuring no broad runtime reads of hashes/tokens and complete adverse tests. Then validate RLS for the 57 real Neon tables on validation branch only. Never merge PR, change main, or deploy Railway until gates are satisfied and cost expressly approved. Update bitácora append-only, capsule and exact restart.
