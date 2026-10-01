# DOMI P5 — Staging Configuration Manifest Cápsula / Exact Prompt Restart

DATE=2026-10-01

```text
CURRENT=P5_STAGING_CONFIGURATION_MANIFEST_AUTHORED_PENDING_CI

BASE_EVIDENCE_PACKAGE=7bf3c4a12484e58e347fff3f3c9ca9641bb80a72
WORK_BRANCH=domi-p5-staging-config-manifests

MANIFEST=docs/P5_STAGING_CONFIGURATION_MANIFEST_V0_1.json
RECEIPT_SCHEMA=docs/P5_STAGING_REDACTED_RECEIPT_SCHEMA_V0_1.json
VALIDATOR=tools/staging_manifest_validate.py
TESTS=tests/security/test_staging_config_manifest.py

PROVIDER_NEUTRAL=TRUE
RESOURCES_PROVISIONED=FALSE
SECRETS_COMMITTED=FALSE
STAGING_DEPLOYMENT_AUTHORIZED=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY_FOR_STAGING=FALSE
EXTERNAL_USERS=FALSE
```

After CI success, record the manifest certification receipt and move to provider/resource selection. Do not put any real secret into GitHub documents, receipts, tests, or chat.
