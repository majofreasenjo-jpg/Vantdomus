# DOMI P5 — Bounded Field Beta Runbook V0.1

DATE=2026-09-21
TRACK=BOUNDED_FIELD_BETA_OPERATIONALIZATION
STATUS=DRAFT_FROZEN_FOR_BUILD_CERTIFICATION

## 1. Scope

This runbook operationalizes the already adjudicated `DOMI_FIELD_BETA_READY=PASS_BOUNDED` state without expanding its claim.

Supported cells:
- `ANDROID_CHROME_DESTINATION=PASS_BOUNDED`
- `WINDOWS_EDGE_SOURCE=PASS_BOUNDED`

Untested and not supported:
- `WINDOWS_CHROME_SOURCE=NOT_TESTED_NOT_SUPPORTED`
- `IOS_SAFARI_DESTINATION=NOT_TESTED_NOT_SUPPORTED`

No support is inherited by analogy.

## 2. Hard boundaries

```text
ENVIRONMENT=VERCEL_PREVIEW_ONLY
DATA=SYNTHETIC_ONLY
REAL_OWNER_MEMORY=FORBIDDEN_NOT_STARTED
PRODUCTION_MUTATION=FORBIDDEN
EXTERNAL_OUTREACH=NOT_AUTHORIZED
UNIVERSAL_COMPATIBILITY_CLAIM=FALSE
RAW_MEMORY_PERSISTENCE=FORBIDDEN
RAW_TRANSCRIPT_PERSISTENCE=FORBIDDEN
FULL_STATE_PERSISTENCE=FORBIDDEN
AUTHORITY_PERSISTENCE=FORBIDDEN
```

The server preflight must explicitly report `VERCEL_ENV=preview`. Client-side hostname inference is not sufficient.

## 3. Session entry criteria

A session may be admitted only when all are true:
1. current browser/OS maps to an explicitly supported cell;
2. server preview preflight returns PASS with a fresh nonce/probe;
3. synthetic resume artifact validates and is not expired;
4. continuity key equals `fnv1a32:2b7f23b7`;
5. continuity replay/reconstruction passes;
6. operator confirms bounded synthetic beta boundary;
7. real owner memory remains unused;
8. production mutation remains false;
9. external outreach remains unauthorized;
10. no raw memory, raw transcript, full state, or authority is persisted.

Any missing criterion => HOLD.

## 4. Session minimum telemetry

Allowed session witness:
- synthetic session ID;
- start/end timestamps;
- supported cell and role;
- preview probe IDs and server timestamps;
- build commit SHA;
- receipt digest;
- artifact digest;
- continuity key;
- PASS/HOLD/STOP decision;
- incident level and failure codes.

Forbidden telemetry:
- raw memory content;
- raw transcript;
- full state;
- credentials or temporary access tokens;
- personal identifiers not required by the synthetic fixture;
- real owner-memory content.

## 5. Incident levels

### B1_LOCAL_RECOVERABLE
Examples:
- stale synthetic artifact;
- recoverable local UI state error.

Action:
- clear only local synthetic witness/artifact as needed;
- repeat session;
- no support claim change unless repeated.

### B2_CELL_HOLD
Examples:
- fresh probe failure;
- continuity failure;
- receipt/artifact/key drift;
- unsupported-cell attempt.

Action:
- stop the affected cell session;
- retain evidence;
- reset synthetic session;
- requalify the cell before reuse;
- other already qualified cells may continue if unaffected.

### B3_BETA_STOP
Examples:
- raw memory or raw transcript observed;
- full state persistence;
- authority expansion;
- production mutation;
- real owner memory entering the synthetic beta path.

Action:
- stop all beta sessions;
- preserve evidence;
- do not promote or contact external users;
- investigate and fix;
- rerun CI + physical qualification before reopening.

### B4_SECRET_STOP_ROTATE
Examples:
- credential or temporary protected-preview access value exposed in logs, UI, receipts, repository, or telemetry.

Action:
- stop beta immediately;
- replace/revoke the affected temporary access path;
- ensure secret is absent from preserved diagnostics;
- rerun build + qualification with a new protected preview.

## 6. Rollback protocol

If a code regression is confirmed:
1. stop new beta sessions;
2. preserve incident evidence;
3. revert with a normal Git revert/forward commit; do not rewrite history;
4. deploy only a Preview carrier;
5. rerun deterministic P5 CI;
6. rerun the affected physical support cell;
7. reopen only after bounded PASS.

Production rollback is outside this runbook because `PRODUCTION_MUTATION=FALSE`.

## 7. Per-session procedure

1. open `/owner-alpha-field-beta-ops` on a supported physical cell;
2. verify detected cell and synthetic artifact PASS;
3. execute PRE;
4. require server `preview` PASS + continuity PASS + admission PASS;
5. perform only the intended synthetic beta interaction;
6. execute POST;
7. require fresh probe + stable receipt/artifact/key + expected synthetic references;
8. record session decision and incident level;
9. clear only local session witness when no longer needed.

## 8. Operationalization readiness gate

`BOUNDED_FIELD_BETA_OPERATIONALIZATION_READY=PASS_BOUNDED` requires:
- support contract frozen;
- runbook frozen;
- incident protocol frozen;
- rollback protocol frozen;
- minimum telemetry frozen;
- CI PASS;
- Preview deployment READY;
- production mutation false;
- real owner memory false;
- external outreach false.

After build certification, perform one operational dry run on:
- Android + Chrome destination;
- Windows + Edge source.

These dry runs validate the operational wrapper, not the already-closed underlying P5 technical gates.

## 9. Expansion policy

Adding Windows Chrome or iOS Safari requires:
1. separate physical matrix qualification;
2. append-only evidence;
3. support contract update;
4. CI;
5. operational dry run on that exact cell.

No automatic expansion.

## 10. Claim ceiling

Operationalization does not imply:
- production readiness;
- universal compatibility;
- real autobiographical memory;
- subjecthood/selfhood/consciousness;
- authorization for external outreach;
- authorization for scientific-root minting.
