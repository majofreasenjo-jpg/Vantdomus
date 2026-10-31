# DOMI / VANTDOMUS — R5 append-only checkpoint (2026-10-10)

## Source of truth
Previous checkpoint R4: docs/DOMI_CHECKPOINT_R4_2026_10_10.md.
GitHub PR #2: domi-neon-staging-pg-startup-gate-20261010 (draft, do not merge).
Historical Actions run 38081797087: web PASS, backend 342 passed / 2 failed, mobile typecheck FAILED, mobile npm ci PASS, secret scan PASS. 2 backend failures were an obsolete expectation of mock provider with all real gates enabled and a missing build_study_steps function.

## R5 code changes (implementation, NOT verified CI yet)
- apps/mobile/App.tsx imports DarkTheme used by navigation.
- apps/mobile/src/components/Pill.tsx explicitly types composed pill styles as TextStyle[].
- apps/mobile/tsconfig.json adds DOM lib for URLSearchParams typings.
- tests/test_shadow_min33b.py now asserts default mock, guarded explicit real-provider selection, and fake transport without a real network call.
- apps/api/app/routes/tasks.py restores deterministic no-network bounded study-plan steps, keeping the existing adapter and dual-write unchanged; plan_mode is template, not AI. Real AI step generation remains a separate functional gate.

## Remaining limitations
- Mobile errors for process.env typings remain until Node types or local Expo ambient declarations are corrected and tested.
- GitHub latest commit has no completed CI run observed at the time of writing. No PASS should be claimed for R5.
- Neon validation branch br-broad-poetry-aksbxhbf: 57 public tables, 0 RLS policies, no restricted runtime login, no cross-tenant live RLS tests.
- Railway project e307117a-da82-4eb0-8545-1334825328be staging patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368: 124 STAGED changes and no deployed services. No deployment/cost permission.

## Roadmap gates
G-CI: verify new full GitHub Security Gate; address remaining exact errors.
G-PG: verified per-request identity binding, least privilege roles, auditable per-table RLS and 2 household / 2 organization adversarial test.
G-INTEGRATION: safe Neon-Railway role secrets (no owner/BYPASSRLS).
G-PHYSICAL: API runtime and real computer-phone continuity receipts.
G-RELEASE: security, operations and cost signoff.

## Capsule of rehydration
Checkpoint DOMI_R5_CI_FUNCTIONAL_REPAIR_20261010. Changes in PR #2 are applied but CI is not certified. Preserve all R1-R4 migrations and previous test evidence. Prior historical CI proves web and secret scan passed; RLS remains 0/57. Railway stays staged.

## Exact Prompt Restart
Resume DOMI from DOMI_R5_CI_FUNCTIONAL_REPAIR_20261010. First inspect Actions for current PR HEAD and fix all remaining CI failures, including mobile process.env typing. Do not regress mock/real AI gates: default mock; real provider only with explicit flags and secret; no unintended external calls; study planner fallback is deterministic and labeled template. Next implement authenticated transactional per-table RLS with separate restricted database login, on isolated Neon branch only, and run live two-tenant adversarial tests; preserve main and production. Leave Railway 124 STAGED without deploy until explicit cost approval. Keep append-only checkpoint, capsule and exact prompt restart for each material step.
