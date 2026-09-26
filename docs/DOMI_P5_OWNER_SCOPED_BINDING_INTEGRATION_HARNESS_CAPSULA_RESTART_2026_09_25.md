# DOMI P5 — Owner-Scoped Binding Integration Harness Cápsula / Exact Prompt Restart

DATE=2026-09-25

## CÁPSULA DE REHIDRATACIÓN

```text
CURRENT=P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_AUTHORED_PENDING_CI

BASE_VALIDATED_OWNER_SCOPED_CONTRACT=
89240a93f031471e83198d17bf5cb9709bb4f5b0

WORK_BRANCH=
domi-p5-owner-scoped-binding-integration-harness-draft

BACKEND_PRIMITIVES_MAPPED=
session revocation
household RBAC
organization tenancy
audit log
security events
global API rate limiting

NETWORK_CALLS=FALSE
DATABASE_WRITES=FALSE
PRODUCTION_ENDPOINT_CREATED=FALSE
EXECUTABLE_BINDING=FALSE
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE

IOS_SAFARI=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
REAL_OWNER_MEMORY=NOT_STARTED
EXTERNAL_OUTREACH_AUTHORIZATION=FALSE
```

## EXACT PROMPT RESTART

RETOMA VANTDOMUS / DOMI DESDE:
`P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_AUTHORED_PENDING_CI`

Use branch:
`domi-p5-owner-scoped-binding-integration-harness-draft`

The harness maps synthetic receipts from the existing backend primitive contracts into the validated owner-scoped P5 specification. It also fails closed on source-interface drift.

It does not create a production endpoint, make network calls, write a database, use real owner memory or authorize production.

NEXT_SAFE_INTERNAL_TRACK=P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_CI_CERTIFICATION

If CI and Preview pass, certify only the deterministic integration harness. The next phase after that should be staging-readiness design, not production deployment.
