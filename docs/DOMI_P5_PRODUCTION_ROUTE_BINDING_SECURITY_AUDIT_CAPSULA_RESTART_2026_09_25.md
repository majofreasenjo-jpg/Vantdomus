# DOMI P5 — Route-Binding Security Audit Cápsula / Exact Prompt Restart

DATE=2026-09-25

## CÁPSULA DE REHIDRATACIÓN

```text
CURRENT=P5_PRODUCTION_ROUTE_BINDING_SECURITY_AUDIT_AUTHORED_PENDING_CI

BASE_VALIDATED_ADMISSION_SPEC=
19f8ab559ff5e0ce7a7bf0a8453db2a7a67cc645

WORK_BRANCH=
domi-p5-production-route-binding-security-audit

RECOMMENDED_ARCHITECTURE=
KEEP_OWNER_ALPHA_HARNESSES_PREVIEW_ONLY
+
CREATE_SEPARATE_AUTHENTICATED_OWNER_SCOPED_PRODUCTION_SURFACE

PRODUCTION_ROUTE_BINDING=HOLD
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY=NOT_STARTED
EXTERNAL_OUTREACH_AUTHORIZATION=FALSE

IOS_SAFARI=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
```

## EXACT PROMPT RESTART

RETOMA VANTDOMUS / DOMI DESDE:
`P5_PRODUCTION_ROUTE_BINDING_SECURITY_AUDIT_AUTHORED_PENDING_CI`

Preserva la especificación de admisión sellada en:
`19f8ab559ff5e0ce7a7bf0a8453db2a7a67cc645`

The audit found reusable positive controls in the existing authenticated proxy/session/CSRF/no-store architecture, but current owner-alpha P5 harnesses are not a production route surface.

Do not promote owner-alpha harness routes directly.

After CI/Preview certification of the audit, proceed to:
`P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT`

That next track may author a non-production deterministic contract and tests for authenticated identity, owner scope, tenant scope, no-store, rate limit, audit/security events and stop authority. It must not deploy or mutate production.

Keep iOS Safari paused, real owner memory not started, production mutation false, and external outreach unauthorized.
