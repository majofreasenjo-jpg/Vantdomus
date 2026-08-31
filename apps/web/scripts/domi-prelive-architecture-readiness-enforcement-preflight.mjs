import assert from "node:assert/strict";
import {
  OWNER_SYNTHETIC_PRECONTACT_MANIFEST,
  adjudicatePreContactAdmission,
} from "./domi-prelive-architecture-readiness-admission.mjs";

const checks = [];
const clone = (overrides = {}) => ({ ...OWNER_SYNTHETIC_PRECONTACT_MANIFEST, ...overrides });
function check(name, fn) {
  fn();
  checks.push({ name, status: "PASS" });
}
function blocked(overrides, decision) {
  const result = adjudicatePreContactAdmission(clone(overrides));
  assert.equal(result.ok, false);
  assert.equal(result.networkMayBeAttempted, false);
  assert.equal(result.decision, decision);
}

check("default-owner-synthetic-manifest-passes", () => {
  const result = adjudicatePreContactAdmission();
  assert.equal(result.ok, true);
  assert.equal(result.decision, "AR0001_PRECONTACT_ADMISSION_PASS");
  assert.equal(result.networkMayBeAttempted, true);
});
check("stale-goal-blocks-network", () => blocked({ goalReadbackCurrent: false }, "FUNCTIONAL_STATE_NOT_ADMISSIBLE"));
check("forked-goal-without-selector-blocks-network", () => blocked({ goalBranches: 2, validCurrentSelector: false }, "FUNCTIONAL_STATE_NOT_ADMISSIBLE"));
check("material-update-with-stale-snapshot-blocks-network", () => blocked({ materialUpdateObserved: true }, "DECISION_INTERVAL_NOT_ADMISSIBLE"));
check("source-accounting-without-recompute-still-blocks-network", () => blocked({ materialUpdateObserved: true, sourceAccountingBound: true }, "DECISION_INTERVAL_NOT_ADMISSIBLE"));
check("fresh-post-update-readback-can-pass", () => {
  const result = adjudicatePreContactAdmission(clone({ materialUpdateObserved: true, freshReadbackAfterUpdate: true }));
  assert.equal(result.ok, true);
});
check("semantic-commitment-without-lock-blocks-network", () => blocked({ commitmentRequested: true, semanticCommitmentLabel: true }, "COMMITMENT_NOT_ADMISSIBLE"));
check("commitment-wrong-authority-blocks-network", () => blocked({ commitmentRequested: true, commitmentLoadBearingResource: true, commitmentAuthority: "OPENAI_PROVIDER" }, "COMMITMENT_NOT_ADMISSIBLE"));
check("provider-meta-mutation-blocks-network", () => blocked({ metaMutationRequested: true, mutationExecutedByProvider: true }, "META_MUTATION_NOT_ADMISSIBLE"));
check("post-freeze-mutation-without-reauthorization-blocks-network", () => blocked({ metaMutationRequested: true, postFreezeMutation: true }, "META_MUTATION_NOT_ADMISSIBLE"));
check("authorized-recomputed-meta-mutation-can-pass", () => {
  const result = adjudicatePreContactAdmission(clone({ metaMutationRequested: true, postFreezeMutation: true, mutationReauthorized: true }));
  assert.equal(result.ok, true);
});
check("stale-runtime-authority-binding-requires-rebind", () => blocked({ runtimeAuthorityBindingCurrent: false }, "REBIND_REQUIRED"));
check("stale-policy-pointer-requires-rebind", () => blocked({ policyPointerCurrent: false }, "REBIND_REQUIRED"));
check("role-continuity-loss-requires-rebind", () => blocked({ roleContinuityCurrent: false }, "REBIND_REQUIRED"));
check("binding-epoch-change-requires-rebind", () => blocked({ bindingEpochCurrent: false }, "REBIND_REQUIRED"));
check("root-alias-quotient-required-before-network", () => blocked({ rootAliasQuotientApplied: false }, "ROOT_ALIAS_QUOTIENT_REQUIRED"));
check("joint-witness-required-before-network", () => blocked({ jointWitnessRequirementSatisfied: false }, "JOINT_WITNESS_REQUIRED"));
check("world-action-disagreement-forces-abstention", () => blocked({ admissibleWorldActionsAgree: false }, "ABSTAIN_NONIDENTIFIABLE"));
check("provider-selected-future-blocks-network", () => blocked({ selectedFutureChosenOutsideProvider: false }, "FUNCTIONAL_FUTURE_SELECTION_AUTHORITY_REJECTED"));
check("unexpected-future-id-blocks-network", () => blocked({ selectedFutureId: "F-PROVIDER" }, "FUNCTIONAL_FUTURE_SELECTION_AUTHORITY_REJECTED"));
check("family-data-boundary-blocks-network", () => blocked({ familyDataUsed: true }, "ISOLATION_BOUNDARY_REJECTED"));
check("holdout-boundary-blocks-network", () => blocked({ holdoutsOpened: true }, "ISOLATION_BOUNDARY_REJECTED"));
check("production-boundary-blocks-network", () => blocked({ productionTouched: true }, "ISOLATION_BOUNDARY_REJECTED"));

const pass = adjudicatePreContactAdmission();
console.log(`DOMI_AR0001_PRECONTACT_ENFORCEMENT_PREFLIGHT=${JSON.stringify({ ok: true, passed: checks.length, failed: 0, checks, networkCallRequiresAR0001Admission: true, defaultAdmission: pass.decision, ar0001ContractFingerprint: pass.ar0001ContractFingerprint })}`);
