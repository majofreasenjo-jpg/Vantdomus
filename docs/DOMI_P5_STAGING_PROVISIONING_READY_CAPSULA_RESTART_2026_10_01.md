# DOMI P5 — Provisioning-Ready Cápsula / Exact Prompt Restart

DATE=2026-10-01

```text
CURRENT=P5_STAGING_PROVISIONING_READY_PACKET_AUTHORED

BASE_RESOURCE_SELECTION_COMMIT=5a8019a3ce09b665cdce6b1a165317a6f639ce30

TARGETS:
WEB=domi-staging-web / Vercel isolated staging
DB=domi-staging / dedicated Supabase / preferred sa-east-1
API=domi-staging-api / Railway candidate
REDIS=domi-staging-redis / Railway candidate
CLAMAV=domi-staging-clamav / Railway candidate
SMTP=domi-staging-mail / Resend candidate
ALERTS=domi-staging-security-alerts
BACKUP_PRIMARY=domi-staging-backup-primary
BACKUP_OFFSITE=domi-staging-backup-offsite

CONNECTED:
VERCEL=YES
SUPABASE=YES
RAILWAY=NO
RESEND=NO

RESOURCES_CREATED=FALSE

EXACT_PROVISIONING_AUTHORIZATION_MARKER=
P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1

GENERIC_AVANCEMOS_DOES_NOT_PROVISION=TRUE

STAGING_DEPLOYMENT_AUTHORIZED=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY_FOR_STAGING=FALSE
EXTERNAL_USERS=FALSE
IOS_SAFARI=PAUSED
```

After the exact provisioning authorization marker:
1. recheck connections/pricing;
2. create resources only from the frozen packet;
3. never place secrets into GitHub/receipts/chat;
4. freeze redacted provisioning receipts;
5. stop before staging deployment and request its separate authorization.
