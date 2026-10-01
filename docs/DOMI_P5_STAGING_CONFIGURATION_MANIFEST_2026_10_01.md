# DOMI P5 — Provider-Neutral Staging Configuration Manifest

DATE=2026-10-01

## Purpose

Translate the staging evidence package into a provider-neutral provisioning contract without committing any real secret or implying that infrastructure already exists.

## Required substrate

The manifest requires eleven resource classes:

```text
WEB_RUNTIME
API_RUNTIME
DATABASE
REDIS
CLAMAV
SMTP
SIGNED_ALERT_RECEIVER
BACKUP_PRIMARY
BACKUP_OFFSITE
SECRET_MANAGER
OPERATOR_OWNERSHIP
```

Every resource starts as NOT_PROVISIONED / NOT_ASSIGNED.

The manifest intentionally does not pick AWS, Azure, GCP, Render, Railway, Supabase, Upstash, Vercel, or another provider. Provider selection is a later infrastructure decision.

## Secret handling

Secret-class environment keys can appear in receipts only as:

```text
present=true|false
valueHash=sha256:<digest>   # optional
```

Raw values are forbidden.

This applies to:

- DATABASE_URL;
- JWT secret;
- MFA secret;
- Redis URL;
- SMTP user/password;
- alert webhook/signing secret;
- backup encryption key.

Public-browser forbidden fields remain absent or empty:

```text
NEXT_PUBLIC_ACCESS_TOKEN
NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID
```

## Receipt schema

The redacted staging receipt may preserve:

- exact candidate commit;
- sanitized config digest;
- timestamp;
- opaque/redacted provider resource references;
- presence/status of environment keys;
- safe hashes;
- CI/deployment/run IDs;
- gate decisions.

It may not preserve credentials, raw secrets, tokens, real owner memory, transcripts, full state or authority payloads.

## Current adjudication

```text
STAGING_CONFIGURATION_MANIFEST=AUTHORED
PROVIDER_SELECTED=FALSE
RESOURCES_PROVISIONED=FALSE
SECRETS_LOADED=FALSE
STAGING_DEPLOYMENT_AUTHORIZED=FALSE
PRODUCTION_MUTATION=FALSE
```

NEXT=P5_STAGING_RESOURCE_SELECTION_AND_PROVISIONING_PLAN
