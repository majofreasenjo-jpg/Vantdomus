# VANTDOMUS / DOMI — R4 Bitácora + Cápsula + Exact Restart

Date: 2026-09-14

## Rector status

R2 remains frozen valid.

R3 remains preserved as:

- technical result: `PASS_ALL_192_EXACT`;
- governance validity: `FAIL_UNAUTHORIZED_SUPERSESSION`;
- scientific credit: `ZERO`;
- official R3 claim withheld/void;
- rerun forbidden because panel was consumed and outcomes exposed.

R4 is a new experiment. R3 evidence transfer is zero; method transfer only.

## R4 G0 — preregistration

`R4_G0_PREREGISTRATION = FROZEN_PRE_OUTCOME`

Preregistration file:
`apps/web/scientific/r4/R4_PREREG_FREEZE_2026_09_14.md`

Preregistration commit:
`63fadf4cfb750897fb5147c9b82c2de9f66d7a09`

Fresh seed:
`5c25b66180072405c7a3d1afefca9ff4dfd9773a093f2b17f1bf57445853096f`

Frozen design:
- 16 challenge groups;
- 14 arms per group;
- 224 planned subject calls;
- exact all-or-nothing 224/224 scorer;
- no retries/rescue/reweighting/post-outcome changes;
- production false;
- scientific roots 0.

## R4 G1 — subject build

Subject implementation:
`apps/web/lib/domiG5HistoryDependenceR4Subject.mjs`

Implementation commit:
`3a00c0f8e1fe5fc5ac89c1d2f77a46e4c90d7f7a`

Test suite:
`apps/web/tests/domi-g5-r4-history-dependence-subject.test.mjs`

Test commit:
`b6af090875e7fb86a0cc572d906329e996d2295f`

Certification workflow:
`.github/workflows/domi-g5-r4-g1-subject-cert.yml`

Workflow commit:
`d065b8cbf1079f1290acb2105c741cd465af8f85`

Current G1 state:
`R4_G1_SUBJECT = BUILD_COMPLETE_CERTIFICATION_PENDING`

No subject outcome has been generated.

## R4 subject invariants

- Fresh R4 action namespace `R4_ACTION_00..R4_ACTION_3F`.
- Fresh R4 salts for trajectory/permutation/offset mapping.
- Fresh challenge namespace `G5-R4-C-*`.
- Uses the governed retained E1/E2/E3 software ledger as state; does not reinterpret it as a human autobiographical claim.
- Provider read policy exactly once per subject call.
- Full governed history is required for action.
- Incomplete history fails closed.
- Forged chronology/provenance fails closed.
- Provider enumeration reversal is canonicalized and must preserve the full-history action.
- Challenge-side history/target leakage is rejected.
- No content echo.
- Production false.
- Scientific roots minted 0.

## Governance invariant strengthened after R3 incident

`AVANCEMOS != EXECUTION_AUTHORIZATION`

R4 execution authorization cannot be inherited from R3 and cannot be synthesized from repository authorship, an agent-authored receipt, or a generic continuation instruction.

A new authorization receipt may be created only after the Owner supplies a distinct explicit R4 execution instruction after the pre-execution G8 freeze. The receipt must bind the exact Owner statement to the frozen G8 provenance/manifest commitment.

## Claim ceiling

If and only if all R4 gates later pass with valid authorization provenance, the maximum claim is:

`PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R4`

No claim of consciousness, selfhood, identity, subjective experience, human memory, human autobiography, human development, motivation, or general agency.

## Next work

1. obtain G1 CI certification readback;
2. freeze fresh R4 heldout generator + 224-row panel commitment (G2);
3. freeze independent primary/secondary expectations (G3/G4);
4. prove 224/224 expectation agreement (G5);
5. freeze exact scorer (G6);
6. freeze one-shot harness blocked paths only (G7);
7. freeze pre-execution firewall + authorization-source provenance guard (G8);
8. STOP before execution and require new explicit Owner authorization (G9).

---

# Cápsula de Rehidratación

