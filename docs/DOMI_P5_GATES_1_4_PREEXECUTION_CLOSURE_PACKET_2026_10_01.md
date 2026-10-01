# DOMI P5 — Gates 1–4 Pre-Execution Closure Packet

DATE=2026-10-01
MODE=NON_DESTRUCTIVE_PRE_EXECUTION
BRANCH=domi-p5-staging-provisioning-preauth

## Decision

The critical path 1 -> 2 -> 3 -> 4 is now reduced to explicit external-resource
dependencies. No existing EDIS/GOC database is eligible for reuse.

## Gate 1 — Dedicated DOMI staging database

STATUS=BLOCKED_EXTERNAL_PROVISIONING

Code readiness:
- PostgreSQL driver is pinned: psycopg2-binary==2.9.10.
- DATABASE_URL is supported.
- TLS is forced with sslmode=require when absent.
- migrations are embedded through 287_family_music_links.sql.
- memory visibility and memory-library metadata migrations are present.

Physical PASS requires:
- a NEW dedicated DOMI database/project;
- exact project/ref + region;
- DATABASE_URL stored only as a staging secret;
- full migration replay PASS;
- schema fingerprint/receipt;
- proof that EDIS/GOC projects were not mutated.

Important implementation risk:
The migration adapter in db.py is a SQLite-to-Postgres compatibility layer and
contains heuristic SQL translation. Therefore Gate 1 cannot be declared PASS
from source inspection alone; the complete migration set MUST be exercised
against the dedicated Postgres staging database.

## Gate 2 — FastAPI staging backend

STATUS=BLOCKED_EXTERNAL_PROVISIONING

Code readiness:
- Railway config exists at apps/api/railway.toml.
- Nixpacks builder selected.
- start command binds uvicorn to Railway PORT.
- restart policy is ON_FAILURE, max 3.
- /health returns service/version.
- application startup runs security validation, schema migration and tenant backfill.

Physical PASS requires:
- isolated backend service;
- exact source SHA;
- successful boot;
- /health HTTP 200;
- runtime fingerprint;
- connection only to Gate-1 database.

Railway account/service is not currently connected to the available toolset.
No service was created or modified.

## Gate 3 — Staging secrets/configuration

STATUS=CONTRACT_READY_EXTERNAL_VALUES_MISSING

Staging runtime fails closed unless at minimum the configured controls include:
- strong JWT secret;
- strong MFA key(s);
- ClamAV mode;
- Redis rate limiting + Redis URL;
- encrypted backup key;
- security alert webhook + signing secret;
- explicit HTTPS CORS;
- public uploads disabled;
- HTTPS public URL;
- explicit allowed hosts;
- SMTP configuration;
- AI provider secret requirements when AI features are enabled.

No raw secret belongs in Git, evidence receipts, logs or client-side public vars.

Physical PASS requires secret scan + startup preflight + redacted configuration
receipt.

## Gate 4 — Authenticated web -> API

STATUS=BLOCKED_BY_GATES_1_3

Existing Vercel vantdomus-family-pilot is READY and remains the web candidate.
No environment or deployment mutation was performed in this audit.

Physical PASS requires:
- staging API URL bound server/client-side as designed;
- successful authenticated request;
- invalid token -> DENY;
- revoked session -> DENY;
- CORS/host policy PASS;
- web deployment ID + API deployment ID + source SHA captured in receipt.

## Exact next external dependencies

1. Owner selects/authorizes the dedicated Supabase organization/project cost
   envelope before creation.
2. Railway connection is required before its existing subscription/projects can
   be inspected or a staging backend can be provisioned.
3. Resend/SMTP and alert endpoint remain external dependencies for the strict
   staging profile.
4. Redis + ClamAV + backup failure-domain resources remain required by current
   staging security validation.

## Authority wall

AVANCEMOS != P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1

PRODUCTION_MUTATION=FALSE
EXISTING_RESOURCE_REPURPOSE=FALSE
EXISTING_RESOURCE_DELETE=FALSE
REAL_OWNER_MEMORY_ADMISSION=FALSE
EXTERNAL_USERS=FALSE

## Gate status

G1_DB=BLOCKED_EXTERNAL_PROVISIONING
G2_API=BLOCKED_EXTERNAL_PROVISIONING
G3_SECRETS=CONTRACT_READY_EXTERNAL_VALUES_MISSING
G4_WEB_API_E2E=BLOCKED_BY_G1_G2_G3

No gate was promoted without physical evidence.
