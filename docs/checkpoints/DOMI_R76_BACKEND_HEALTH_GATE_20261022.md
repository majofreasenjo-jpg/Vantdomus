# DOMI R76 — First live backend transport observability gate
Date 2026-10-22 · Canon V2.1 Addenda 31/32 · PR #2 DRAFT

## Evidence and root blocker
- R75 CI run 39797793645 SUCCESS; preview READY.
- Vercel configuration declares NEXT_PUBLIC_API_BASE on production/preview, but the value remains undisclosed. This does not certify service availability.
- Render connector refuses service inspection without explicit Owner confirmation of workspace; no activation/cost changes undertaken.
- No authenticated browser→API→DB→reload→mobile proof. No evidence of family-data E2E operation.
- Read-only non-authenticated FastAPI /health contract returns {ok:true,service:'vantdomus-core',version}. This does not certify database nor auth.

## R76 implementation
- apps/web/app/api/domi-family-backend-check/route.ts adds GET probe only on Preview branch domi-neon-staging-pg-startup-gate-20261010; HTTPS-only configured upstream, fixed /health GET, no redirection, 7s timeout, no secrets/URL/body exposed, no data write.
- apps/web/tests/domi-r76-family-backend-check.test.mjs checks exposure constraints.
- .github/workflows/security-gate.yml includes R76 regression.
- R76 CI/Preview diagnostics NOT VERIFIED at this checkpoint.

## Canon scorecard
D01 Personal 45→45 Δ0, D02 Family 45→45 Δ0, D03 Developmental 25→25 Δ0, D04 Federated 45→45 Δ0, D05 Multisurface 45→45 Δ0, D06 Organizational 10→10 Δ0, D07 EDIS 10→10 Δ0, D08 Legacy 10→10 Δ0, D09 Titans 25→25 Δ0, D10 MICR/Science 25→25 Δ0; Global 28.5→28.5 Δ0. This is transport diagnosis, not terminal capacity.
12 organs unchanged: identity/constitution/self/memory/relationship/epistemic/authority/evidence partial; affective causal pending, presence partial, recovery/multisurface bounded.

## Resume
Check CI for R76 latest SHA, then GET the Preview /api/domi-family-backend-check using Vercel authorized web fetch. Report reachability/timeout/config errors. If backend unreachable, stop before authentication and request confirmation for Render workspace; do not invent a production-ready pilot, restart paid services, expose secrets, or write Neon. If available, next is authorized test login and confirmed purchase persistence in a synthetic family. Every advance reports ten axes and honest evidence.
