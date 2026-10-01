# DOMI P5 — Staging Resource Selection and Provisioning Plan

DATE=2026-10-01
TRACK=P5_STAGING_RESOURCE_SELECTION_AND_PROVISIONING_PLAN

CURRENT=P5_STAGING_RESOURCE_SELECTION_PLAN_AUTHORED

## 1. What has now closed

The provider-neutral configuration manifest is mechanically certified:

```text
MANIFEST_COMMIT=bbf3e9fc6affaf31ec56cc04e503a263de42c09f
CI_RUN=36866145751
CI_CONCLUSION=SUCCESS

STAGING_CONFIG_MANIFEST_JOB=SUCCESS
SECURITY_EVENT_CHAIN_VERIFIER_JOB=SUCCESS
FULL_P5_CERTIFY_JOB=SUCCESS
```

Therefore the remaining work is not another schema redesign. It is real resource selection and provisioning.

## 2. Current connected infrastructure

### Vercel

Existing connected project:

```text
vantdomus-family-pilot
```

Decision:

Use it as current Preview evidence only. Before real staging execution, create or explicitly designate an isolated staging project/environment with staging-only secrets and immutable deployment receipts.

### Supabase

Two active projects were inspected:

```text
Bases de datos Project — us-west-2 — ACTIVE_HEALTHY
LUXTMENT Commercial OS — sa-east-1 — ACTIVE_HEALTHY
```

Decision:

Do **not** reuse either by assumption.

- `LUXTMENT Commercial OS` is an unrelated business system and should remain isolated.
- `Bases de datos Project` is not canonically designated as DOMI staging.

Preferred target:

```text
DEDICATED_DOMI_STAGING_SUPABASE_PROJECT
```

No project has been created by this track.

## 3. Proposed staging stack

```text
WEB
→ Vercel dedicated staging project/environment

API
→ Railway candidate containerized FastAPI runtime

DATABASE
→ dedicated Supabase Postgres staging project

REDIS
→ Railway managed Redis or equivalent confirmed service

CLAMAV
→ dedicated ClamAV service colocated with API stack

SMTP
→ Resend candidate

SIGNED ALERT RECEIVER
→ dedicated HMAC-verified route on staging API

PRIMARY BACKUP
→ encrypted object storage in staging data plane

OFFSITE BACKUP
→ second-provider encrypted object storage

SECRETS
→ provider-managed secret stores

OPERATIONS
→ named primary operator + backup/escalation owner
```

Railway and Resend are candidates, not yet connected or provisioned.

## 4. Why this topology

The product already has a FastAPI backend, database preflight, Redis health contract and ClamAV health contract. Keeping API + Redis + ClamAV close reduces networking uncertainty while retaining database isolation.

The database should remain a dedicated DOMI staging database rather than sharing an unrelated operational database.

The web remains on Vercel because the existing product, build pipeline and Preview evidence are already working there.

## 5. Provider-selection status

```text
WEB_PROVIDER=Vercel candidate selected
DB_PROVIDER=Supabase candidate selected
API_PROVIDER=Railway candidate pending connection/capability check
REDIS_PROVIDER=Railway/equivalent pending
CLAMAV_PROVIDER=Railway/equivalent pending
SMTP_PROVIDER=Resend candidate pending connection
PRIMARY_BACKUP_PROVIDER=TBD
OFFSITE_BACKUP_PROVIDER=TBD
```

No provider candidate is interpreted as a deployed resource.

## 6. Provisioning sequence

### P-1 Provider connection/capability confirmation

Confirm that the chosen API provider can support:

- containerized FastAPI;
- private environment variables;
- service-to-service networking;
- Redis;
- persistent/reliable ClamAV service or equivalent topology;
- immutable deployment identifiers/logging.

Confirm SMTP provider staging credentials and delivery receipts.

### P-2 Dedicated database

Create a dedicated DOMI staging Supabase project only after provisioning authorization.

Required:

- no reuse of unrelated databases;
- Postgres connection available only to staging API;
- migrations applied from exact candidate;
- synthetic-only seed;
- backup/export path documented.

### P-3 API / Redis / ClamAV

Create:

```text
domi-staging-api
domi-staging-redis
domi-staging-clamav
```

as isolated staging services.

### P-4 Web staging

Create/designate a staging web project/environment and inject only:

```text
VANTDOMUS_DEPLOY_ENV=staging
APP_ENV=staging
NEXT_PUBLIC_API_BASE=https://<staging-api>
```

with forbidden public variables absent.

### P-5 SMTP / alerts

Provision staging-only SMTP.

Create a signed alert receiver that verifies the existing HMAC signature contract.

### P-6 Backups

Primary backup must be encrypted and accompanied by a manifest/checksum.

Offsite backup must be in a separate failure domain/provider.

### P-7 Ownership

Before live staging:

```text
PRIMARY_OPERATOR=ASSIGNED
BACKUP_OPERATOR=ASSIGNED
INCIDENT_ESCALATION_OWNER=ASSIGNED
```

### P-8 Preflight

Run the exact toolchain against redacted staging exports:

```text
security_gate.py
secret_scan.py
web_session_security_lint.py
web_env_preflight.py
production_readiness_report.py
production_preflight.py
```

No `--skip-network`.

## 7. Authorization boundary

This document does not itself authorize resource creation or paid provisioning.

```text
PROVISIONING_AUTHORIZED=FALSE
STAGING_DEPLOYMENT_AUTHORIZED=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY_FOR_STAGING=FALSE
EXTERNAL_USERS=FALSE
```

A provider connection is not authorization to create or bill resources.

## 8. Next safe track

```text
NEXT_SAFE_INTERNAL_TRACK=
P5_STAGING_PROVIDER_CAPABILITY_CONFIRMATION_AND_PROVISIONING_READY_PACKET
```

That packet should freeze the selected providers, expected resource names, region/co-location rules, redacted env map, cost-bearing actions and exact authorization marker required before creating resources.
