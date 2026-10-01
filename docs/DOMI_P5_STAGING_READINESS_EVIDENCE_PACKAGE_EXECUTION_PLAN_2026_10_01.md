# DOMI P5 — Staging Readiness Evidence Package and Execution Plan

DATE=2026-10-01  
PACKAGE=DOMI_P5_STAGING_READINESS_EVIDENCE_PACKAGE_V0_1_2026_10_01  
TRACK=P5_STAGING_READINESS_EVIDENCE_PACKAGE_AND_EXECUTION_PLAN

## 1. Executive state

The staging gate specification has now passed deterministic CI and has a READY Vercel Preview.

```text
GATE_COMMIT=1bda8f8014240111246952b74bd6831cb124db36
GITHUB_RUN=36861418896
GITHUB_CONCLUSION=SUCCESS
VERCEL_PREVIEW=dpl_GCXU61auih6r4nFimagoGMdu5wPC
VERCEL_STATE=READY
GATE_CERTIFICATION_RECEIPT_COMMIT=dd0ac2914f8b68f51d810fb32bc7f6a1fe7f2e8a

P5_STAGING_READINESS_GATE=VALIDATED_NON_EXECUTABLE_SPECIFICATION
```

This is not yet a staging PASS. The evidence audit shows that source-level controls are mature, but a dedicated production-like staging substrate has not yet been evidenced.

## 2. Infrastructure inventory

### Confirmed available

```text
GitHub repository/source control = AVAILABLE
GitHub Actions CI = AVAILABLE
Vercel project vantdomus-family-pilot = AVAILABLE
Vercel Preview deployment capability = AVAILABLE
P5 validated integration harness = AVAILABLE
P5 RC2 qualified physical cells = AVAILABLE
security/readiness scripts = AVAILABLE
RBAC/tenancy/auth implementation = AVAILABLE
audit/security-event/rate-limit implementation = AVAILABLE
backup/restore tooling = AVAILABLE
```

### Not established by current evidence

```text
DEDICATED_STAGING_WEB=NOT_ESTABLISHED
STAGING_API=NOT_ESTABLISHED
STAGING_DATABASE=NOT_ESTABLISHED
STAGING_REDIS=NOT_ESTABLISHED
STAGING_CLAMAV=NOT_ESTABLISHED
STAGING_SMTP=NOT_ESTABLISHED
STAGING_SIGNED_ALERT_RECEIVER=NOT_ESTABLISHED
STAGING_ENCRYPTED_BACKUP_STORE=NOT_ESTABLISHED
STAGING_OFFSITE_BACKUP=NOT_ESTABLISHED
STAGING_OPERATOR_AND_ESCALATION_OWNER=NOT_ESTABLISHED
```

A Vercel Preview is useful evidence of web build/deploy health, but it is not being counted as the complete staging environment because the gate requires real API, database, Redis, ClamAV, SMTP, backup and operational receipts.

## 3. Gate-to-evidence map

| Gate | Existing infrastructure / artifact | Existing receipt | Remaining provisioning / evidence | Current adjudication |
|---|---|---|---|---|
| G-STG-1 Source & security | security gate, secret scan, web session lint, web env preflight, GitHub Actions | CI 36861418896 PASS for gate commit | Run full security suite on exact staging candidate; zero-finding secret scan; staging-mode env preflight | PARTIAL |
| G-STG-2 Configuration | production readiness report; env templates | none for real staging values | Managed staging secrets/config; sanitized exports; no placeholders; forbidden public keys absent; readiness report PASS | OPEN |
| G-STG-3 Infrastructure | production preflight; backup/restore tooling | none against real staging | API runtime, DB, Redis, ClamAV, encrypted + offsite backup; network preflight without skip | OPEN |
| G-STG-4 Identity & tenancy | auth/session, RBAC, organization tenancy, tenant-isolation tests | source/test evidence exists, no real-staging receipt | Synthetic admin + two synthetic tenants; login, revocation, RBAC, org tenancy and cross-tenant denial | OPEN |
| G-STG-5 P5 binding | validated owner-scoped integration harness; RC2 qualified cells | harness commit 01c20955... | Bind to staging authenticated route; synthetic round trip; no-store, rate-limit, audit and security-event receipts | OPEN |
| G-STG-6 Runtime smoke | staging_smoke_check.py; STAGING_SMOKE_TEST.md | none | Staging web/API URLs + synthetic household; run without demo/dev exceptions | OPEN |
| G-STG-7 Resilience | backup_restore_drill.py; hash-chain storage; autonomous read-only verifier; incident tooling | verifier commit 91c2e488... + CI 36864050114 SUCCESS | live staging-chain receipt, backup/restore drill, rollback drill, incident stop exercise | PARTIAL |
| G-STG-8 Observability | audit/security events; alert route; incident template | none against staging | signed alert receiver/delivery, minimized telemetry evidence, named operator/escalation owner | OPEN |

