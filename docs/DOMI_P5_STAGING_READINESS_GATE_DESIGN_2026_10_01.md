# DOMI P5 — Staging Readiness Gate Design

DATE=2026-10-01  
PROJECT=VANTDOMUS_DOMI  
TRACK=P5_STAGING_READINESS_GATE_DESIGN

CURRENT=P5_STAGING_READINESS_GATE_DESIGN_AUTHORED_PENDING_CI

## 1. Purpose

This gate converts the existing security, readiness and P5 binding work into one objective staging-entry decision.

It is deliberately **non-executable**.

Even when every simulated requirement passes, the maximum result is:

```text
STAGING_ENTRY_ELIGIBLE_PENDING_EXPLICIT_EXECUTION_AUTHORIZATION
```

and:

```text
stagingDeploymentAuthorized=FALSE
productionDeploymentAuthorized=FALSE
```

The gate cannot deploy staging by itself.

## 2. Why this is the correct next step

The repository already contains mature production-oriented controls:

- `security_gate.py`;
- `secret_scan.py`;
- `web_session_security_lint.py`;
- `web_env_preflight.py`;
- `production_readiness_report.py`;
- `production_preflight.py`;
- `staging_smoke_check.py`;
- session revocation;
- household RBAC;
- organization tenancy;
- audit/security events;
- global API rate limiting;
- backup/restore requirements;
- alert signing and incident procedures.

P5 also now has validated non-executable owner-scoped binding specifications and an integration harness.

The remaining problem is therefore not another architecture rewrite. It is to define the exact evidence required before connecting those pieces to real staging infrastructure.

## 3. Gate groups

### G-STG-1 — Source and security

Required:

```text
security_gate=PASS
secret_scan=ZERO_FINDINGS
web_session_security_lint=PASS
web_env_preflight=PASS
```

### G-STG-2 — Configuration

Required:

```text
production_readiness_report=PASS
real_staging_env_values=TRUE
placeholder_values=FALSE
forbidden_public_keys=FALSE
```

This uses the production-readiness tooling against staging exports because staging must be production-like.

### G-STG-3 — Infrastructure

Required:

```text
production_preflight=PASS
--skip-network=FORBIDDEN
database=PASS
redis=PASS
clamav=PASS
encrypted_backup=PASS
```

### G-STG-4 — Identity and tenancy

Required:

```text
authenticated_session=PASS
session_revocation=PASS
household_rbac=PASS
organization_tenancy=PASS
two_tenant_isolation=PASS
```

Authentication alone is not sufficient.

### G-STG-5 — P5 binding

Required:

```text
owner_scoped_binding=PASS
qualified_RC2_device_cell=PASS
no_store=PASS
rate_limit=PASS
audit_receipt=PASS
security_event_receipt=PASS
```

Qualified cells remain:

```text
ANDROID_CHROME_DESTINATION
WINDOWS_EDGE_SOURCE
WINDOWS_CHROME_SOURCE
```

iOS Safari remains paused and cannot be inferred.

### G-STG-6 — Runtime smoke

Required:

```text
/api/health=PASS
/login=PASS
protected_route_redirect_without_session=PASS
runtime_no_store=PASS
public_proxy_size_limit=PASS
```

The existing `staging_smoke_check.py` provides the base automation.

### G-STG-7 — Resilience

Required:

```text
rollback_drill=PASS
backup_restore_drill=PASS
security_event_chain=PASS
incident_stop_authority=PASS
```

### G-STG-8 — Observability and ownership

Required:

```text
privacy_minimized_telemetry=PASS
signed_alert_delivery=PASS
operator_ownership_defined=PASS
```

## 4. Initial staging boundary

The first staging integration is intentionally synthetic-only.

```text
SYNTHETIC_ONLY=TRUE
REAL_OWNER_MEMORY=FORBIDDEN_INITIAL_STAGING
EXTERNAL_USERS=FORBIDDEN_INITIAL_STAGING
PRODUCTION_MUTATION=FALSE
OWNER_ALPHA_HARNESS_PROMOTION=FORBIDDEN
```

This resolves an important historical ambiguity:

Historical G5 real-owner memories E1/E2/E3 exist and remain valid evidence.

But the new P5 staging track does **not** automatically inherit authorization to use real owner memory.

## 5. Deployment strategy after gate eligibility

When the gate is eventually satisfied with real evidence, the correct staging workflow is:

```text
exact candidate commit
→ staging env pull/configuration
→ build
→ deterministic gates
→ staging deployment
→ smoke + identity/tenant + P5 binding tests
→ resilience drills
→ freeze evidence package
→ adjudicate
```

No production promotion occurs in this sequence.

A later production track may reuse a validated staging artifact, but production authorization remains separate.

## 6. Explicit execution boundary

This design phase does not deploy staging.

After CI certification, the next track is:

```text
P5_STAGING_READINESS_EVIDENCE_PACKAGE_AND_EXECUTION_PLAN
```

That track should identify exactly which staging infrastructure/secrets/resources already exist and which must be provisioned before asking for execution authorization.

## 7. Current state

```text
P5_STAGING_READINESS_GATE=AUTHORED_PENDING_CI
EXECUTABLE_GATE=FALSE
STAGING_DEPLOYMENT_AUTHORIZED=FALSE
PRODUCTION_DEPLOYMENT_AUTHORIZED=FALSE
REAL_OWNER_MEMORY_AUTHORIZED_FOR_STAGING=FALSE
EXTERNAL_USERS_AUTHORIZED=FALSE
IOS_SAFARI=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
```
