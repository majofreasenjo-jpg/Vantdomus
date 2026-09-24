# DOMI P5 — iOS + Safari Pre-Physical Qualification Checklist

DATE=2026-09-24
PROJECT=VANTDOMUS_DOMI
TRACK=P5_RC2_IOS_SAFARI_PREPHYSICAL_QUALIFICATION_PACKAGE

CURRENT=P5_IOS_SAFARI_PREPHYSICAL_READY_NOT_EXECUTED

## A. Frozen base

- [x] Base package = `DOMI_P5_FIELD_BETA_RC2_2026_09_22`
- [x] RC2 freeze commit = `20999f18153b675cc0394447e800e7b9c4bbd513`
- [x] RC2 sealed branch = `domi-p5-field-beta-rc2-sealed`
- [x] RC2 mutation forbidden
- [x] Any later support/runtime change belongs to RC3 or another package ID

## B. Target cell already exists in the matrix runtime

```text
CELL=IOS_SAFARI_DESTINATION
PLATFORM=IOS
BROWSER=SAFARI
ROLE=DESTINATION
AFTER_STAGE=REOPEN
```

- [x] Matrix runtime already recognizes the cell
- [x] Matrix runtime already recognizes iPhone/iPad Safari user-agent patterns
- [x] Destination role already requires recovered references exactly:
  `P5-M-PRIVATE,P5-M-SHARED`
- [x] Current RC2 operational support contract still excludes iOS Safari
- [x] Therefore matrix physical qualification must precede any operational support-contract expansion

## C. Physical equipment gate

- [ ] Physical iPhone or iPad available
- [ ] Safari used, not Chrome/Edge/Firefox on iOS
- [ ] Browser can reach a fresh protected Preview carrier
- [ ] Test remains synthetic only
- [ ] No real owner memory will be entered

If any item above is false, stop before BASELINE.

## D. BASELINE acceptance

Required:

- [ ] Detected = `IOS + SAFARI`
- [ ] Suggested/active cell = `IOS_SAFARI_DESTINATION`
- [ ] Physical match = YES
- [ ] Stage = `BASELINE`
- [ ] Fresh server probe = PASS
- [ ] Continuity = PASS
- [ ] Continuity key = `fnv1a32:2b7f23b7`
- [ ] Recovered refs = `P5-M-PRIVATE,P5-M-SHARED`
- [ ] Raw memory persisted = FALSE
- [ ] Raw transcript persisted = FALSE
- [ ] Full state persisted = FALSE
- [ ] Authority persisted = FALSE
- [ ] Last error = NONE

Record BASELINE probe ID, receipt digest and artifact digest.

## E. Required physical transition

For this destination cell the transition is **REOPEN**, not reload.

- [ ] Fully close Safari / terminate the test browser session as instructed
- [ ] Reopen Safari
- [ ] Return to the same qualification carrier/session context
- [ ] Do not rerun BASELINE
- [ ] Confirm reopen and execute POST

A simple page reload is insufficient for this qualification.

## F. POST acceptance

- [ ] Stage = `REOPEN`
- [ ] POST probe = PASS
- [ ] POST probe ID differs from BASELINE
- [ ] Probe nonce differs from BASELINE
- [ ] Observation time advanced
- [ ] Continuity = PASS
- [ ] Receipt ID stable
- [ ] Receipt digest stable
- [ ] Artifact digest stable
- [ ] Continuity key stable
- [ ] Recovered refs exactly `P5-M-PRIVATE,P5-M-SHARED`
- [ ] Cell result = `PASS_BOUNDED`
- [ ] Claim = `IOS_SAFARI_DESTINATION=PASS_BOUNDED`
- [ ] Failures = NONE
- [ ] Last error = NONE

## G. Fail-closed stop conditions

Stop the cell immediately on any:

- browser/platform mismatch;
- stale/reused probe;
- receipt drift;
- artifact drift;
- continuity-key drift;
- recovered-reference mismatch;
- raw memory/transcript/full-state/authority persistence;
- real owner memory entering the synthetic test;
- production mutation;
- external outreach;
- temporary-access or credential exposure.

## H. Operational dry-run gate

Do **not** change the support contract before physical matrix PASS.

After physical PASS only:

- [ ] Create RC3/new-package support-contract change
- [ ] Add `IOS_SAFARI_DESTINATION` as physically qualified
- [ ] Update tests so iOS Safari admission becomes allowed on that candidate branch
- [ ] Keep production/real-memory/outreach prohibitions unchanged
- [ ] CI = SUCCESS
- [ ] Preview = READY
- [ ] Operational PRE = `ADMIT_SYNTHETIC_BOUNDED_BETA`
- [ ] Operational POST = `SESSION_PASS_BOUNDED`
- [ ] Incident = NONE

Only then may:

```text
IOS_SAFARI_OPERATIONAL_DRY_RUN=PASS_BOUNDED
QD_02=PHYSICAL_AND_OPERATIONAL_RESOLVED
```

## I. Separate iOS network-transition debt

Even after the cell passes, do not inherit Android network-transition evidence.

Required separate iOS trials:

- [ ] Wi-Fi -> mobile data
- [ ] mobile data -> Wi-Fi
- [ ] fresh PRE/POST probes
- [ ] continuity stable
- [ ] receipt/artifact/key stable
- [ ] expected references stable
- [ ] no privacy/authority leakage

Until then:

```text
IOS_NETWORK_TRANSITION_ROBUSTNESS=NOT_QUALIFIED
```

## J. Current decision

```text
IOS_SAFARI_DESTINATION=NOT_TESTED_NOT_SUPPORTED
QD_02=OPEN_PHYSICAL_DEVICE_REQUIRED
PREPHYSICAL_PACKAGE=READY
PHYSICAL_EXECUTION=NOT_STARTED
```
