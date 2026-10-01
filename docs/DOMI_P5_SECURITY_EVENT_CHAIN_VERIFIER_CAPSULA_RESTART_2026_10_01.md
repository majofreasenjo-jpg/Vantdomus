# DOMI P5 — Security-Event-Chain Verifier Cápsula / Exact Prompt Restart

DATE=2026-10-01

```text
CURRENT=P5_SECURITY_EVENT_CHAIN_VERIFIER_AUTHORED_PENDING_CI

BASE_EVIDENCE_PACKAGE_COMMIT=548db405f99c1da43d59da274f62c4c32c5e984c
WORK_BRANCH=domi-p5-security-event-chain-verifier

SCRIPT=apps/api/scripts/security_event_chain_verify.py
TESTS=tests/security/test_security_event_chain_verifier.py

READ_ONLY=TRUE
FAIL_CLOSED=TRUE
RAW_METADATA_EMITTED=FALSE
RAW_IDENTIFIERS_EMITTED=FALSE

G-STG-7=NOT_CLOSED_YET
STAGING_EXECUTION_AUTHORIZED=FALSE
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY_FOR_STAGING=FALSE
```

After CI success, update the staging evidence package:
- mark OBJECTIVE_SECURITY_EVENT_CHAIN_VERIFIER gap CLOSED;
- add exact verifier commit and CI run receipt;
- change G-STG-7 from DRILLS_AND_ONE_VERIFIER_GAP to PARTIAL_RUNTIME_EVIDENCE_PENDING;
- retain backup/restore, rollback, live staging-chain verification and incident-stop drills as open.
