# DOMI P5 — Authenticated Owner-Scoped Route-Binding Contract

DATE=2026-09-25
PROJECT=VANTDOMUS_DOMI
TRACK=P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT

CURRENT=P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT_AUTHORED_PENDING_CI

## 1. Architecture selected

The security audit is now certified and its HOLD is accepted as an architectural constraint.

The contract therefore does **not** promote the existing owner-alpha qualification harnesses.

```text
OWNER_ALPHA_HARNESSES=PREVIEW_ONLY_INTERNAL_QUALIFICATION
FUTURE_PRODUCTION_SURFACE=SEPARATE_AUTHENTICATED_OWNER_SCOPED_SURFACE
```

## 2. Identity binding

V0.1 is intentionally strict:

```text
session authenticated
session not revoked
session jti present
authenticated user id present
owner subject user id present
owner subject user id == authenticated user id
delegation = FALSE
```

Delegation is not inferred or implemented.

This mirrors the existing backend security primitives: JWT/session revocation checks already exist, while household membership and roles are separately enforced by RBAC.

## 3. Tenant binding

A valid simulated route binding requires:

```text
household membership PASS
valid household role
household.organization_id == requested organization_id
organization scope PASS
tenant scope PASS
```

This contract does not treat a valid login as sufficient tenant authorization.

## 4. Route and device boundary

The only eligible device cells remain the three RC2-qualified cells:

```text
ANDROID_CHROME_DESTINATION
WINDOWS_EDGE_SOURCE
WINDOWS_CHROME_SOURCE
```

`IOS_SAFARI_DESTINATION` remains paused and unsupported pending physical hardware.

The route class must be:

```text
SEPARATE_AUTHENTICATED_P5_PRODUCTION_SURFACE
```

and:

```text
ownerAlphaHarnessReused=FALSE
```

## 5. V0.1 is read-only

No real owner-memory program is authorized, so the contract deliberately prohibits state mutation:

```text
requestMode=READ_ONLY
stateMutationRequested=FALSE
```

The contract records that any future mutation must inherit a CSRF-equivalent fail-closed policy.

## 6. Operational binding

The simulated contract also requires:

- no-store policy;
- explicit rate-limit policy;
- incident STOP authority;
- audit log receipt;
- security event receipt;
- minimized security-event metadata;
- exact build commit;
- exact config digest;
- pinned validated admission-spec commit;
- pinned route-binding audit commit.

The repository already contains primitives for audit logs, tamper-evident security events and global API rate limiting. This contract defines what P5 must bind to; it does not yet create a production endpoint.

## 7. Privacy and authority boundary

Forbidden:

```text
raw memory persistence
raw transcript persistence
full state persistence
authority persistence
real owner memory without separate authorization
external outreach without separate authorization
credentials in evidence
temporary share tokens in evidence
```

## 8. Result semantics

Even a complete valid fixture returns only:

```text
CONTRACT_SATISFIED_IN_SIMULATION_NOT_EXECUTABLE
```

and always:

```text
executableBinding=FALSE
productionReady=FALSE
productionMutationAllowed=FALSE
```

## 9. Current decision

```text
P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT=AUTHORED
EXECUTABLE_BINDING=FALSE
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY=NOT_STARTED
IOS_SAFARI=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
```

NEXT_SAFE_INTERNAL_TRACK=P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CI_CERTIFICATION
