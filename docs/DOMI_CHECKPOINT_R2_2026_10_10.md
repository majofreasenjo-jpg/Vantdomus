# DOMI — checkpoint R2 (append-only)
Date: 2026-10-10
Previous: DOMI_NEON_PG_SECURITY_GATE_R1

## Verified state
- Neon project solitary-dawn-70172559; branch br-broad-poetry-aksbxhbf.
- 57 public base tables, 0 RLS-enabled and 0 RLS policies, owner neondb_owner; runtime role not provisioned.
- Neon staging-validation branch separate from main.
- Railway project e307117a-da82-4eb0-8545-1334825328be, staging environment 901c8c0c-ee6a-43de-a6da-76c59e444e7f, patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368: 124 STAGED changes. No services deployed.
- PR #2 is draft. Historical workflow 38060803848: web SUCCESS, backend FAILED at secret scan, mobile FAILED at npm ci.
- Six secret-scan hits: docs/HANDOFF_TO_CLAUDE_CODE.md (1), docs/DOMI_P5_STAGING_PROVISIONING_OPERATION_ORDER_V0_1_2026_10_01.md (1), tests/test_family_pilot_runtime_profile.py (1), tools/windows/Setup-LocalDev.ps1 (3).
- Mobile package-lock.json missing expo-secure-store and requires npm-generated verified lock metadata.

## R2 changes
- PostgreSQL adapter no longer prints SQL text or parameters on query exceptions.
- Startup gate now rejects a zero-policy RLS schema. This is necessary but not sufficient for tenant isolation.
- Added fake-database regression test for empty policy catalog.
- A provisional mobile lockfile edit with unverified integrity was reverted; original lockfile preserved.

## Open gates
- Critical: Application SQL uses a shared connection in deps.py without verified authenticated tenant binding in transaction context. Do not deploy with fabricated permissive RLS policies.
- Create a least-privilege login, explicit per-table permission strategy and complete row policy mapping for all 57 tables.
- Add authenticated user/org/household context transactionally and negative two-tenant tests, including forged IDs and no-context access.
- Classify and fix all six secret-scan hits without disabling the detector.
- Regenerate the mobile lockfile from npm and verify npm ci, typecheck and audit.
- Obtain terminal PASS for GitHub Security Gate and live PostgreSQL checks.
- Railway remains staged pending user authorization of costs.

## Invariants
No production mutation; no privileged runtime login; no simulated PASS; no real private data; no deployment without explicit cost authorization.

## Exact Prompt Restart
Retake DOMI PR #2 on branch domi-neon-staging-pg-startup-gate-20261010 and checkpoint DOMI_CHECKPOINT_R2_2026_10_10. Inspect newest Security Gate run and preserve prior migrations. Fix the six secret findings and regenerate the mobile lockfile using trusted npm metadata. Build and prove complete RLS isolation on Neon validation branch, with an unprivileged runtime role and two-tenant adversarial tests. Never merge or deploy while any gate is failing. Keep Railway patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368 staged until the owner expressly authorizes costs. At the end, append a new checkpoint, rehydration capsule and exact prompt restart.