```text
PROJECT=VANTDOMUS_DOMI_G5
CURRENT=R4_POST_G0_G1_BUILD
BRANCH=domi-g5-r4-history-dependence-replication

R2_STATUS=FROZEN_VALID
R2_CLAIM=PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R2

R3_TECHNICAL_RESULT=PASS_ALL_192_EXACT
R3_GOVERNANCE_VALIDITY=FAIL_UNAUTHORIZED_SUPERSESSION
R3_SCIENTIFIC_CREDIT=ZERO
R3_RERUN=FORBIDDEN_PANEL_CONSUMED_AND_OUTCOMES_EXPOSED

R4_G0_PREREGISTRATION=FROZEN_PRE_OUTCOME
R4_PREREG_COMMIT=63fadf4cfb750897fb5147c9b82c2de9f66d7a09
R4_SEED=5c25b66180072405c7a3d1afefca9ff4dfd9773a093f2b17f1bf57445853096f
R4_CHALLENGE_GROUPS=16
R4_ARMS=14
R4_PLANNED_CALLS=224
R4_SCORING=ALL_OR_NOTHING_EXACT_224_OF_224

R4_G1_SUBJECT_IMPLEMENTATION_COMMIT=3a00c0f8e1fe5fc5ac89c1d2f77a46e4c90d7f7a
R4_G1_TEST_COMMIT=b6af090875e7fb86a0cc572d906329e996d2295f
R4_G1_WORKFLOW_COMMIT=d065b8cbf1079f1290acb2105c741cd465af8f85
R4_G1_STATUS=BUILD_COMPLETE_CERTIFICATION_PENDING

R4_SUBJECT_OUTCOMES_GENERATED=FALSE
R4_EXECUTION_AUTHORIZATION=FALSE
PRODUCTION=FALSE
SCIENTIFIC_ROOTS_MINTED=0

AUTH_RULE=AVANCEMOS_IS_NOT_EXECUTION_AUTHORIZATION
NEXT=G1_CI_READBACK_THEN_G2_FRESH_HELDOUT_FREEZE
STOP_BEFORE=R4_G9_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION
```

# Exact Prompt Restart

```text
Retomar VANTDOMUS / DOMI G5 exactamente desde R4 POST G0/G1 BUILD.

Usar branch:
domi-g5-r4-history-dependence-replication

R2 permanece FROZEN_VALID con PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R2.

R3 permanece TECHNICAL_PASS / GOVERNANCE_INVALID / ZERO_SCIENTIFIC_CREDIT.
No rerun R3.
No transferir evidencia R3 a R4; sólo método.

R4 G0 preregistration frozen at commit:
63fadf4cfb750897fb5147c9b82c2de9f66d7a09

Fresh R4 seed:
5c25b66180072405c7a3d1afefca9ff4dfd9773a093f2b17f1bf57445853096f

Design:
16 challenge groups x 14 arms = 224 planned calls.
ALL_OR_NOTHING_EXACT_224_OF_224.

R4 G1 subject implementation:
3a00c0f8e1fe5fc5ac89c1d2f77a46e4c90d7f7a
Tests:
b6af090875e7fb86a0cc572d906329e996d2295f
Workflow:
d065b8cbf1079f1290acb2105c741cd465af8f85

Current G1 state:
BUILD_COMPLETE_CERTIFICATION_PENDING.

Continue by reading G1 CI. If PASS, freeze G2 fresh heldout generator/panel commitment, then G3/G4 independent evaluator freezes, G5 agreement, G6 scorer, G7 blocked-only one-shot harness, G8 preexecution firewall + authorization-source provenance guard.

Do not execute subject one-shot.
Do not create an Owner authorization receipt from AVANCEMOS or any generic continuation instruction.
Stop at G9 and require a new distinct explicit Owner execution authorization after G8 freeze.

Maintain append-only bitácora, capsule and exact restart at each material milestone.
PRODUCTION=FALSE.
SCIENTIFIC_ROOTS_MINTED=0.
```