## 4. Provisioning plan

The execution order is deliberately dependency-aware.

### Phase STG-P0 — Freeze candidate

Input:

```text
SEALED_GATE_BRANCH=domi-p5-staging-readiness-gate-sealed
BASE_HARNESS=01c20955ce24a410a5eccaa300d51edde0bb408c
```

Select one exact candidate commit. No moving branch head is accepted as evidence.

Deliverables:

- candidate commit SHA;
- source tree digest;
- sanitized configuration digest;
- evidence-package ID.

### Phase STG-P1 — Provision staging substrate

Provision or designate:

- production-like API runtime;
- staging database;
- Redis;
- ClamAV;
- SMTP;
- encrypted backup location;
- offsite backup location;
- signed alert receiver;
- web staging environment.

All data remains synthetic.

No production resources are mutated.

### Phase STG-P2 — Configure secrets and origins

Load staging-only values into managed environment/secret storage.

Required controls include:

- HTTPS API/web origins;
- strong JWT/MFA/alert/backup secrets;
- DB and Redis credentials;
- ClamAV endpoint;
- SMTP credentials;
- strict allowed hosts/CORS;
- public uploads disabled;
- demo seed disabled;
- notification test endpoint disabled outside controlled drill;
- `NEXT_PUBLIC_ACCESS_TOKEN` absent;
- `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID` absent.

Secrets must never enter committed receipts.

Receipts store only key names, presence/status, hashes where safe, and redacted provider identifiers.

### Phase STG-P3 — Pre-deployment qualification

Run against the exact candidate:

```text
security_gate.py
secret_scan.py
web_session_security_lint.py
web_env_preflight.py
production_readiness_report.py
production_preflight.py
```

The infrastructure preflight must run without `--skip-network`.

Any failure = HOLD.

### Phase STG-P4 — Staging deployment

Only after P0-P3 evidence is complete and a separate explicit staging execution authorization exists:

```text
exact candidate
→ production-like staging build
→ deploy API to staging
→ deploy web to staging
→ record immutable deployment IDs
```

This phase does not authorize production.

### Phase STG-P5 — Runtime and tenancy validation

Create only synthetic identities and tenants.

Required:

- synthetic staging admin;
- tenant A;
- tenant B;
- authenticated login;
- session revocation;
- RBAC;
- organization tenancy;
- A cannot access B;
- B cannot access A;
- protected route redirects without session;
- no-store behavior;
- proxy size limit.

### Phase STG-P6 — P5 staging binding validation

Use one already-qualified RC2 physical cell first.

Recommended first cell:

```text
WINDOWS_CHROME_SOURCE
```

because it is already physically and operationally qualified and is convenient for the current test workstation.

Required receipts:

- authenticated owner-scoped route;
- synthetic-only P5 round trip;
- receipt/artifact/key continuity;
- no-store;
- rate-limit;
- audit event;
- security event;
- zero authority expansion;
- zero raw-memory/full-state persistence.

Do not promote the owner-alpha harness itself. The harness remains test evidence.

