# DOMI P5 — iOS Safari Pre-Physical Package / Cápsula / Exact Prompt Restart

DATE=2026-09-24
PROJECT=VANTDOMUS_DOMI

## CÁPSULA DE REHIDRATACIÓN

```text
CURRENT=P5_IOS_SAFARI_PREPHYSICAL_READY_NOT_EXECUTED

BASE_RC2_PACKAGE=DOMI_P5_FIELD_BETA_RC2_2026_09_22
BASE_RC2_FREEZE_COMMIT=20999f18153b675cc0394447e800e7b9c4bbd513
BASE_RC2_SEALED_BRANCH=domi-p5-field-beta-rc2-sealed

WORK_BRANCH=domi-p5-rc3-ios-safari-prephysical-qualification

TARGET_CELL=IOS_SAFARI_DESTINATION
ROLE=DESTINATION
EXPECTED_AFTER_STAGE=REOPEN
EXPECTED_CONTINUITY_KEY=fnv1a32:2b7f23b7
EXPECTED_REFERENCES=P5-M-PRIVATE,P5-M-SHARED

QD_01_WINDOWS_CHROME_SOURCE=FULLY_RESOLVED
QD_02_IOS_SAFARI_DESTINATION=OPEN_PHYSICAL_DEVICE_REQUIRED

PREPHYSICAL_PACKAGE=READY
PHYSICAL_EXECUTION=NOT_STARTED
OPERATIONAL_SUPPORT_CHANGE=NOT_STARTED
IOS_NETWORK_TRANSITION_QUALIFICATION=NOT_STARTED

RC2_MUTATION=FORBIDDEN
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY=NOT_STARTED
EXTERNAL_OUTREACH_AUTHORIZATION=FALSE
UNIVERSAL_COMPATIBILITY_CLAIM=FALSE
```

## EXACT PROMPT RESTART

RETOMA VANTDOMUS / DOMI EXACTAMENTE DESDE:

```text
P5_IOS_SAFARI_PREPHYSICAL_READY_NOT_EXECUTED
```

Use branch:
`domi-p5-rc3-ios-safari-prephysical-qualification`

Preserve RC2 as immutable at:
`20999f18153b675cc0394447e800e7b9c4bbd513`

Target:
`IOS_SAFARI_DESTINATION`

The matrix runtime already contains the iOS Safari destination cell and REOPEN semantics, but the RC2 operational support contract intentionally excludes it.

Next physical sequence when an iPhone/iPad is available:

1. create or use a fresh Preview carrier from the qualification branch;
2. open it in physical Safari;
3. verify IOS + SAFARI and IOS_SAFARI_DESTINATION;
4. execute BASELINE and capture probe/continuity/receipt/artifact/key/ref evidence;
5. fully close Safari/session as required;
6. reopen Safari and return to the same carrier;
7. execute POST without rerunning BASELINE;
8. require PASS_BOUNDED with stable receipt/artifact/key and exact refs;
9. only after physical PASS, modify a future RC3/new-package support contract to admit iOS Safari;
10. CI + Preview recertify that candidate;
11. execute operational PRE/POST dry-run;
12. separately qualify Wi-Fi↔mobile-data on iOS before any iOS network robustness claim.

Do not claim iOS Safari support before physical PASS.
Do not mutate RC2.
Do not promote production, use real owner memory, contact external users, execute R4, or mint scientific roots without separate explicit authorization.
