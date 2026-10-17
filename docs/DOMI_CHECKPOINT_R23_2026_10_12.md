# DOMI R23 — restricted login role split · 2026-10-12

## Verified baseline
R22 Security Gate #186 (38276466742) SUCCESS: 41 PostgreSQL pilot tests passed, backend/web/mobile PASS, web npm audit 0. Existing GitHub draft PR #2 was not merged.

## R23 actual code
- Commit a240f02ae604ab3fa2893e87012c679b7d0868a1: disposable PostgreSQL fixture introduces domi_auth_session_issuer, revokes authentication mutation functions from domi_auth_lookup and explicitly grants the issuer only.
- Commit 73300e2bcc7338faa0598a86c4551d220d9f311c and subsequent changes: the pilot now tests role separation with direct PostgreSQL role logins and adapts issuer operations. Suite defines **46 tests** (41 previous plus 5). Current suite outcome **NOT YET OBSERVED**.
- Commit 04b38147be89380afe8f0fbfc7a488c4a2ced666: PG login uses distinct lookup vs. issuer connections and commits its writes on issuer.
- Commit 2f0008b33eb8a1abbe73cec158e79fcf9790b73d: two mandatory separate SQL DSNs, same database target, with session_user checks; still disabled by default.
- Commit 62f2f5d5c5a6d996d61acbe6229309204d1c4673: FastAPI /auth/login passes both connections. SQLite behavior preserved.
- Other test fixture updates: 8edf6c608d47abaf5152100d2ae70c43e620c739 and af0845759d839c2db382402ce9b8077205159b93.

## Explicit security limitations
- This implementation is not approved for real Owner Beta. Two SQL identities reduce privilege concentration but the issuer helper can still create arbitrary synthetic DB sessions without user-bound cryptographic proof; JWT signing secret and access must remain strictly server-only.
- The pilot stores synthetic timestamps as PostgreSQL timestamptz, while Neon real uses text dates and integer MFA flags. The fixture must NEVER be deployed as a real Neon migration.
- Authentication invite, reset, MFA management, logout/revoke and security-event audit parity are incomplete under restricted PG roles.
- Real Neon validation: 57 tables, 0 RLS, 0 FORCE, 0 policies (last inspected); Neon main untouched. Railway still STAGED, no deploy.
- PR #2 remains DRAFT and must not merge until required gates pass.

## Next gates
1. Observe new Security Gate CI for R23 head and especially all 46 tests, repair any failure without removing tests.
2. Validate same-host issuer/lookup DSNs and privileges via negative tests; add proof-bound issuer capability (rather than solely raw user ID) before real deployment.
3. Fully port the missing auth flows with least-privileged functions, security-event audit and proper real-table date encoding.
4. Apply data-specific RLS on Neon isolated validation branch and run adversarial cross-household tests; only then enable controlled staging with user-authorized costs.
5. Owner authenticated memory and real computer-phone continuity.

## Cápsula de rehidratación
DOMI_R23_AUTH_LOOKUP_ISSUER_SPLIT_20261012: R22 baseline 41/41 PostgreSQL PASS; R23 implemented as a sequence of GitHub commits, 46 tests in source; new CI not certified. Neon RLS 0/57; Railway undeployed; personal Owner Beta real memory not live.

## Exact Prompt Restart
Retoma DOMI en PR #2 de majofreasenjo-jpg/Vantdomus, rama domi-neon-staging-pg-startup-gate-20261010, desde DOMI_R23_AUTH_LOOKUP_ISSUER_SPLIT_20261012. Primero verifica el último Security Gate, exige 46 pruebas PostgreSQL en vivo más backend/web/mobile PASS y web npm audit 0. Si falla, repara errores auténticos, conserva todos los controles. Especialmente comprueba que ambos roles auth tengan privilegios excluyentes y que sus conexiones nunca apunten a otra base. Luego protege el contrato emisor con prueba vinculada al usuario, integra login/MFA/reset/logout/invitaciones y auditoría. Solo después aplica RLS de las 57 tablas de Neon en su rama de validación, nunca main. No despliegues Railway ni generes costos sin autorización; conserva documentación append-only.
