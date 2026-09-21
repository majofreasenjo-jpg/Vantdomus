# DOMI P5 — Field Beta RC1 Freeze Checklist

DATE=2026-09-21
PACKAGE_ID=DOMI_P5_FIELD_BETA_RC1_2026_09_21
STATUS=FROZEN_NOT_RELEASED_NOT_PRODUCTION

## A. Exact anchors

- [x] RC source head frozen: `016c4c736d60826df1b7dde17976becb4f6b463b`
- [x] Runtime anchor frozen: `a82bf60d6d9bff5a6fbfba91850c3bef023fd4a5`
- [x] Rollback anchor frozen: `a82bf60d6d9bff5a6fbfba91850c3bef023fd4a5`
- [x] Final Field Beta adjudication: `2498bf47830a242b97c778df87dcccd071160a8d`
- [x] Operationalization readiness: `b9c62bc80094143a7f321c7fd5ac1d1b717c6896`
- [x] Android operational witness: `9f97380f97e873a506c6c1bb0896c46be7267592`
- [x] Operational wrapper validation: `016c4c736d60826df1b7dde17976becb4f6b463b`

## B. Build / Preview receipts

- [x] GitHub Actions run `35598248590` = SUCCESS
- [x] Runtime commit certified = `a82bf60d6d9bff5a6fbfba91850c3bef023fd4a5`
- [x] Vercel Preview deployment `dpl_6fjYTtxcW9DRWMfRcygo74GnixDW` = READY
- [x] Preview route = `/owner-alpha-field-beta-ops`
- [x] Production target = FALSE

## C. Physical/operational gates

- [x] P5 bidirectional physical continuity = PASS_BOUNDED
- [x] Repeatability/reload/reopen = PASS_BOUNDED
- [x] Wi-Fi <-> mobile-data transitions = PASS_BOUNDED
- [x] Supported matrix = PASS_BOUNDED
- [x] Android Chrome destination = PASS_BOUNDED
- [x] Windows Edge source = PASS_BOUNDED
- [x] Android operational dry-run = SESSION_PASS_BOUNDED / incident NONE
- [x] Windows Edge operational dry-run = SESSION_PASS_BOUNDED / incident NONE
- [x] Operational wrapper = PASS_BOUNDED

## D. Support boundary

SUPPORTED:
- `ANDROID_CHROME_DESTINATION`
- `WINDOWS_EDGE_SOURCE`

NOT_TESTED_NOT_SUPPORTED:
- `WINDOWS_CHROME_SOURCE`
- `IOS_SAFARI_DESTINATION`

- [x] Universal compatibility claim = FALSE
- [x] No support inherited by analogy

## E. Privacy / authority boundary

- [x] Raw memory persistence forbidden
- [x] Raw transcript persistence forbidden
- [x] Full state persistence forbidden
- [x] Authority persistence forbidden
- [x] Real owner memory = NOT_STARTED
- [x] Production mutation = FALSE
- [x] External outreach authorization = FALSE
- [x] Scientific roots minted = 0

## F. RC integrity

- [x] Complete repository dependency closure pinned by RC source head
- [x] Explicit P5 overlay contains 36 Git blob identities
- [x] Runbook included
- [x] Support contract included
- [x] CI workflow included
- [x] Physical evidence receipts included/referenced
- [x] Rollback anchor identified
- [x] No temporary Vercel share token included
- [x] No credential included

## G. Actions explicitly NOT performed

- [x] No GitHub Release created
- [x] No production tag/promote action performed
- [x] No Vercel production promotion performed
- [x] No real owner-memory test performed
- [x] No external beta invitation/contact performed

## H. Release rule

RC1 is an internal, reproducible Preview-only candidate package.

Any future change to a frozen P5 runtime/config asset invalidates RC1 for that changed tree and requires a new RC package identifier.

A future production promotion, real owner-memory test, external beta invitation, or additional supported browser/OS/device cell requires separate explicit authorization and its own gate.
