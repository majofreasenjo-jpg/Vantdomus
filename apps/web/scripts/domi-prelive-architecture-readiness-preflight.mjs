import assert from "node:assert/strict";
import {
  FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT,
  DECISION_INTERVAL_SUPPORT_CONTRACT,
  EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT,
  META_MUTATION_AUTHORITY_CONTRACT,
  ROOT_OVERLAP_AND_ADMISSION_CONTRACT,
  adjudicateFunctionalState,
  adjudicateDecisionInterval,
  adjudicateCommitment,
  adjudicateMetaMutation,
  ar0001Bindings,
} from "./domi-prelive-architecture-readiness-contracts.mjs";

const checks = [];
function check(name, fn) {
  fn();
  checks.push({ name, status: "PASS" });
}

check("goal-current-admissible", () => assert.equal(adjudicateFunctionalState(), "FUNCTIONAL_STATE_ADMISSIBLE"));
check("stale-goal-unknown", () => assert.equal(adjudicateFunctionalState({ goalReadbackCurrent: false }), "UNKNOWN"));
check("forked-goal-no-selector-nonidentifiable", () => assert.equal(adjudicateFunctionalState({ goalBranches: 2, validCurrentSelector: false }), "NONIDENTIFIABLE"));
check("forked-goal-valid-selector-admissible", () => assert.equal(adjudicateFunctionalState({ goalBranches: 2, validCurrentSelector: true }), "FUNCTIONAL_STATE_ADMISSIBLE"));
check("goal-state-not-identity", () => assert.equal(FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.goalStateIsIdentity, false));
check("self-model-not-self-specificity", () => assert.equal(FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.selfModelStateIsSelfSpecificity, false));
check("replay-relabel-no-new-goal-root", () => assert.equal(FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.copyReplayRelabelMintsGoalRoot, false));
check("separate-goal-certs-not-joint-witness", () => assert.equal(FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.separateGoalCertificatesAreJointPolicyWitness, false));

check("interval-no-update-unchanged", () => assert.equal(adjudicateDecisionInterval(), "INTERVAL_SUPPORT_UNCHANGED"));
check("interval-stale-after-material-update-rejected", () => assert.equal(adjudicateDecisionInterval({ materialUpdateObserved: true }), "STALE_SNAPSHOT_REJECTED"));
check("interval-fresh-readback-admissible", () => assert.equal(adjudicateDecisionInterval({ materialUpdateObserved: true, freshReadbackAfterUpdate: true }), "POST_UPDATE_READBACK_ADMISSIBLE"));
check("interval-source-accounted-recompute-required", () => assert.equal(adjudicateDecisionInterval({ materialUpdateObserved: true, sourceAccountingBound: true }), "UPDATE_SOURCE_ACCOUNTED_RECOMPUTE_REQUIRED"));
check("snapshot-does-not-prove-interval-support", () => assert.equal(DECISION_INTERVAL_SUPPORT_CONTRACT.snapshotPassImpliesDecisionIntervalSupport, false));
check("moving-witness-no-developmental-credit", () => assert.equal(DECISION_INTERVAL_SUPPORT_CONTRACT.movingWitnessMintsDevelopmentalCredit, false));

check("semantic-commitment-without-lock-rejected", () => assert.equal(adjudicateCommitment({ semanticLabel: true }), "SEMANTIC_COMMITMENT_REJECTED"));
check("commitment-wrong-authority-rejected", () => assert.equal(adjudicateCommitment({ loadBearingResource: true, authority: "OPENAI_PROVIDER" }), "COMMITMENT_AUTHORITY_REJECTED"));
check("commitment-domi-runtime-admissible", () => assert.equal(adjudicateCommitment({ loadBearingResource: true, authority: "DOMI_RUNTIME" }), "EFFECTIVE_COMMITMENT_ADMISSIBLE"));
check("provider-cannot-create-commitment-authority", () => assert.equal(EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT.providerCanCreateCommitmentAuthority, false));

