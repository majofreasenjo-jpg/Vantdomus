# DOMI P5 — Production Readiness Preflight Design

DATE=2026-09-24
PROJECT=VANTDOMUS_DOMI
TRACK=P5_PRODUCTION_READINESS_PREFLIGHT_DESIGN

CURRENT=P5_PRODUCTION_READINESS_PREFLIGHT_DESIGN_READY

This track starts because iOS + Safari physical qualification is paused until a physical iPhone/iPad becomes available. It does **not** consume, replace, or close QD-02.

## 1. Existing foundation already present

The repository already contains substantial production-oriented security and operations infrastructure:

- production runtime requirements and release gates in `docs/PRODUCTION_RUNBOOK.md`;
- a seven-part production readiness program in `docs/PRODUCTION_READINESS_7_POINT_PLAN.md`;
- environment templates for API and web;
- `tools/production_readiness_report.py`;
- `apps/api/scripts/production_preflight.py`;
- authenticated-route protection in `apps/web/proxy.ts`;
- CSRF/session/no-store/body-limit linting in `tools/web_session_security_lint.py`;
- JWT/session, password, verification and MFA mechanisms;
- global/per-action rate limiting, including Redis mode;
- security event auditing and tamper-evident chains;
- backup/restore, ClamAV, alerting and retention runbooks;
- CI security gates.

Therefore the production-readiness problem is **not** “build production security from zero.” It is to bind P5 into that existing production control plane and produce evidence that the binding is correct.

## 2. Four production-readiness debts

```text
PRD-01 PRODUCTION_ENVIRONMENT_CONTRACT
STATUS=PARTIALLY_IMPLEMENTED_NOT_CERTIFIED

PRD-02 SECURITY_AND_ACCESS_CONTROL
STATUS=SUBSTANTIALLY_IMPLEMENTED_NOT_PRODUCTION_CERTIFIED

PRD-03 OBSERVABILITY_AND_SLO
STATUS=PARTIALLY_IMPLEMENTED_NOT_CERTIFIED

PRD-04 RESILIENCE_AND_RECOVERY
STATUS=PARTIALLY_IMPLEMENTED_NOT_CERTIFIED
```

None is closed merely because the repository contains generic controls.

## 3. Critical architectural observation

The existing P5 field-beta preflight is deliberately Preview-only:

```text
VERCEL_ENV must equal preview
otherwise P5_FIELD_BETA_PREVIEW_ONLY -> 403
```

That behavior is correct and must **not** be weakened in RC2.

A production-capable P5 path therefore requires a **separate production admission contract**, not a relaxation of the Preview contract.

## 4. Proposed production admission model

The future production contract should require all of the following simultaneously:

```text
environment=production
authenticated_session=TRUE
authorized_owner_scope=TRUE
tenant_scope_valid=TRUE
real_owner_memory_contract_active=TRUE only if separately authorized
p5_production_config_digest=EXPECTED
rollback_anchor=KNOWN
telemetry_policy=PASS
security_preflight=PASS
production_preflight=PASS
incident_stop_authority=ACTIVE
```

Any missing condition must produce `HOLD` or `STOP`, never fallback admission.

This is only a design target. No production runtime is changed here.

## 5. Route binding requirement

The current owner-alpha P5 qualification routes were built as internal Preview harnesses. Before any production use, P5 surfaces must be mapped to the existing authenticated web route model and evaluated for:

- session requirement;
- tenant/owner authorization;
- CSRF for mutations;
- no-store behavior;
- request size limits;
- audit/security event coverage;
- rate limiting;
- explicit disablement of demo/public fallback.

No production surface should depend on a temporary Vercel share token.

## 6. Objective staging gate

Before production can even be considered, a staging environment must pass:

```text
security_gate.py = PASS
secret_scan.py = ZERO_FINDINGS
web_session_security_lint.py = PASS
web_env_preflight.py = PASS
production_readiness_report.py = PASS
production_preflight.py --skip-network NOT USED = PASS
/health = PASS
protected-route unauthenticated redirect = PASS
authenticated P5 authorization = PASS
rollback drill = PASS
privacy-minimized telemetry = PASS
incident stop drill = PASS
```

The test dataset must remain synthetic until a separate real-owner-memory authorization exists.

## 7. No-go conditions

Production remains blocked if any of these holds:

- public/demo token fallback exists in production;
- real env values are missing or placeholders;
- Redis/ClamAV/database/backup checks are skipped or failing;
- P5 production admission is not explicitly authenticated and authorized;
- rollback anchor is missing or untested;
- raw memory/transcript/full-state/authority enters telemetry;
- external outreach is not separately authorized;
- real owner memory is not separately authorized;
- iOS support is inferred from non-iOS evidence.

## 8. Current decision

```text
P5_PRODUCTION_READINESS_PREFLIGHT_DESIGN=READY
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
PRODUCTION_DEPLOYMENT=NOT_AUTHORIZED
REAL_OWNER_MEMORY=NOT_STARTED
EXTERNAL_OUTREACH_AUTHORIZATION=FALSE
IOS_SAFARI_QUALIFICATION=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
```

NEXT_SAFE_INTERNAL_TRACK=P5_PRODUCTION_ADMISSION_CONTRACT_DRAFT
