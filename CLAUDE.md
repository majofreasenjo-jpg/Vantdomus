# CLAUDE.md — DOMI / VANTDOMUS

These are repository-level engineering instructions for a local Claude Code session. Follow the existing code, the canon and the R94 handoff; do not improvise an unrelated product.

## Required reading before changing code

- `docs/DOMI_R94_CLAUDE_CODE_HANDOFF_20261031.md` (R94 assignment, acceptance gates and restrictions)
- `docs/governance/DOMI_CANON_10_SCORECARD_BASELINE_20261019.json` (ten rector axes and evidence gates)
- `docs/DOMI_CHECKPOINT_R92_2026_10_31.md` and the R93 test changes (continuity, no resets)
- Relevant P5 cross-device tests in `apps/web/tests/` and existing backend security tests in `tests/`

## Verified baseline

- R93 base commit `cd28bb4b9112c6c3f168a86a287debd3fc08ed84`.
- Security Gate: `https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41217065337` — success.
- Browser E2E: `https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41217062176` — success.
- Vercel Preview READY is **not** proof of a connected family backend or a physical phone.
- The browser E2E uses disposable SQLite and a simulated mobile-sized browser context.

## Hard boundaries

1. **Synthetic data only**. Never use a real family member, account, memory, medical detail or credential in fixtures. This repository is public; NEVER commit secrets, token-bearing traces, user screenshots or `.env` contents.
2. No production changes, infrastructure spending, billing modifications, Render/Neon reactivation, public network exposure, outreach, provider activation, account invites or cloud migrations without separate explicit owner approval.
3. Keep existing authentication, CSRF, household isolation, PostgreSQL RLS and session revocation controls. Fail closed. No permissive CORS, no binding FastAPI to `0.0.0.0` to bypass a network test, no disabled certificate verification.
4. Preserve the canonical scope of DOMI: 12 constituent organs, longitudinal identity/memory, family/organizational dimensions, development, relationships, legacy, federated specialists, EDIS, Titan and MICR.
5. No fabricated progress or PASS claims. A test run, physical device acceptance, database durability and production approval are distinct evidence levels.
6. Avoid force-push, rewriting prior checkpoints or merging to `main` or the staging branch without review. Keep work on the R94 collaboration branch and open/update a reviewable PR.

## Working method

- First inspect the real repository and repeat CI-relevant tests. State what already exists before adding code.
- Prioritize the R94 blocker: **authenticated, private and physically verifiable PC-to-phone continuity**. Reuse existing P5 transport and household-memory modules, rather than replacing them.
- In the first pass, diagnose local Windows readiness and propose a security-reviewed transport. Do not expose the local API to the LAN or Internet merely to make a phone connect.
- Add end-to-end assertions for authorized cross-device persistence and unauthorized cross-household access. Leave complete, reproducible setup and rollback instructions.
- Keep implementation and tests separated from synthetic fixtures; no hidden side effects or external calls.

## Existing reproducible checks

- Backend local cold restart: `python -m pytest tests/test_domi_r85_cold_restart_family_http.py -q -ra`.
- Web on `apps/web`: `npm ci`, `npm run build`, and targeted `node --test tests/*.test.mjs`.
- Browser flow: `.github/workflows/domi-r88-browser-e2e.yml` (the filename is historical; it now tests R93+ memory lifecycle).
- Security Gate: `.github/workflows/security-gate.yml`.
- Windows local launcher: `tools/windows/Start-DOMI-R86-Local.ps1` (loopback-only; *not* accessible from a real phone).

## Required report on every advance

Provide: exact SHA/branch; modified files; commands and test outputs; blocked/untested/verified status; rollback; privacy/security impact; and **all ten canonical axes D01–D10**, with a percentage only when an explicit canonical gate has new evidence. The established conservative global baseline is 28.5%, unchanged until an authorized gate closes.

Claude Code is a local implementation assistant, not a source of independent certification. The user/maintainer and ChatGPT review the changes and evidence before any promotion.
