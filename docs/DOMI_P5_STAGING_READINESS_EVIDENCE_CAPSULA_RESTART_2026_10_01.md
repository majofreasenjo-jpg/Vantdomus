# DOMI P5 — Staging Evidence Package Cápsula / Exact Prompt Restart

DATE=2026-10-01

## CÁPSULA DE REHIDRATACIÓN

```text
CURRENT=P5_STAGING_READINESS_EVIDENCE_PACKAGE_AUTHORED

GATE_COMMIT=1bda8f8014240111246952b74bd6831cb124db36
GATE_CI_RUN=36861418896
GATE_CI=SUCCESS
GATE_PREVIEW=dpl_GCXU61auih6r4nFimagoGMdu5wPC
GATE_PREVIEW=READY
GATE_CERT_RECEIPT=dd0ac2914f8b68f51d810fb32bc7f6a1fe7f2e8a

SEALED_GATE_BRANCH=domi-p5-staging-readiness-gate-sealed
EVIDENCE_BRANCH=domi-p5-staging-readiness-evidence-package

BASE_VALIDATED_HARNESS=01c20955ce24a410a5eccaa300d51edde0bb408c

CONFIRMED_INFRA=
GITHUB+GITHUB_ACTIONS+VERCEL_PREVIEW+SOURCE_SECURITY_TOOLING+P5_HARNESS

NOT_YET_ESTABLISHED=
DEDICATED_STAGING_WEB
STAGING_API
STAGING_DB
STAGING_REDIS
STAGING_CLAMAV
STAGING_SMTP
SIGNED_ALERT_RECEIVER
ENCRYPTED_AND_OFFSITE_BACKUP
STAGING_OPERATOR_OWNERSHIP

CODE_GAP=
OBJECTIVE_SECURITY_EVENT_CHAIN_VERIFIER_NOT_FOUND

INITIAL_STAGING=SYNTHETIC_ONLY
IOS_SAFARI=PAUSED_NON_BLOCKING

STAGING_EXECUTION_AUTHORIZED=FALSE
PRODUCTION_READY=FALSE
PRODUCTION_MUTATION=FALSE
REAL_OWNER_MEMORY_FOR_STAGING=FALSE
EXTERNAL_USERS=FALSE
```

## EXACT PROMPT RESTART

Retoma DOMI desde `P5_STAGING_READINESS_EVIDENCE_PACKAGE_AUTHORED`.

Do not redesign P5.

The staging gate specification is mechanically certified at commit
`1bda8f8014240111246952b74bd6831cb124db36`.

The evidence audit shows that source/CI/Preview and P5 harness infrastructure exist, but the complete production-like staging substrate has not yet been evidenced.

Next safe internal work:

1. close the bounded security-event-chain verifier gap;
2. prepare provider-neutral staging configuration manifests and redacted receipt schemas;
3. identify/provision API, DB, Redis, ClamAV, SMTP, alert receiver and backup resources;
4. run pre-deployment gates;
5. only then request explicit staging execution authorization.

Do not:
- deploy production;
- mutate production;
- use real owner memory;
- admit external users;
- infer iOS support;
- promote the owner-alpha harness;
- store secrets in receipts.
