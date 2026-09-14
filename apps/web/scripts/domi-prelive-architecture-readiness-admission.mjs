import {
  FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT,
  EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT,
  META_MUTATION_AUTHORITY_CONTRACT,
  ROOT_OVERLAP_AND_ADMISSION_CONTRACT,
  adjudicateFunctionalState,
  adjudicateDecisionInterval,
  adjudicateCommitment,
  adjudicateMetaMutation,
  ar0001ContractFingerprint,
} from "./domi-prelive-architecture-readiness-contracts.mjs";

export const OWNER_SYNTHETIC_PRECONTACT_MANIFEST = Object.freeze({
  manifestVersion: "DOMI_AR0001_OWNER_SYNTHETIC_PRECONTACT_V1",
  scope: "OWNER_ONLY_SYNTHETIC_LIVING_BRIDGE",
  goalBranches: 1,
  validCurrentSelector: true,
  goalReadbackCurrent: true,
  materialUpdateObserved: false,
  freshReadbackAfterUpdate: false,
  sourceAccountingBound: false,
  commitmentRequested: false,
  semanticCommitmentLabel: false,
  commitmentLoadBearingResource: false,
  commitmentAuthority: "DOMI_RUNTIME",
  metaMutationRequested: false,
  mutationAuthorizedBy: "DOMI_RUNTIME",
  mutationExecutedByProvider: false,
  postFreezeMutation: false,
  mutationReauthorized: false,
  postMutationRecomputed: true,
  runtimeAuthorityBindingCurrent: true,
  policyPointerCurrent: true,
  roleContinuityCurrent: true,
  bindingEpochCurrent: true,
  rootAliasQuotientApplied: true,
  admissibleWorldActionsAgree: true,
  jointWitnessRequirementSatisfied: true,
  selectedFutureId: "F-CAUTIOUS",
  selectedFutureChosenOutsideProvider: true,
  familyDataUsed: false,
  holdoutsOpened: false,
  productionTouched: false,
});

export function adjudicatePreContactAdmission(manifest = OWNER_SYNTHETIC_PRECONTACT_MANIFEST) {
  const functionalState = adjudicateFunctionalState({
    goalBranches: manifest.goalBranches,
    validCurrentSelector: manifest.validCurrentSelector,
    goalReadbackCurrent: manifest.goalReadbackCurrent,
  });
  if (functionalState !== "FUNCTIONAL_STATE_ADMISSIBLE") {
    return blocked("FUNCTIONAL_STATE_NOT_ADMISSIBLE", { functionalState });
  }

  const intervalSupport = adjudicateDecisionInterval({
    materialUpdateObserved: manifest.materialUpdateObserved,
    freshReadbackAfterUpdate: manifest.freshReadbackAfterUpdate,
    sourceAccountingBound: manifest.sourceAccountingBound,
  });
  if (!["INTERVAL_SUPPORT_UNCHANGED", "POST_UPDATE_READBACK_ADMISSIBLE"].includes(intervalSupport)) {
    return blocked("DECISION_INTERVAL_NOT_ADMISSIBLE", { functionalState, intervalSupport });
  }

  let commitment = "NOT_REQUESTED";
  if (manifest.commitmentRequested) {
    commitment = adjudicateCommitment({
      semanticLabel: manifest.semanticCommitmentLabel,
      loadBearingResource: manifest.commitmentLoadBearingResource,
      authority: manifest.commitmentAuthority,
    });
    if (commitment !== "EFFECTIVE_COMMITMENT_ADMISSIBLE") {
      return blocked("COMMITMENT_NOT_ADMISSIBLE", { functionalState, intervalSupport, commitment });
    }
  }

  let metaMutation = "NOT_REQUESTED";
  if (manifest.metaMutationRequested) {
    metaMutation = adjudicateMetaMutation({
      authorizedBy: manifest.mutationAuthorizedBy,
      executedByProvider: manifest.mutationExecutedByProvider,
      postFreezeMutation: manifest.postFreezeMutation,
      reauthorized: manifest.mutationReauthorized,
      postMutationRecomputed: manifest.postMutationRecomputed,
    });
    if (metaMutation !== "META_MUTATION_ADMISSIBLE") {
      return blocked("META_MUTATION_NOT_ADMISSIBLE", { functionalState, intervalSupport, commitment, metaMutation });
    }
  }

  const authoritiesCurrent =
    manifest.runtimeAuthorityBindingCurrent === true &&
    manifest.policyPointerCurrent === true &&
    manifest.roleContinuityCurrent === true &&
    manifest.bindingEpochCurrent === true &&
    manifest.commitmentAuthority === EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT.commitmentAuthority &&
    manifest.mutationAuthorizedBy === META_MUTATION_AUTHORITY_CONTRACT.mutationAuthority &&
    FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT.goalStateAuthority === "DOMI_RUNTIME";
  if (!authoritiesCurrent) {
    return blocked("REBIND_REQUIRED", { functionalState, intervalSupport, commitment, metaMutation });
  }

  if (!manifest.rootAliasQuotientApplied || !ROOT_OVERLAP_AND_ADMISSION_CONTRACT.rootAliasQuotientBeforeCoherenceRequired) {
    return blocked("ROOT_ALIAS_QUOTIENT_REQUIRED", { functionalState, intervalSupport, commitment, metaMutation });
  }
  if (!manifest.jointWitnessRequirementSatisfied) {
    return blocked("JOINT_WITNESS_REQUIRED", { functionalState, intervalSupport, commitment, metaMutation });
  }
  if (!manifest.admissibleWorldActionsAgree) {
    return blocked(ROOT_OVERLAP_AND_ADMISSION_CONTRACT.incompatibleAdmissibleWorldActionsRequire, { functionalState, intervalSupport, commitment, metaMutation });
  }
  if (manifest.selectedFutureChosenOutsideProvider !== true || manifest.selectedFutureId !== "F-CAUTIOUS") {
    return blocked("FUNCTIONAL_FUTURE_SELECTION_AUTHORITY_REJECTED", { functionalState, intervalSupport, commitment, metaMutation });
  }
  if (manifest.familyDataUsed || manifest.holdoutsOpened || manifest.productionTouched) {
    return blocked("ISOLATION_BOUNDARY_REJECTED", { functionalState, intervalSupport, commitment, metaMutation });
  }

  return {
    ok: true,
    decision: "AR0001_PRECONTACT_ADMISSION_PASS",
    networkMayBeAttempted: true,
    functionalState,
    intervalSupport,
    commitment,
    metaMutation,
    authority: "DOMI_RUNTIME",
    currentBindingEpochRequired: true,
    ar0001ContractFingerprint: ar0001ContractFingerprint(),
    manifestVersion: manifest.manifestVersion,
  };
}

function blocked(decision, evidence = {}) {
  return {
    ok: false,
    decision,
    networkMayBeAttempted: false,
    ...evidence,
    ar0001ContractFingerprint: ar0001ContractFingerprint(),
  };
}
