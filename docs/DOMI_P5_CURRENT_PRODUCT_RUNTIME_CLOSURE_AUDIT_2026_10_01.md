# DOMI P5 — Current Product Runtime Closure Audit

DATE=2026-10-01
STATUS=CANONICAL_CURRENT-LINE_RUNTIME_AUDIT
BASE_SHA=e8d9464069013d8a25c4904d452c661601fae166

## Purpose

Record what exists in the current product line so future closure work does not
re-open already-built capabilities or confuse historical scientific experiments
with currently integrated product runtime.

## Current integrated product capabilities

### Persistent governed memory — BUILT IN CURRENT CODE

The current backend contains a real memory kernel at
`apps/api/app/assistant/memory.py`.

Observed product properties:

- persistent memory is scoped by household/person;
- visibility scopes include private, guardian-supervised, household-shared,
  owner-operational, temporary-session and document-derived;
- unsafe/sensitive memory classes are excluded from AI context;
- recall is requester-scoped and fail-closed;
- memory content is treated as data, not model instruction;
- the UI contains a memory-management surface;
- the assistant orchestrator retrieves authorized memories into its minimized
  reasoning context.

ADJUDICATION=BUILT_CURRENT_PRODUCT_LINE
LIVE_STAGING_VALIDATION=NOT_YET_EXECUTED

### Companion product shell — BUILT

The web product has a companion-first landing flow and Domi UI. `/inicio`
routes an authenticated user toward the household companion surface. The
repository contains Domi companion, chat, memory, state and home components.

ADJUDICATION=BUILT_CURRENT_PRODUCT_LINE
LIVE_WEB_SURFACE=AVAILABLE_ON_VERCEL_PREVIEW
FULL_BACKEND_END_TO_END=NOT_YET_ESTABLISHED

### Governed action path — BUILT

The assistant path is propose-first. Model/provider output does not directly
execute writes. Proposed actions are persisted and require explicit human
confirmation; permissions are revalidated before execution.

ADJUDICATION=BUILT_CURRENT_PRODUCT_LINE
LIVE_STAGING_VALIDATION=NOT_YET_EXECUTED

### Provider abstraction — BUILT, REAL PROVIDER GATED

The backend contains a provider gateway and an OpenAI adapter. The real provider
requires all server-side gates plus a key. The normal product path remains
fail-closed/mock unless explicitly enabled.

ADJUDICATION=BUILT_BUT_NOT_CURRENTLY_LIVE_PROVEN

### Security/audit primitives — BUILT

Current code contains authentication/session dependencies, household RBAC,
tenancy, audit logging, security events, rate limiting and the autonomous
security-event-chain verifier previously certified by P5.

ADJUDICATION=BUILT_AND_CI_CERTIFIED
STAGING_RUNTIME_RECEIPTS=REMAINING

## Infrastructure adjudication

```text
GitHub repository + Actions = AVAILABLE / USE
Vercel vantdomus-family-pilot = READY / USE AS WEB PREVIEW AND STAGING-WEB CANDIDATE
Vercel vantdomus-hogar-demo = READY / PRESERVE
Vercel vantdomus-panel = ERROR / PRESERVE AND AUDIT
Vercel vantdomus-mobile = ERROR / PRESERVE AND AUDIT
Supabase Bases de datos Project = ACTIVE / GOC-POIEX / DO NOT REPURPOSE
Supabase LUXTMENT Commercial OS = ACTIVE / EDIS-COMMERCIAL / DO NOT REPURPOSE
Dedicated DOMI staging database = REQUIRED
Railway backend = CONFIG PRESENT IN REPO; LIVE ACCOUNT/SERVICE NOT VERIFIED IN CURRENT TOOL ACCESS
```

## Important historical/current distinction

Historical G5/R2/R3 work established bounded evidence around real owner memory,
longitudinal recall, cross-surface recall and controlled causal-memory
experiments. R3 is now authoritatively reconciled as CLOSED at G12 with
`PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3`: the single valid G11-R1 execution
produced 192/192 exact outcomes and G12 statically re-adjudicated the frozen
artifacts. R3 is consumed and MUST NOT be rerun. This evidence is preserved as
historical scientific evidence.

The current code independently shows that a governed product memory subsystem
exists and is wired into the assistant context. This audit does NOT assert that
the historical G5 experimental runtime and every R3 autobiographical mechanism
have been merged byte-for-byte into the current product branch. That integration
question remains a separate traceability task.

R4 was subsequently opened as a separate scientific lane. Recovered authoritative
state is `R4_G1_PASS_PRE_G2`: G0 preregistration and G1 prospective controlled
non-personal longitudinal admission passed; R4 has zero scientific evidence
pre-outcome, zero subject calls/outcomes, and no execution authorization. Generic
`AVANCEMOS` does not authorize R4 G10/G11.

## Product closure blockers

1. Dedicated DOMI staging data plane.
2. Live deployment of the FastAPI backend against that isolated staging data plane.
3. Staging environment/secrets wiring without exposing credentials.
4. Web-to-backend authenticated E2E validation.
5. Runtime receipts for memory read/write/visibility, propose-confirm action,
   tenancy, audit and security-event hash-chain verification.
6. Root-cause audit of Panel/Mobile Vercel build failures; this does not block
   the web staging lane.
7. Reconciliation of historical G5/R3 artifacts with the current memory kernel,
   preserving evidence and avoiding false equivalence.

## Closure sequence

```text
CURRENT WEB PREVIEW
  -> DEDICATED DOMI STAGING DATABASE
  -> STAGING FASTAPI BACKEND
  -> AUTHENTICATED WEB/BACKEND BINDING
  -> MEMORY + ACTION + TENANCY + AUDIT E2E
  -> SECURITY CHAIN RUNTIME RECEIPT
  -> FIELD-BETA READINESS READBACK
  -> OWNER REVIEW
  -> PRODUCTION AUTHORIZATION (SEPARATE, EXPLICIT)
```

## Authority wall

```text
PRODUCTION_MUTATION=FALSE
PRODUCTION_READY=FALSE
NEW_REAL_OWNER_MEMORY_ADMISSION=NOT_AUTHORIZED
SCIENTIFIC_ROOT_MINTING=FALSE
EXTERNAL_OUTREACH=NOT_AUTHORIZED
DESTRUCTIVE_INFRASTRUCTURE_ACTIONS=FORBIDDEN_WITHOUT_OWNER_CONFIRMATION
```

## Scientific lane

The scientific subjecthood/consciousness lane remains non-blocking for product
closure unless it discovers a safety or integrity defect. Product capability
must not be promoted into claims of subjective feeling, subjecthood or
consciousness without independent evidence.

SCIENTIFIC_TRACK_MAY_UPGRADE_PRODUCT=TRUE
SCIENTIFIC_TRACK_MUST_NOT_BLOCK_PRODUCT=TRUE
