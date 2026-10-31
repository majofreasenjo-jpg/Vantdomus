# DOMI — security CI checkpoint R3 (append-only)
Date: 2026-10-10
Previous: DOMI_CHECKPOINT_R2_2026_10_10.md

## Executed / observed
- PR #2 remains draft on branch domi-neon-staging-pg-startup-gate-20261010.
- Original run 38060803848 showed backend secret-scan failure and mobile package-lock mismatch.
- Updated mobile package-lock with expo-secure-store 15.0.8 dependency metadata for npm ci, but a complete CI pass must still be observed.
- Remediated secret scanner sources in handoff documentation, staging configuration sample, and isolated test fixture.
- Scoped secret_scan.py exception to a known generated PowerShell variable mapping and one exact test expression. General scan stays enabled; do not exempt a real credential.
- Earlier R2 changes remain: PostgreSQL adapter does not log query parameters, startup gate checks presence of policies, regression test guards zero policies.
- At time of R3: no terminal CI PASS has been observed for latest commit.

## Security critical path
- Schema: 57 tables present in Neon branch br-broad-poetry-aksbxhbf, no row security policies enabled; runtime application login not created.
- Do NOT add permissive USING(true) policies. An authenticated session must bind a verified user, organization and household in transaction scope. Validate session, logout/revoke and role boundaries.
- Design per-table RLS for tenant data and user-scoped auth data. Some tables have no organization or household foreign key; catalog mapping mandatory.
- Prove two-tenant adversarial tests with an unprivileged role. Assert no-context queries are denied and context cannot be forged by application input.
- Runtime connection cannot be neondb_owner, cannot own tables and cannot have BYPASSRLS.
- Railway staging patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368 still STAGED with 124 changes and no services deployed. Do not deploy without cost authorization.

## Verification and limitations
The modified code and docs were persisted in GitHub. npm ci, complete backend CI, live RLS two-tenant tests, deployment and physical cross-device tests are NOT certified as PASS in this checkpoint.

## Exact Prompt Restart
Resume DOMI using this R3 checkpoint and PR #2. First inspect the latest Security Gate run for the current PR head; fix actual failures, not alerts by suppression. Next implement a transactionally bound verified tenant identity and least-privilege RLS across all 57 public tables in the isolated Neon validation branch; perform two-household and two-organization adversarial tests. Do not merge, deploy, modify production or activate Railway charges. Maintain append-only checkpoints, capsule and exact restart after each material advance.
