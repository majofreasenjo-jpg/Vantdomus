# DOMI P5 — Production Route-Binding Security Audit

DATE=2026-09-25
PROJECT=VANTDOMUS_DOMI
TRACK=P5_PRODUCTION_ROUTE_BINDING_SECURITY_AUDIT

CURRENT=P5_PRODUCTION_ROUTE_BINDING_SECURITY_AUDIT_AUTHORED_PENDING_CI

## 1. Main finding

The repository already has a credible authenticated web/API control plane, but the current P5 `owner-alpha` surfaces were built as physical/synthetic qualification harnesses and **must not be promoted directly into production**.

The recommended architecture is:

```text
KEEP_OWNER_ALPHA_HARNESSES_PREVIEW_ONLY
+
CREATE_SEPARATE_AUTHENTICATED_OWNER_SCOPED_PRODUCTION_SURFACE
```

This avoids weakening the existing Preview isolation and avoids turning qualification tools into customer runtime surfaces.

## 2. Controls already present

Verified from the current source:

- global CSP and browser security headers;
- `/api/:path*` no-store policy;
- authenticated `/api/proxy/*` bearer-token requirement;
- same-origin + CSRF checks for unsafe proxy methods;
- authenticated proxy body-size limits;
- no-store upstream/downstream behavior;
- fail-closed local-demo fallback;
- Preview-only P5 field-beta preflight;
- explicit Preview/notFound isolation on cross-device, handoff and memory-test routes;
- nonce validation and privacy-minimal payloads in P5 probes.

These are reusable building blocks.

## 3. Exact gaps

### Web page binding

The main web proxy does not protect the `owner-alpha-*` prefixes. Therefore cookie/session existence is not currently required before these harness pages render.

The following P5 pages also lack their own server-side Preview/notFound guard:

```text
/owner-alpha-continuity-resume
/owner-alpha-cross-device-return
/owner-alpha-device-matrix
/owner-alpha-field-beta-ops
/owner-alpha-network-transition
```

In addition, `next.config.js` has no explicit no-store rule for owner-alpha pages.

### Direct P5 API binding

`/api/p5-field-beta-preflight` is safely Preview-only, but it is not session-bound. That is acceptable for the current protected synthetic Preview workflow, but not a production admission endpoint.

`/api/p5-network-probe` is no-store and nonce-validated, but currently has neither a Preview environment guard nor a session binding. It must not be treated as a production probe as-is.

### Owner / tenant scope

No current owner-alpha qualification route proves:

```text
authenticated user
→ authorized owner scope
→ valid household/organization tenant scope
```

That binding is mandatory before real production continuity data is ever admitted.

### Audit and rate policy

The direct P5 web probes are not yet bound to production audit/security-event emission or an explicit production rate-limit policy.

### CSRF

The current P5 direct routes are GET-only, so CSRF is not the immediate defect. Any future state-changing production P5 endpoint must inherit the existing authenticated proxy CSRF model or an equivalent fail-closed policy.

## 4. Memory-test boundary

`/owner-alpha-memory-test` already has a strict Preview/notFound gate. It remains outside production scope because:

```text
REAL_OWNER_MEMORY=NOT_STARTED
REAL_OWNER_MEMORY_AUTHORIZATION=FALSE
```

It must remain isolated even if other production P5 work progresses.

## 5. Production decision

```text
P5_PRODUCTION_ROUTE_BINDING_SECURITY_AUDIT=HOLD_PRODUCTION_ROUTE_BINDING
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
EXECUTABLE_BINDING=FALSE
```

This HOLD is useful: it identifies the exact integration work rather than treating generic security controls as sufficient evidence.

## 6. Next architecture

The next safe implementation should **not** add production access to existing owner-alpha harnesses.

Instead it should author a separate route-binding contract with:

```text
authenticated session
+ validated backend identity
+ authorized owner scope
+ tenant scope
+ qualified device cell
+ no-store
+ rate limiting
+ audit/security event receipt
+ incident stop authority
+ exact config/build identity
```

and preserve all current owner-alpha harnesses as Preview-only/internal qualification tooling.

## 7. iOS pause

```text
QD_02_IOS_SAFARI_DESTINATION=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
```

Nothing in this audit changes or infers iOS support.

NEXT_SAFE_INTERNAL_TRACK=P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT
