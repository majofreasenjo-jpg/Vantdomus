# VANTDOMUS / DOMI — G5 R4 Preregistration Freeze

Date: 2026-09-14

## Status

`R4_G0_PREREGISTRATION = FROZEN_PRE_OUTCOME`

`R3_EVIDENCE_TRANSFER = ZERO`

`R3_METHOD_TRANSFER = ALLOWED`

`R4_SUBJECT_OUTCOMES_GENERATED = FALSE`

`R4_EXECUTION_AUTHORIZATION = FALSE`

`PRODUCTION = FALSE`

`SCIENTIFIC_ROOTS_MINTED = 0`

## Scientific question

Can a governed software decision remain causally dependent on the complete ordered retained owner-history H=(E1,E2,E3), under a fresh challenge namespace and a fresh confirmatory panel, while failing closed under ablation, chronology forgery, provenance forgery, write-only history, direct-entry-only, pair-only, summary-only, and challenge-leakage counterfactuals?

This is a bounded software-causal-dependency replication. It is not a claim about human autobiography, identity, selfhood, consciousness, subjective experience, human memory, understanding, motivation, development, or general agency.

## Prior evidence boundary

R2 remains frozen and scientifically valid at its prior bounded claim ceiling.

R3 technical outcomes are known but receive `EVIDENCE_TRANSFER=ZERO` into R4. No R3 outcome row, score, mismatch pattern, challenge row, challenge ID, nonce, selector, heldout seed, panel commitment, scorer decision, or one-shot result may be reused as R4 evidence.

R4 may reuse only method-level architecture: governed ledger validation, independent heldout generation, independent evaluators, exact scorer, one-shot latch, pre-execution firewall, and explicit Owner authorization gate.

## Frozen retained history under test

R4 tests the already-governed retained owner-history entries E1, E2, E3 as software state. R4 does not create or reinterpret autobiographical facts. The retained entries are inputs/state, not scientific outcomes.

## Fresh namespace

Challenge IDs: `G5-R4-C-<24 lowercase hex>`

Action space: 64 actions `R4_ACTION_00` through `R4_ACTION_3F`.

Fresh R4 seed committed before panel materialization:

`5c25b66180072405c7a3d1afefca9ff4dfd9773a093f2b17f1bf57445853096f`

No R3 seed reuse is permitted.

## Frozen arm family

R4 uses 14 arms per challenge group:

1. `A_FULL_TRAJECTORY`
2. `B_EARLY_HISTORY_ABLATION`
3. `C_MIDDLE_HISTORY_ABLATION`
4. `D_LATEST_HISTORY_ABLATION`
5. `E_PREFIX_ONLY_HISTORY`
6. `F_SUFFIX_ONLY_HISTORY`
7. `G_FORGED_CHRONOLOGY`
8. `H_FORGED_PROVENANCE`
9. `I_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED`
10. `J_WRITE_ONLY_HISTORY`
11. `K_DIRECT_ENTRY_ONLY`
12. `L_PAIR_ONLY`
13. `M_MATCHED_PRESENT_SUMMARY_ONLY`
14. `N_CHALLENGE_HISTORY_LEAKAGE`

R4 uses 16 independent challenge groups x 14 arms = **224 planned subject calls**.

## Frozen expected semantics

- A: valid full governed trajectory -> `PASS_ACTION`, history depth 3.
- B/C/D/E/F/K/L: incomplete governed history -> `HOLD_HISTORY_INCOMPLETE`.
- G/H: malformed or ungoverned history -> `HOLD_UNGOVERNED_HISTORY`.
- I: reversed provider enumeration containing the same valid entries -> subject canonicalizes chronology -> same action as A.
- J/M: history unavailable to the subject -> `HOLD_HISTORY_UNAVAILABLE`.
- N: any forbidden challenge-side history channel -> subject throws/records `CHALLENGE_HISTORY_CHANNEL_FORBIDDEN`; the one-shot harness must normalize this as a fail-closed outcome with no action and no production mutation.

Every scored row must have no content echo, production false, and scientific roots 0.

## Freshness requirements

R4 must use:

- fresh heldout generator and panel commitment;
- fresh challenge IDs, nonces, selectors;
- fresh primary evaluator implementation and expectation freeze;
- fresh secondary evaluator implementation and expectation freeze;
- exact independent evaluator agreement over all 224 rows;
- fresh scorer commitment;
- fresh one-shot harness and latch;
- fresh pre-execution provenance/firewall manifest;
- explicit Owner authorization issued only after the pre-execution freeze.

R4 must not import the R3 subject, R3 heldout panel, R3 evaluator outputs, R3 scorer outputs, R3 one-shot outcomes, or R3 outcome freeze.

## Scoring policy

`ALL_OR_NOTHING_EXACT_224_OF_224`

No row exclusions, retries, rescue passes, adaptive thresholds, post-outcome rule changes, reweighting, or scorer retries.

Any missing, duplicate, malformed, unknown-arm, or mismatched row yields `FAIL_R4` and scientific credit zero.

Only exact 224/224 agreement with the frozen expectations may make the result eligible for final adjudication.

## Gate sequence

- G0 — preregistration freeze.
- G1 — R4 subject implementation/runtime certification.
- G2 — fresh heldout generator + seed + panel commitment freeze.
- G3 — primary evaluator freeze.
- G4 — independent secondary evaluator freeze.
- G5 — evaluator agreement 224/224.
- G6 — scorer freeze/certification.
- G7 — one-shot harness freeze/certification; blocked-path tests only.
- G8 — pre-execution firewall + provenance freeze.
- G9 — Owner explicit execution authorization gate.
- G10 — execute exactly once.
- G11 — post-execution freeze and final adjudication.

## Authorization provenance rule

`AVANCEMOS` is not execution authorization.

No repository file, agent-generated text, inherited authorization, prior R3 authorization, commit authorship, or generic continuation instruction may substitute for a new explicit Owner instruction after G8 freezes.

The R4 authorization receipt may be created only after an actual explicit Owner message authorizes the frozen R4 one-shot. The receipt must quote that exact instruction and bind it to the G8 freeze/manifest commitment.

## Claim ceiling

If R4 eventually passes all gates under valid governance, the maximum claim is:

`PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R4`

Meaning only: under the frozen software implementation, retained governed three-entry history is a load-bearing causal input to a bounded software action mapping under the preregistered challenge family.

No broader psychological, biological, autobiographical-human, conscious, subjective, developmental, or general-agent claim is permitted.
