# DOMI P5 — Authenticated Owner-Scoped Route Binding Cápsula / Exact Prompt Restart

DATE=2026-09-25

## CÁPSULA DE REHIDRATACIÓN

```text
CURRENT=P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT_AUTHORED_PENDING_CI

BASE_VALIDATED_ADMISSION_SPEC=19f8ab559ff5e0ce7a7bf0a8453db2a7a67cc645
BASE_ROUTE_BINDING_AUDIT=15fd6b0eddd77c51d51e8d467372e50440a31388

ARCHITECTURE=
KEEP_OWNER_ALPHA_HARNESSES_PREVIEW_ONLY
+
SEPARATE_AUTHENTICATED_OWNER_SCOPED_PRODUCTION_SURFACE

OWNER_SCOPE_MODE=SELF_ONLY_V0_1
DELEGATION=NOT_SUPPORTED
REQUEST_MODE=READ_ONLY
STATE_MUTATION=FORBIDDEN

EXECUTABLE_BINDING=FALSE
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY=NOT_STARTED
EXTERNAL_OUTREACH_AUTHORIZATION=FALSE
IOS_SAFARI=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
```

## EXACT PROMPT RESTART

RETOMA VANTDOMUS / DOMI DESDE:
`P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT_AUTHORED_PENDING_CI`

Use branch:
`domi-p5-authenticated-owner-scoped-route-binding-contract`

The contract is a deterministic non-executable specification. It requires authenticated non-revoked session identity, self-owner binding, household membership, household-to-organization match, organization/tenant scope, qualified RC2 cell, no-store, rate limit, audit/security-event receipts and incident STOP authority.

It must not reuse owner-alpha harnesses in production.

Next:
`P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CI_CERTIFICATION`

If CI and Preview pass, certify the contract as a validated specification only. Do not deploy production.

Keep iOS Safari paused; real owner memory, production mutation and external outreach remain unauthorized.