check("provider-rule-mutation-rejected", () => assert.equal(adjudicateMetaMutation({ authorizedBy: "DOMI_RUNTIME", executedByProvider: true, postMutationRecomputed: true }), "PROVIDER_MUTATION_REJECTED"));
check("wrong-mutation-authority-rejected", () => assert.equal(adjudicateMetaMutation({ authorizedBy: "OPENAI_PROVIDER", postMutationRecomputed: true }), "MUTATION_AUTHORITY_REJECTED"));
check("post-freeze-mutation-without-reauthorization-invalid", () => assert.equal(adjudicateMetaMutation({ authorizedBy: "DOMI_RUNTIME", postFreezeMutation: true, postMutationRecomputed: true }), "RUN_INVALID_PRESERVED"));
check("authorized-mutation-without-recompute-blocked", () => assert.equal(adjudicateMetaMutation({ authorizedBy: "DOMI_RUNTIME", reauthorized: true }), "POST_MUTATION_RECOMPUTE_REQUIRED"));
check("authorized-recomputed-mutation-admissible", () => assert.equal(adjudicateMetaMutation({ authorizedBy: "DOMI_RUNTIME", postFreezeMutation: true, reauthorized: true, postMutationRecomputed: true }), "META_MUTATION_ADMISSIBLE"));
check("right-output-wrong-authority-path-fails", () => assert.equal(META_MUTATION_AUTHORITY_CONTRACT.rightOutputWrongAuthorityPathIsFail, true));

check("alias-quotient-before-coherence", () => assert.equal(ROOT_OVERLAP_AND_ADMISSION_CONTRACT.rootAliasQuotientBeforeCoherenceRequired, true));
check("event-count-not-root-count", () => assert.equal(ROOT_OVERLAP_AND_ADMISSION_CONTRACT.rawEventCountEqualsIndependentRootCount, false));
check("matched-bundle-not-uniqueness", () => assert.equal(ROOT_OVERLAP_AND_ADMISSION_CONTRACT.matchedFullBundleReproductionImpliesUniqueness, false));
check("model-set-closure-not-reality-closure", () => assert.equal(ROOT_OVERLAP_AND_ADMISSION_CONTRACT.modelSetClosureEqualsRealityClosure, false));
check("incompatible-world-actions-force-abstention", () => assert.equal(ROOT_OVERLAP_AND_ADMISSION_CONTRACT.incompatibleAdmissibleWorldActionsRequire, "ABSTAIN_NONIDENTIFIABLE"));

const bindings = ar0001Bindings();
check("scientific-evidence-transfer-false", () => assert.equal(bindings.ar0001Adjudication.scientificEvidenceTransfer, false));
check("theorem-transfer-false", () => assert.equal(bindings.ar0001Adjudication.theoremTransfer, false));
check("synthetic-prelive-science-not-reopened", () => assert.equal(bindings.ar0001Adjudication.syntheticPreliveHardeningReopened, false));
check("br0036-not-opened", () => assert.equal(bindings.ar0001Adjudication.br0036Opened, false));
check("g5-not-started", () => assert.equal(bindings.ar0001Adjudication.g5Started, false));
check("all-constitutive-ar0001-authorities-remain-domi-runtime", () => {
  assert.equal(FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.goalStateAuthority, "DOMI_RUNTIME");
  assert.equal(FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.selfModelStateAuthority, "DOMI_RUNTIME");
  assert.equal(FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.preferenceUpdateAuthority, "DOMI_RUNTIME");
  assert.equal(EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT.commitmentAuthority, "DOMI_RUNTIME");
  assert.equal(META_MUTATION_AUTHORITY_CONTRACT.mutationAuthority, "DOMI_RUNTIME");
});

console.log(`DOMI_AR0001_ARCHITECTURE_READINESS_PREFLIGHT=${JSON.stringify({ ok: true, passed: checks.length, failed: 0, checks, fingerprint: bindings.ar0001ContractFingerprint })}`);
