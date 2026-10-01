# DOMI P5 — Provider Capability Confirmation & Provisioning-Ready Packet

DATE=2026-10-01  
TRACK=P5_STAGING_PROVIDER_CAPABILITY_CONFIRMATION_AND_PROVISIONING_READY_PACKET

CURRENT=P5_STAGING_PROVISIONING_READY_PACKET_AUTHORED

## 1. Purpose

Freeze the exact provider/resource plan that will be used when staging provisioning is explicitly authorized.

This packet is the last non-provisioning design step.

It does **not** create paid resources.

## 2. Capability confirmation

### Vercel — web runtime

Confirmed operationally through the existing connected VantDomus project and repeated READY Preview deployments.

Decision:

```text
ROLE=WEB_RUNTIME
TARGET=domi-staging-web
ISOLATION=REQUIRED
CURRENT_PREVIEW_IS_NOT_FULL_STAGING
```

### Supabase — database

The connected account contains active projects, but neither is designated as DOMI staging.

Decision:

```text
ROLE=DATABASE
TARGET=NEW_DEDICATED_PROJECT
NAME=domi-staging
PREFERRED_REGION=sa-east-1
REUSE_EXISTING_PROJECTS=FALSE
```

São Paulo `sa-east-1` is currently available as a specific Supabase region. The final region freeze must still verify latency with the selected API runtime.

### Railway — API / Redis / ClamAV candidate

Public Railway documentation confirms:

- FastAPI deployment from GitHub/Docker;
- private environment-isolated networking;
- internal DNS;
- Redis service/template support.

Target:

```text
domi-staging-api
domi-staging-redis
domi-staging-clamav
```

The Railway account is not connected in this workspace yet, so live account capability, regions and billing cannot be claimed as confirmed.

### Resend — SMTP candidate

Resend remains the preferred lightweight staging mail candidate.

The account is not connected yet, so no SMTP identity/domain/API key exists in this track.

## 3. Region policy

Preferred database:

```text
Supabase sa-east-1 / São Paulo
```

Preferred API:

```text
South America region if available on selected Railway account
```

If co-region placement cannot be obtained, the staging gate must capture measured API↔DB latency before adjudication.

No region assumption is treated as a performance PASS.

## 4. Exact staging names

```text
DB_PROJECT=domi-staging
WEB_PROJECT=domi-staging-web
API_SERVICE=domi-staging-api
REDIS_SERVICE=domi-staging-redis
CLAMAV_SERVICE=domi-staging-clamav
SMTP_IDENTITY=domi-staging-mail
ALERT_RECEIVER=domi-staging-security-alerts
BACKUP_PRIMARY=domi-staging-backup-primary
BACKUP_OFFSITE=domi-staging-backup-offsite
```

## 5. Public cost planning — not a billing commitment

Current public pricing reviewed on 2026-10-01:

- Railway Hobby: USD 5/month minimum with included usage; Pro: USD 20/month minimum with included usage.
- Supabase Pro: USD 25/month, including USD 10/month compute credits sufficient for one Micro instance under current pricing.
- Resend Free: USD 0/month up to 3,000 transactional emails/month and 100/day; Pro currently USD 20/month for 50,000/month.
- Vercel incremental staging cost depends on the existing account/plan and whether a separate project/custom environment is used.
- Backup storage cost remains TBD.

These numbers are planning estimates only and must be rechecked immediately before any cost-bearing action.

## 6. Exact authorization boundary

Resource creation requires the exact marker:

```text
P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1
```

A generic:

```text
avancemos
continue
proceed
```

does **not** create paid resources.

The provisioning marker authorizes only creation/configuration of the staging resources enumerated in this packet.

It does **not** authorize:

```text
production deployment
production mutation
real owner memory
external users
iOS support claims
R3 G11 execution
```

Staging deployment itself remains a later, separate authorization boundary.

## 7. Provisioning sequence after authorization

```text
AUTHORIZATION MARKER
  ↓
RECHECK PROVIDER CONNECTIONS / CURRENT PRICING
  ↓
CREATE DEDICATED SUPABASE domi-staging
  ↓
CREATE API + REDIS + CLAMAV STACK
  ↓
CREATE/DESIGNATE ISOLATED VERCEL STAGING WEB
  ↓
CONFIGURE STAGING SMTP
  ↓
IMPLEMENT SIGNED ALERT RECEIVER
  ↓
PROVISION PRIMARY + OFFSITE BACKUPS
  ↓
LOAD MANAGED STAGING SECRETS
  ↓
RUN CONFIG MANIFEST VALIDATOR
  ↓
RUN SECURITY / INFRA PREFLIGHTS
  ↓
FREEZE REDACTED PROVISIONING RECEIPTS
  ↓
REQUEST SEPARATE STAGING DEPLOYMENT AUTHORIZATION
```

## 8. Current state

```text
PROVISIONING_READY_PACKET=AUTHORED
PROVIDER_TOPOLOGY=FROZEN_AS_CANDIDATE
RAILWAY_CONNECTION=PENDING
RESEND_CONNECTION=PENDING
RESOURCES_CREATED=FALSE

PROVISIONING_AUTHORIZED=FALSE
STAGING_DEPLOYMENT_AUTHORIZED=FALSE
PRODUCTION_DEPLOYMENT_AUTHORIZED=FALSE
REAL_OWNER_MEMORY_FOR_STAGING=FALSE
EXTERNAL_USERS=FALSE
```
