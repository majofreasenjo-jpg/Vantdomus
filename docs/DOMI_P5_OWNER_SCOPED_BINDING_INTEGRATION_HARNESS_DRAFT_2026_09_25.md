# DOMI P5 — Owner-Scoped Binding Integration Harness Draft

DATE=2026-09-25
PROJECT=VANTDOMUS_DOMI
TRACK=P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_DRAFT

CURRENT=P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_AUTHORED_PENDING_CI

## 1. Objective

The validated owner-scoped route-binding specification is now mapped onto the backend primitives that already exist in VantDomus.

This is a deterministic **non-production integration harness**. It performs:

```text
networkCallsPerformed=FALSE
databaseWritesPerformed=FALSE
productionEndpointCreated=FALSE
```

It does not create an API route or production surface.

## 2. Backend primitive map

The harness verifies the presence of these source-level primitives:

```text
SESSION / REVOCATION
apps/api/app/deps.py
get_current_user
decode_access_token
auth_sessions
token_jti
revoked_at

HOUSEHOLD RBAC
apps/api/app/rbac.py
require_household_role
household_memberships
ROLE_RANK

ORGANIZATION TENANCY
apps/api/app/tenancy.py
get_household_organization_id
households.organization_id

AUDIT
apps/api/app/audit.py
write_audit_log

SECURITY EVENTS
apps/api/app/security_events.py
write_security_event
metadata redaction
hash-chain support

GLOBAL RATE LIMIT
apps/api/app/main.py
apps/api/app/rate_limit.py
api_rate_limit
check_rate_limit
429 / Retry-After / security-event emission
```

## 3. Integration semantics

Synthetic backend receipts are mapped into the already validated contract.

A complete synthetic fixture may reach:

```text
INTEGRATION_HARNESS_PASS_BOUNDED_NON_EXECUTABLE
```

only when:

- backend primitive source map is intact;
- session is authenticated and not revoked;
- authenticated user equals owner subject;
- household membership and tenant scope pass;
- household organization matches requested organization;
- cell is RC2-qualified;
- request is read-only;
- no-store and rate-limit policies pass;
- audit-log and security-event receipts are present;
- incident STOP authority is active;
- build/config identity is valid;
- privacy/authority boundaries are preserved.

Even then:

```text
executableBinding=FALSE
productionReady=FALSE
productionMutationAllowed=FALSE
```

## 4. Source drift is fail-closed

The harness also inspects backend source contracts. If a required primitive disappears or materially changes so that its required markers are no longer present:

```text
HOLD_BACKEND_PRIMITIVE_DRIFT
```

This prevents a future backend refactor from silently invalidating the P5 binding assumptions.

## 5. Important scope limit

Source-marker compatibility is not the same as a live database or staging integration test.

This harness proves:

```text
validated P5 contract
+
expected backend primitive interfaces
+
synthetic receipt mapping
```

It does not prove real infrastructure, real database state, or production availability.

## 6. iOS / real owner memory

```text
IOS_SAFARI_DESTINATION=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
REAL_OWNER_MEMORY=NOT_STARTED
```

Neither is inferred or advanced by this harness.

## 7. Current state

```text
P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS=AUTHORED
PRODUCTION_ENDPOINT_CREATED=FALSE
NETWORK_CALLS=FALSE
DATABASE_WRITES=FALSE
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
```

NEXT_SAFE_INTERNAL_TRACK=P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_CI_CERTIFICATION
