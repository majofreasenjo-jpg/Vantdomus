# DOMI P5 — Autonomous Security-Event-Chain Verifier

DATE=2026-10-01
TRACK=P5_STAGING_READINESS / G-STG-7

## Purpose

Close the bounded code gap identified in the staging evidence audit: the application already wrote tamper-evident security-event hash chains, but no autonomous read-only verifier existed as a staging receipt producer.

## Implementation

```text
SCRIPT=apps/api/scripts/security_event_chain_verify.py
MODE=READ_ONLY
DEFAULT=FAIL_CLOSED
SQLITE=SUPPORTED_READ_ONLY
POSTGRES=SUPPORTED_WHEN_PSYCOPG2_AVAILABLE
RAW_METADATA_EMITTED=FALSE
RAW_IDENTIFIERS_EMITTED=FALSE
```

The verifier recomputes every event hash using the same canonical field set as the writer and validates topology independently of row order.

It rejects:

- missing hash-chain columns / query schema failure;
- malformed metadata;
- invalid event or previous hashes;
- recomputed hash mismatch;
- duplicate hashes;
- missing genesis;
- orphan previous hashes;
- forks/branches;
- cycles/disconnected components;
- empty chain sets by default;
- unbounded event counts.

## Receipt semantics

Maximum positive receipt:

```text
PASS_SECURITY_EVENT_CHAIN
```

The receipt contains only:

- event count;
- chain count;
- opaque chain references;
- chain head hashes;
- a receipt digest;
- read-only/privacy flags.

It does not emit raw event IDs, household IDs, users, metadata, credentials, transcripts, memory, or authority payloads.

## Important adjudication limit

Implementation + deterministic tests close the **code-level verifier gap** only.

They do not close G-STG-7, because staging still needs:

- a live security-event chain receipt from the real staging database;
- encrypted backup/restore drill;
- rollback drill;
- incident stop exercise.

Therefore after CI:

```text
SECURITY_EVENT_CHAIN_VERIFIER_CODE_GAP=CLOSED
G-STG-7=PARTIAL_RUNTIME_EVIDENCE_PENDING
```
