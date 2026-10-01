# DOMI P5 — Staging Provisioning Operational Order V0.1

DATE=2026-10-01
STATUS=DRAFT_NOT_EXECUTED
BASE_TECHNICAL_COMMIT=fe02f70815a51175651e5f3aabac77a02cd69083
REQUIRED_EXECUTION_MARKER=P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1

## Objective

Provision a fully isolated DOMI staging environment for synthetic P5 integration testing only.

The operation may create only the explicitly named staging resources and must not delete,
rename, overwrite, repurpose, or mutate any pre-existing production, EDIS, GOC/POIEX,
LUXTMENT Commercial OS, VantDomus demo/panel/mobile, or unrelated infrastructure.

## Authorized future scope

- create a new dedicated DOMI database project: `domi-staging`
- create `domi-staging-api`
- create `domi-staging-redis`
- create `domi-staging-clamav`
- create/designate isolated `domi-staging-web`
- create/configure staging-only SMTP identity
- create signed staging security-alert receiver
- create encrypted primary + offsite backup targets
- load staging-only secrets into provider-managed secret stores
- assign primary operator, backup operator, and escalation owner

## Explicitly out of scope

```text
DELETE_EXISTING_RESOURCE=FORBIDDEN
RENAME_EXISTING_RESOURCE=FORBIDDEN
REPURPOSE_EXISTING_RESOURCE=FORBIDDEN
MODIFY_PRODUCTION=FORBIDDEN
USE_EDIS_GOC_DATABASES=FORBIDDEN
USE_REAL_OWNER_MEMORY=FORBIDDEN
ENABLE_EXTERNAL_USERS=FORBIDDEN
PROMOTE_PREVIEW_TO_PRODUCTION=FORBIDDEN
EXECUTE_R3_R4=FORBIDDEN
CLAIM_IOS_SUPPORT=FORBIDDEN
```

## Pre-execution controls

Execution cannot begin unless all are satisfied:

```text
AUTH_MARKER=P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1
MONTHLY_COST_CAP_USD > 0
OWNER_COST_CONFIRMATION=TRUE
SUPABASE_ORG_CONFIRMED=TRUE
SUPABASE_COST_CONFIRMED=TRUE
RAILWAY_CONNECTION_CONFIRMED=TRUE
RAILWAY_COST_CONFIRMED=TRUE
SMTP_PROVIDER_CONFIRMED=TRUE
BACKUP_PRIMARY_PROVIDER_SELECTED=TRUE
BACKUP_OFFSITE_PROVIDER_SELECTED=TRUE
SEPARATE_FAILURE_DOMAIN=TRUE
PRIMARY_OPERATOR_ASSIGNED=TRUE
BACKUP_OPERATOR_ASSIGNED=TRUE
INCIDENT_ESCALATION_OWNER_ASSIGNED=TRUE
```

Otherwise:

```text
DECISION=HOLD_STAGING_PROVISIONING
```

## Required variables

### API/backend non-secret

```text
APP_ENV=staging
VANTDOMUS_ALLOWED_HOSTS=<exact staging API host>
CORS_ALLOWED_ORIGINS=<exact HTTPS staging web origin>
VANTDOMUS_APP_PUBLIC_URL=<HTTPS staging web URL>
VANTDOMUS_API_RATE_LIMIT_MODE=redis
VANTDOMUS_MALWARE_SCAN_MODE=clamav
VANTDOMUS_CLAMAV_HOST=<staging service host>
VANTDOMUS_CLAMAV_PORT=<provider port>
SMTP_HOST=<staging SMTP host>
SMTP_PORT=<provider port>
SMTP_FROM=<staging sender>
VANTDOMUS_ENABLE_PUBLIC_UPLOADS=false
VANTDOMUS_ALLOW_DEMO_SEED=false
VANTDOMUS_ALLOW_NOTIFICATION_TESTS=false
```

### API/backend secret — secret manager only

```text
DATABASE_URL
JWT_SECRET
VANTDOMUS_MFA_SECRET_KEY
VANTDOMUS_REDIS_URL
SMTP_USER
SMTP_PASS
VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL
VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET
VANTDOMUS_BACKUP_ENCRYPTION_KEY
OPENAI_API_KEY   # only when real provider is explicitly enabled
```

### Web

```text
VANTDOMUS_DEPLOY_ENV=staging
APP_ENV=staging
NEXT_PUBLIC_API_BASE=https://<staging-api>
VANTDOMUS_WEB_PROXY_MAX_BODY_BYTES=10485760
VANTDOMUS_WEB_PUBLIC_PROXY_MAX_BODY_BYTES=1048576

NEXT_PUBLIC_ACCESS_TOKEN=ABSENT_OR_EMPTY
NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID=ABSENT_OR_EMPTY
```

## Operational sequence

1. Freeze exact source candidate and configuration template.
2. Create dedicated DOMI staging database only.
3. Apply migrations 000→287 and generate schema receipt.
4. Create backend from exact SHA and prove /health.
5. Create authenticated Redis and prove rate limiting uses it.
6. Create ClamAV service and prove fail-closed scanning path.
7. Configure staging-only SMTP and signed alert receiver.
8. Configure encrypted primary + offsite backups.
9. Create/designate isolated staging web context.
10. Load secrets through provider secret stores only.
11. Run manifest validator + security/readiness preflights.
12. Freeze redacted provisioning receipts and stop before staging deployment authorization.

## Immediate stop conditions

STOP immediately if any of the following occurs:

- provider wants to reuse or overwrite an existing resource;
- cost would exceed the authorized cap;
- requested region unavailable and fallback not explicitly approved;
- any non-benign Postgres migration failure;
- SQLite→Postgres translation incompatibility;
- any secret appears in logs, client bundle, Git or receipt;
- wildcard CORS or wildcard allowed-host policy becomes necessary;
- Redis cannot operate authenticated;
- ClamAV requires fail-open behavior;
- backup cannot be encrypted;
- offsite backup is not a separate failure domain;
- backend health fails;
- staging runtime bypasses security validation;
- any EDIS/GOC/LUXTMENT resource is accessed or mutated;
- real owner memory appears;
- production mutation becomes necessary;
- an existing resource would need repurposing.

On stop:

```text
ACTION=STOP
DECISION=HOLD
NO_AUTOMATIC_WORKAROUND=TRUE
NO_RESOURCE_DELETION=TRUE
NO_REPURPOSING=TRUE
```

## Evidence requirements

Database:
- project/ref
- provider
- region
- migration count
- schema digest
- synthetic read/write PASS
- memory schema PASS
- tenancy schema PASS

API:
- deployment id
- source commit
- runtime version
- health PASS
- startup security PASS
- database binding digest

Redis/ClamAV:
- opaque resource ref
- connectivity PASS
- health PASS
- failure-mode PASS

SMTP/alerts:
- provider ref
- delivery receipt id
- signature validation PASS
- invalid signature REJECT

Configuration:
- key name
- present=true|false
- optional value hash for secret fields
- no raw secret values

Web:
- deployment id
- source commit
- API origin digest
- login surface PASS
- forbidden public token absent

## Approval semantics

Provisioning is PASS only when all required resources exist, no existing resource was
modified, migrations complete, backend boots securely, Redis/ClamAV/SMTP/alerts are
reachable, backups are provisioned, secret scan is clean, evidence is complete, and
critical incidents remain zero.

Provisioning PASS does not imply staging gate PASS, field-beta authorization, or
production readiness.
