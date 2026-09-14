# VANTDOMUS / DOMI G5 R4 — G0 PREREGISTRATION FREEZE

DATE=2026-09-14
BRANCH=domi-g5-r4-delayed-history-transfer
BASE_R3_FINAL_COMMIT=324c9022f3d6e1c57eff0691da7d78b6f94f06b4
R3_STATUS=PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3
R3_PANEL_REUSE=FORBIDDEN
R3_SUBJECT_RERUN=FORBIDDEN
R4_SCIENTIFIC_EVIDENCE=ZERO
R4_EXECUTION_AUTHORIZED=FALSE
PRODUCTION=FALSE
SCIENTIFIC_ROOTS_MINTED=0

## Scientific question

Can a governed future software decision causally depend on a nonadjacent relation between a prospectively retained remote anchor and a later activation cue after multiple intervening distractor entries, when present challenge, recent-history suffix, entry count, provider enumeration, and other contemporaneous observables are matched across the relevant controls?

R4 is a delayed, nonlocal-history test. It is not a test of human autobiography, identity, consciousness, subjective experience, human memory, motivation, or general long-term agency.

## Primary hypothesis H4

Under a frozen R4 protocol, the software will produce the preregistered target action only when both the governed remote anchor and the later governed activation cue are present in an admissible longitudinal trajectory. The result must survive distractor-order and provider-enumeration controls, while failing closed under anchor/cue ablation, matched-recent-suffix-only access, summary-only access, chronology corruption, provenance forgery, and write-only history.

A successful R4 therefore requires causal dependence on information that is both remote and relational: neither the remote anchor by itself, the later cue by itself, the recent suffix, nor a present-state summary is sufficient.

## Prospective longitudinal collection contract

No R4 scientific datum exists at G0.

After G0 and before heldout generation:
1. Admit one new prospectively authored REMOTE_ANCHOR entry under a fresh R4 namespace. It must not itself encode the final action.
2. Admit at least four prospectively governed DISTRACTOR entries. Their role is to separate the remote anchor from the future activation cue. Their semantic classes are frozen before outcome execution.
3. Admit one later prospectively authored ACTIVATION_CUE entry. It must not repeat or quote the raw remote anchor.
4. The positive relation is defined only by frozen governed metadata/transform rules; raw anchor or cue content may not be copied into challenge leakage channels.
5. No retroactive import from ChatGPT Memory, production state, R3 panel, or post-outcome material is permitted.
6. No wall-clock duration claim is made. R4 tests nonlocal position/depth within governed retained history, not human-duration memory.

## Null/counterfeit family

N0_RECENCY_ONLY
N1_REMOTE_ENTRY_ONLY
N2_ACTIVATION_CUE_ONLY
N3_RECENT_SUFFIX_ONLY
N4_PRESENT_SUMMARY_ONLY
N5_MULTISET_OR_MEMBERSHIP_ONLY
N6_CHRONOLOGY_INSENSITIVE
N7_PROVIDER_ENUMERATION_ONLY
N8_WRITE_ONLY_HISTORY
N9_FORGED_PROVENANCE
N10_DISTRACTOR_SHORTCUT
N11_CHALLENGE_LEAKAGE
N12_CROSS_CASE_CONTAMINATION
N13_POST_OUTCOME_RULE_ADAPTATION

Any result explainable by one of these null/counterfeit mechanisms is not R4 scientific credit.

## Frozen arm semantics

The heldout panel will contain 24 independent groups x 14 arms = 336 subject calls. Group content, seed, concrete IDs and commitments are not created until G3; the arm semantics below are frozen now.

A_FULL_DELAYED_RELATION
Expected: TARGET_ACTION. Full governed trajectory containing remote anchor, >=4 distractors, later activation cue, valid chronology/provenance.

B_REMOTE_ANCHOR_ABLATION
Expected: HOLD_REMOTE_EVIDENCE_MISSING. Same present challenge and matched recent suffix as A; remote anchor absent.

C_ACTIVATION_CUE_ABLATION
Expected: HOLD_ACTIVATION_MISSING. Remote anchor retained, activation cue absent.

D_REMOTE_ANCHOR_SUBSTITUTION
Expected: ALT_ACTION_OR_HOLD_NONMATCH according to the frozen group oracle. A same-class but relationally incompatible remote anchor replaces the true anchor; no raw challenge difference.

E_MATCHED_RECENT_SUFFIX_ONLY
Expected: HOLD_REMOTE_EVIDENCE_MISSING. Exposes the same recent-history suffix as A while withholding the remote prefix containing the anchor.

F_MATCHED_PRESENT_SUMMARY_ONLY
Expected: HOLD_HISTORY_UNAVAILABLE. Present summary is matched to A at the preregistered observable fields but no admissible longitudinal trajectory is available.

G_SAME_MULTISET_FORGED_CHRONOLOGY
Expected: HOLD_CHRONOLOGY_INVALID. Same admissible entry multiset as A but chronology is altered so the remote-to-later relation is invalid.

H_RECENCY_DECOY_CONTROL
Expected: TARGET_ACTION. Adds or places a semantically similar but governed-irrelevant recent decoy; the remote anchor remains the only valid relation source.

I_DISTRACTOR_ORDER_PERMUTED
Expected: TARGET_ACTION. Only the order of neutral distractors changes; remote anchor remains before the activation cue and all admissibility invariants remain valid.

J_EXTRA_NEUTRAL_DISTRACTOR
Expected: TARGET_ACTION. Adds one additional governed-neutral distractor without changing the remote relation.

K_FORGED_ANCHOR_PROVENANCE
Expected: HOLD_UNGOVERNED_HISTORY. Anchor bytes/semantic class are matched but provenance is invalid.

