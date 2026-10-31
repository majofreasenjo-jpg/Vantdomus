# DOMI R22 — PostgreSQL login via restricted auth role (append-only 2026-10-12)

Predecessor: DOMI_CHECKPOINT_R21_2026_10_12.md.

## Evidence at beginning
- GitHub Security Gate #185, run 38271305632, conclusion SUCCESS. Backend/web/mobile/PostgreSQL all SUCCESS. Web required npm audit reported **found 0 vulnerabilities**. R21 patch is certified.
- Vercel Preview of checkpoint R21 dpl_FKwikFLKoLDLo6waDFY6ZxTPGe5H observed QUEUED, despite ready timestamp in metadata. Do not claim actual READY/HTTP 200 on R21 without verifying.
- PR #2 remained draft. Neon validation last observed 57 public tables, 0 RLS policies, Railway 124 STAGED, no paid deploy.

## R22 change
- Added apps/api/app/pg_auth_connection.py: an opt-in only (DOMI_ENABLE_PG_AUTH_LOGIN=1) separate PostgreSQL auth login role, with same host/database checks, mandatory TLS, session_user/current_user and no-admin/no-BYPASS guard. Missing/unsafe configuration returns 503 without secrets. SQLite get_login_db reuses existing behavior.
- Real /auth/login FastAPI route uses the new dependency and calls login_postgres() on the PostgreSQL-only branch. JSON body is mandatory for PG; no passwords in URL query strings.
- Extended pg_auth_bootstrap.py to execute a real bcrypt password check, bounded attempts, existing TOTP/MFA or single-use recovery, tightly restricted SQL issue_session, JWT signing and transaction commit. The existing SQLite login path remains unchanged.
- Disposable CI SQL fixture adds issue_session and conditional MFA secret rotation as security-definer functions owned by a non-login, non-BYPASS role. No direct INSERT/SELECT of private session table granted to either runtime or auth login.
- Added 7 adversarial PostgreSQL tests of direct insert denial, unauthorized issuance, disabled/invalid expiry, real Python login session/JWT against RLS context, bad password, MFA challenge and throttle. Total R22 PostgreSQL pilot = 41 tests.
- CI disposable PostgreSQL job installs FastAPI/JWT/MFA dependencies to execute the actual application Python login code, not only a synthetic SQL mock.
- R22 is a CI candidate: no PASS claimed until run and logs verified.

## Outstanding security gates
- This login path is disabled by default and must not be enabled against Neon: auth helper SQL currently exists ONLY in disposable PostgreSQL fixture, not on the real Neon branch.
- Other auth routes still directly access private tables: invitation/registration, email verification, reset/change password, MFA setup/disable/regen, logout/revoke/sessions listing. A full least-privilege migration and E2E test is required before Owner Beta real-data use.
- Security event hash-chain audit integration for the PostgreSQL auth connection is not yet connected; signed login attempts are recorded, but audit parity with existing SQLite event ledger is not certified.
- Role compromise of domi_auth_lookup could invoke issue_session; protect as server-only secret, separation of duties, strong login audit, restricted networking, and rotation before any operational use.
- Neon real validation 57 tables still lacks RLS last observed. The R22 SQL uses synthetic PostgreSQL timestamptz columns and MUST NOT be replayed into real Neon TEXT date columns.
- No modification Neon main, no merge, no Railway deployment or cost authorization.

## Cápsula de rehidratación
DOMI_R22_REAL_PG_LOGIN_OPTIN_20261012 | R21 Security Gate #185 PASS and web npm audit 0. R22 real FastAPI PG login path implemented behind explicit opt-in, 41 PostgreSQL tests pending CI. Real Neon RLS 0/57, Railway STAGED, memory personal not yet authorized.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R22_REAL_PG_LOGIN_OPTIN_20261012 en GitHub majofreasenjo-jpg/Vantdomus PR #2, rama domi-neon-staging-pg-startup-gate-20261010. Comprueba nuevo Security Gate, exige PostgreSQL piloto 41 PASS y backend/web/mobile PASS con npm audit cero. Corrige errores genuinos sin eliminar controles, conservando SQLite. Después implementa funciones con privilegios mínimos para MFA, invitaciones, recuperación, logout y auditoría, migradas a columnas reales de Neon y testeadas en rama br-broad-poetry-aksbxhbf antes de habilitar DOMI_ENABLE_PG_AUTH_LOGIN. No tocar Neon main, fusionar PR ni desplegar Railway hasta autorización explícita de costos y seguridad. Mantener bitácora append-only, cápsula y Exact Prompt Restart.