### Phase STG-P7 — Resilience and operations

Execute:

- encrypted backup;
- restore;
- checksum verification;
- offsite-copy verification;
- rollback drill;
- security-event-chain verification;
- signed alert delivery;
- incident stop exercise.

The code-level verifier gap identified in the first audit is now closed.

```text
SCRIPT=apps/api/scripts/security_event_chain_verify.py
IMPLEMENTATION_COMMIT=91c2e4886d3fdfbbc94f8a9b33f8f801162ded56
CI_RUN=36864050114
AUTONOMOUS_VERIFIER=PASS_BOUNDED
FAIL_CLOSED_TESTS=PASS
```

G-STG-7 remains PARTIAL because the verifier still needs a read-only receipt from the future real staging database, and the backup/restore, rollback and incident-stop drills remain open.

### Phase STG-P8 — Evidence freeze and adjudication

Freeze:

- candidate SHA;
- deployment IDs;
- configuration digest;
- sanitized preflight reports;
- smoke results;
- tenant-isolation receipt;
- P5 binding receipt;
- backup/restore receipt;
- rollback receipt;
- alert receipt;
- chain-verification receipt;
- incident exercise receipt;
- operator/reviewer sign-off.

Then evaluate the gate.

Maximum positive result:

```text
STAGING_ENTRY_ELIGIBLE_PENDING_EXPLICIT_EXECUTION_AUTHORIZATION
```

The package cannot convert itself into production authorization.

## 5. Stop conditions

Immediately HOLD staging entry for:

- secret leakage;
- placeholder or demo credentials in staging;
- public browser token;
- tenant-isolation failure;
- raw memory/transcript/full-state persistence;
- authority expansion;
- missing audit/security receipt;
- Redis/ClamAV fail-open;
- unencrypted backup;
- rollback failure;
- production mutation;
- real owner memory entering this staging track;
- external user admission.

## 6. iOS

```text
IOS_SAFARI=PAUSED_WAITING_FOR_PHYSICAL_IOS_DEVICE
IOS_BLOCKS_INITIAL_STAGING=FALSE
IOS_SUPPORT_CLAIM=FALSE
```

The initial staging qualification may proceed using the already-qualified Android Chrome / Windows Edge / Windows Chrome cells.

## 7. Exact remaining critical path

```text
1. PROVISION/IDENTIFY STAGING SUBSTRATE
2. LOAD STAGING-ONLY MANAGED SECRETS
3. RUN PRE-DEPLOYMENT GATES
4. REQUEST EXPLICIT STAGING EXECUTION AUTHORIZATION
5. DEPLOY EXACT CANDIDATE TO STAGING
6. RUN SYNTHETIC IDENTITY/TENANCY TESTS
7. RUN P5 OWNER-SCOPED STAGING ROUND TRIP
8. RUN LIVE READ-ONLY SECURITY-EVENT-CHAIN VERIFICATION
9. RUN SMOKE + BACKUP/RESTORE + ROLLBACK + ALERT/INCIDENT DRILLS
10. FREEZE EVIDENCE
11. ADJUDICATE STAGING GATE
```

## 8. Current decision

```text
P5_STAGING_EVIDENCE_PACKAGE=AUTHORED
STAGING_INFRASTRUCTURE_COMPLETE=FALSE
STAGING_EXECUTION_AUTHORIZED=FALSE
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY_FOR_STAGING=FALSE
EXTERNAL_USERS=FALSE
```


## 9. Verifier closure receipt — 2026-10-01

```text
SECURITY_EVENT_CHAIN_VERIFIER_CODE_GAP=CLOSED
IMPLEMENTATION_COMMIT=91c2e4886d3fdfbbc94f8a9b33f8f801162ded56
CI_RUN=36864050114
CI_CONCLUSION=SUCCESS
G-STG-7=PARTIAL_RUNTIME_EVIDENCE_PENDING
```

This closes only the missing autonomous-verifier implementation debt. It does not manufacture a staging runtime receipt.
