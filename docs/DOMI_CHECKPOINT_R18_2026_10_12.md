# VANTDOMUS / DOMI — R18 Owner Beta strict synthetic security (append-only)
Date: 2026-10-12 | Predecessor: DOMI_CHECKPOINT_R17_2026_10_11.md

## Observed evidence from exact R17 commit
- GitHub PR #2 head `764756f349b6c302368a55330417d2cc28a3f1de` draft.
- GitHub Security Gate #179, run 38197423942: backend, web, mobile, postgres-rls-pilot SUCCESS. Owner Beta static 4/4 tests PASS.
- Vercel project vantdomus-family-pilot Preview deployment `dpl_7g5uPmdV3WvDxx8p3M99kCTmo5QT`: READY for exact R17 SHA. Owner Beta Preview URL: https://vantdomus-family-pilot-4jqfe5j8t-majofreasenjo-jpgs-projects.vercel.app/owner-beta
- Vercel project ssoProtection enabled for non-custom domains. Public web fetch cannot access this URL, so interactive browser inspection NOT YET VERIFIED; do not claim phone/PC acceptance.
- Web GitHub Action #179 recorded dependency audit warnings with exit 1 (Next.js security advisories), though the workflow job was marked SUCCESS (advisory step). The product is NOT security cleared for external users or real data.
- Neon validation last observed: 57 public tables, 0 RLS policies. Railway STAGED 124 changes, no deployment.

## Material defect identified in R17
The shared DomiCompanionHome component always requested browser geolocation and attempted /api/weather. Its voice control could record audio and send it to the backend transcriber, even when dataState=demo. Its proposal and logout actions could call real API/auth routes. This violated the strong R17 claim that Owner Beta is a fully synthetic, no-sensitive-I/O view.

## R18 code change — no production behavior modification
- New opt-in component prop demoSafe, default false.
- Owner Beta explicitly sets dataState=demo and demoSafe=true, with no household id.
- In strict synthetic mode: geolocation is never requested; weather API never called; microphone/voice upload is blocked before capture; backend proposal actions denied; login/logout controls are not rendered. Existing real authenticated route remains unchanged (demoSafe false).
- Four new static negative contract tests added to existing postbuild, without removing R17 tests.
- User-facing Owner Beta continues to warn not to enter private data. Synthetic demo still only demonstrates local intents and in-memory memory simulation, not persistent real memory nor physical handoff.

## Next gates
1. Verify R18 CI including 8 Owner Beta static tests and Vercel Preview READY exact commit. If failure, inspect and repair. Do not share R18 URL as certified before readiness.
2. Physically open Preview in Owner's desktop and phone browsers through normal Vercel SSO; test chat, memory, corrections and scrolling. This is a real device acceptance step requiring the Owner interaction; never infer it from deployment READY.
3. Restrict deployment's currently advisory Next.js dependency security issues before any personal-data staging. Audit patched versions and upgrade with full regression.
4. Close FastAPI auth bootstrap, tenant role and Neon validation RLS for all 57 tables; then authenticated Owner memory with rollback and staging only on explicit spending authorization.
5. Computer-to-phone physical continuation, revocation/expiration and 48h Owner dogfood.

## Cápsula de rehidratación
DOMI_R18_STRICT_SYNTHETIC_OWNER_BETA_20261012 — R17 CI #179 PASS / Vercel Preview READY; R18 disables geolocation, microphone, proposal API and auth navigation ONLY in strict synthetic Owner Beta. R18 CI pending. Real personal beta not live, Neon RLS 0/57, Railway not deployed.

## Exact Prompt Restart
Resume DOMI at DOMI_R18_STRICT_SYNTHETIC_OWNER_BETA_20261012 on GitHub majofreasenjo-jpg/Vantdomus PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Check latest Security Gate and R18 strict-synthetic tests, then Vercel deployment matching exact SHA and SSO-protected /owner-beta. The Owner should personally test on PC then phone using synthetic text only. Address Next.js npm audit advisories before admitting private data. Continue restricted login/MFA/reset/session integration and 57-table Neon RLS in validation branch, no main changes. Railway STAGED, no paid deployment or PR merge absent explicit authorization. Append bitácora, cápsula and Exact Prompt Restart.