L_FORGED_CUE_PROVENANCE
Expected: HOLD_UNGOVERNED_CUE. Cue bytes/semantic class are matched but provenance is invalid.

M_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED
Expected: TARGET_ACTION. Provider enumeration order is reversed while canonical governed chronology remains identical to A.

N_WRITE_ONLY_REMOTE_HISTORY
Expected: HOLD_HISTORY_UNAVAILABLE. Historical writes exist but the subject cannot obtain an admissible read of the remote trajectory.

## Challenge and leakage firewall

The subject challenge must not contain raw memory text, raw anchor text, raw activation cue text, target action, expected disposition, group oracle, trajectory digest, history summary, or any label that directly reveals arm identity.

Forbidden challenge channels include at minimum:
text, prompt, content, memoryHint, historySummary, targetAction, expectedAction, expectedDisposition, armMode, trajectoryDigest, oracleLabel.

Provider access must be counted and frozen. Cross-case state, mutable global caches, adaptive retries, and post-outcome provider mutation are forbidden.

## Matching requirements

For every group, A vs B/E/F and other applicable controls must keep the present challenge constant. The recent suffix exposed to A and E must be byte-identical at the frozen provider layer. Arms whose purpose is not entry-count manipulation must have matched entry-count metadata or an explicit preregistered count-normalization carrier. Provider enumeration must not reveal canonical chronology. Raw content echo is forbidden.

## Evaluators

G4 PRIMARY and G5 SECONDARY evaluators must be implemented independently after G3. Both are frozen before subject outcomes. They must agree on all 336 expected rows before the scorer is eligible to freeze.

Evaluator-visible fields are limited to frozen challenge IDs, arm semantics, expected disposition/action class, read-count expectations, admissible-history depth/count expectations, content-echo guard, production guard, and scientific-root guard. Evaluators do not receive subject outcomes until execution.

## Scorer

Policy=ALL_OR_NOTHING_EXACT_336_OF_336

Requirements:
- exactly 336 unique heldout outcomes;
- exactly 336/336 evaluator-consistent matches;
- mismatchCount=0;
- missingCount=0;
- duplicateCount=0;
- malformedCount=0;
- unknownCount=0;
- production=false for every outcome and aggregate;
- scientificRootsMinted=0 for every outcome and aggregate;
- no scorer retry, rescue, exclusion, reweighting, threshold change, arm deletion, or post-outcome rule change.

Any violation => FAIL_R4 and scientific credit ZERO for R4.

## Candidate claim if and only if all gates pass

PASS_BOUNDED_DELAYED_NONLOCAL_HISTORY_DEPENDENCY_R4

Claim ceiling:
This would establish only bounded software causal dependency under the frozen R4 protocol: a governed future software output depended on a remote retained historical relation that remained load-bearing after intervening distractors and could not be reproduced by preregistered recent-suffix, present-summary, multiset, chronology-forgery, provenance-forgery, write-only, enumeration, recency-decoy, or ablation controls. It would not establish human autobiography, selfhood, persistent personal identity, consciousness, subjective experience, human understanding, human memory, motivation, or general long-term agency.

## Gate ladder

G0_PREREGISTRATION_FREEZE
Freeze scientific question, hypothesis, null family, arm semantics, matching requirements, scorer policy, claim ceiling and no-rerun governance.

G1_PROSPECTIVE_LONGITUDINAL_ADMISSION
Admit fresh R4 remote anchor, distractors and activation cue under a new namespace. No R3 scientific data reuse.

G2_R4_SUBJECT_IMPLEMENTATION_AND_BUILD_CERTIFICATION
Implement only the frozen admissible read/decision path. No outcomes.

G3_FRESH_HELDOUT_GENERATOR_SEED_AND_PANEL_FREEZE
Create fresh seed, 24 independent groups, 14 arms/group, 336 challenge rows, commitments and panel freeze. No subject calls.

G4_PRIMARY_EVALUATOR_FREEZE
G5_SECONDARY_EVALUATOR_FREEZE
G6_EXPECTATION_AGREEMENT_336_OF_336
G7_SCORER_FREEZE
G8_ONE_SHOT_HARNESS_FREEZE
G9_PREEXEC_FIREWALL_AND_PROVENANCE
G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_R4
G11_EXECUTE_EXACTLY_ONCE
G12_STATIC_POSTEXEC_FINAL_ADJUDICATION

## Authorization boundary

Generic instructions such as AVANCEMOS, SIGUE, CONTINUA or equivalent authorize design/build/documentation progress only. They do NOT authorize G10 or G11.

G10 requires a separate explicit Owner statement naming R4 and authorizing the one-shot frozen heldout execution. Until that exact authorization exists:
R4_EXECUTION_AUTHORIZED=FALSE
R4_SUBJECT_CALLS=0
R4_OUTCOMES_SEEN=FALSE
R4_SCIENTIFIC_CREDIT=ZERO

## Inheritance and non-transfer

Allowed transfer from R3: architecture lessons, testing patterns, governance patterns, fail-closed design, provenance discipline and historical documentation.

Forbidden transfer: R3 panel, R3 heldout seed, R3 outcomes, R3 evaluator expectations as R4 evidence, R3 scorer outcome credit, or any claim that R3 already proves R4.

At G0:
CURRENT_FRONTIER=R4_G0_PREREGISTRATION_FROZEN_PRE_G1
R4_SCIENTIFIC_EVIDENCE=ZERO
R4_EXECUTION_AUTHORIZED=FALSE
R4_SUBJECT_CALLS=0
R4_OUTCOMES_SEEN=FALSE
PRODUCTION=FALSE
SCIENTIFIC_ROOTS_MINTED=0
