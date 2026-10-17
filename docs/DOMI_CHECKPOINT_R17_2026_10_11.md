# VANTDOMUS / DOMI — Owner Beta R17 (append-only) — 2026-10-11

Predecessor: DOMI_CHECKPOINT_R16_2026_10_11.md.
Checkpoint ID: DOMI_R17_OWNER_BETA_PREVIEW_ENTRY_20261011.

## Verified starting status
- GitHub PR #2 remained DRAFT at commit 5a490b9a55b1510ed567f64626b309c1ae30b33d.
- Security Gate #178 run 38174805685: SUCCESS, PostgreSQL pilot 34/34 PASS, backend/web/mobile PASS. Staging smoke skipped.
- Vercel vantdomus-family-pilot Preview deployment dpl_F2JNARjCjKBkoPdFrcwtwwSZgwir READY on the same commit; this proves build only, not personal usage or login.
- Existing Owner Alpha conversation route only admits historical branch domi-owner-live-precheck, not the current PR branch. Root redirects to login.
- Neon validation branch last checked: 57 tables, 0 RLS enabled and 0 policies. No change.
- Railway remains STAGED; no infrastructure deployed.

## R17 code changes and safety contract
- New apps/web/app/owner-beta/page.tsx: preview branch allowlist requires VERCEL_ENV=preview and exact commit ref domi-neon-staging-pg-startup-gate-20261010. Otherwise 404. Search indexing disabled.
- Reuses DomiCompanionHome in dataState=demo with NO household id plus existing OwnerAlphaLongitudinalHarness. No backend real-memory call introduced by this route.
- New scoped visual styles in apps/web/app/owner-beta/owner-beta.css.
- New deterministic contract test tests/domi-owner-beta-preview-access.test.mjs (four tests), appended to existing web postbuild without removing previous tests.
- Human-readable notice: synthetic chat, no personal memory persistence, no physical computer-phone handoff, do not type sensitive/private data.
- Production login route and old Owner Alpha gate unchanged. No Neon schema, Railway or production mutation.

## Owner Beta acceptance roadmap
A. Verify R17 GitHub CI plus Vercel Preview READY at the exact R17 commit before sharing working Preview URL. If protection prevents automated retrieval, authenticated Owner can open it without disabling protection.
B. Owner tests interface and local synthetic memory on computer and phone; this is a Preview demo, not real personalized beta.
C. Close FastAPI auth bootstrap for login, MFA, recovery, registration and sessions with least-privilege role. Apply reviewed per-table RLS to the 57 tables on the isolated Neon validation branch, with adversarial fixtures and rollback.
D. Only after explicit cost authorization connect an API staging instance and prove authenticated owner memory persistence across separate sessions.
E. Prove physical PC-phone handoff, revocation, expiration, privacy minimization and 48h Owner trial.

## Cápsula de rehidratación
DOMI_R17_OWNER_BETA_PREVIEW_ENTRY_20261011: Historical CI #178 PASS, 34/34 synthetic PostgreSQL. New route Owner Beta safe synthetic Preview authored and pending new CI/deploy verification. Real Neon 0/57 RLS. Railway STAGED. Real personal memories are not live.

## Exact Prompt Restart
Resume VANTDOMUS / DOMI from DOMI_R17_OWNER_BETA_PREVIEW_ENTRY_20261011 in GitHub majofreasenjo-jpg/Vantdomus PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Verify exact HEAD Security Gate and the four new owner-beta-preview tests. Check Vercel family-pilot deployment at the same SHA for READY and provide the user the authenticated Preview URL suffixed /owner-beta; do not assume public web access. Distinguish interactive synthetic demo from personal memory beta. Next close full FastAPI restricted auth bootstrap and reviewed 57-table Neon validation RLS, then API staging only with cost authorization. Prove physical PC-phone session handoff before declaring Owner Beta real. Do not modify production, main branch, or Railway; keep append-only bitácora, capsule and Exact Prompt Restart.
