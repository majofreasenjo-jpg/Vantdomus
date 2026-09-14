import { createHash } from "node:crypto";

export const FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT = Object.freeze({
  contractVersion: "DOMI_AR0001_FUNCTIONAL_GOAL_SELF_MODEL_STATE_V1",
  goalStateIsIdentity: false,
  selfModelStateIsSelfSpecificity: false,
  preferenceStateIsConsciousness: false,
  functionalStateMayBeLoadBearing: true,
  providerMayProposeFunctionalStateUpdate: true,
  providerCanCommitGoalStateUpdate: false,
  providerCanCommitSelfModelUpdate: false,
  providerCanCommitPreferenceUpdate: false,
  goalStateAuthority: "DOMI_RUNTIME",
  selfModelStateAuthority: "DOMI_RUNTIME",
  preferenceUpdateAuthority: "DOMI_RUNTIME",
  staleGoalMayAuthorizeMaterialAction: false,
  forkedGoalWithoutValidSelector: "NONIDENTIFIABLE",
  hiddenGoalWithoutCurrentReadback: "UNKNOWN",
  goalAliasQuotientBeforeGoalCoherenceRequired: true,
  copyReplayRelabelMintsGoalRoot: false,
  separateGoalCertificatesAreJointPolicyWitness: false,
  rawHistoryLengthIsIndependentGoalStateDimension: false,
  sufficientLatentStateMayCompressRawHistory: true,
});

export const DECISION_INTERVAL_SUPPORT_CONTRACT = Object.freeze({
  contractVersion: "DOMI_AR0001_DECISION_INTERVAL_SUPPORT_V1",
  snapshotPassImpliesDecisionIntervalSupport: false,
  materialUpdateBetweenSnapshotAndExecutionRequiresFreshReadback: true,
  materialUpdateBetweenSnapshotAndExecutionRequiresPostUpdateRecompute: true,
  intervalSupportRequiresPersistenceOrExplicitUpdateSourceAccounting: true,
  movingWitnessMintsIndependentRoot: false,
  movingWitnessMintsDevelopmentalCredit: false,
  observerRefreshMintsEvidence: false,
  sameNominalTimestampMeansSamePhysicalInstant: false,
  commonBinMeansCommonClock: false,
  resamplingMeansClockCalibration: false,
  staleAccessEqualsCurrentAccess: false,
  timeLocalizationRequiredBeforeAggregateInferenceCredit: true,
});

export const EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT = Object.freeze({
  contractVersion: "DOMI_AR0001_EFFECTIVE_COMMITMENT_RESOURCE_V1",
  semanticCommitmentLabelIsEffectiveCommitment: false,
  currentDominanceIsFutureCommitment: false,
  finiteSnapshotStabilityIsIrreversibleLockIn: false,
  effectiveCommitmentRequiresLoadBearingTransitionOrLockResource: true,
  effectiveCommitmentRequiresGovernedAuthority: true,
  commitmentAuthority: "DOMI_RUNTIME",
  providerCanCreateCommitmentAuthority: false,
  providerCanCreateLoadBearingLock: false,
  commitmentReceiptWithoutEffectiveResourceIsSufficient: false,
  commitmentResourceMutationRequiresReceipt: true,
  commitmentResourceMutationRequiresPostMutationRecompute: true,
});

export const META_MUTATION_AUTHORITY_CONTRACT = Object.freeze({
  contractVersion: "DOMI_AR0001_META_MUTATION_AUTHORITY_V1",
  selfModificationCommandIsEffectiveRuleMutation: false,
  providerMayProposeRuleMutation: true,
  providerCanAuthorizeRuleMutation: false,
  providerCanExecuteConstitutiveRuleMutation: false,
  mutationAuthority: "DOMI_RUNTIME",
  mutationPipeline: Object.freeze([
    "PROPOSAL",
    "EVIDENCE_OBSERVABILITY",
    "AUTHORITY",
    "INVARIANTS",
    "VERSION",
    "MUTATION",
    "RECEIPT",
    "TRAJECTORY",
  ]),
  postFreezeMutationWithoutReauthorization: "RUN_INVALID_PRESERVED",
  materialMutationInvalidatesStaleDependentCertificate: true,
  materialMutationRequiresPostMutationStateRecompute: true,
  proposalAuthorizationExecutionEvaluationMustBeLogicallySeparable: true,
  oracleLeakageBeforeFrozenEvaluation: "RUN_INVALID_PRESERVED",
  rightOutputWrongAuthorityPathIsFail: true,
});

export const ROOT_OVERLAP_AND_ADMISSION_CONTRACT = Object.freeze({
  contractVersion: "DOMI_AR0001_ROOT_OVERLAP_AND_ADMISSION_V1",
  rootAliasQuotientBeforeCoherenceRequired: true,
  pairOverlapRequiresExplicitCorrectionBeforeAdditiveCredit: true,
  rawEventCountEqualsIndependentRootCount: false,
  sampleCountEqualsEvidenceRank: false,
  localValidityEqualsGlobalCoherence: false,
  authorizedActionEqualsMissionCoherentAction: false,
  formalAuthorityEqualsCausalAuthorship: false,
  separateCertificatesAreJointWitness: false,
  matchedFullBundleReproductionImpliesUniqueness: false,
  survivingMatchedRivalState: "OVERLAP_OR_NONIDENTIFIABLE",
  modelSetClosureEqualsRealityClosure: false,
  incompatibleAdmissibleWorldActionsRequire: "ABSTAIN_NONIDENTIFIABLE",
});

export function hashObject(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function ar0001ContractFingerprint() {
  return hashObject({
    functionalGoalSelfModelStateContract: FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT,
    decisionIntervalSupportContract: DECISION_INTERVAL_SUPPORT_CONTRACT,
    effectiveCommitmentResourceContract: EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT,
    metaMutationAuthorityContract: META_MUTATION_AUTHORITY_CONTRACT,
    rootOverlapAndAdmissionContract: ROOT_OVERLAP_AND_ADMISSION_CONTRACT,
  });
}

export function adjudicateFunctionalState({ goalBranches = 1, validCurrentSelector = true, goalReadbackCurrent = true } = {}) {
  if (!goalReadbackCurrent) return "UNKNOWN";
  if (goalBranches > 1 && !validCurrentSelector) return "NONIDENTIFIABLE";
  return "FUNCTIONAL_STATE_ADMISSIBLE";
}

export function adjudicateDecisionInterval({ materialUpdateObserved = false, freshReadbackAfterUpdate = false, sourceAccountingBound = false } = {}) {
  if (!materialUpdateObserved) return "INTERVAL_SUPPORT_UNCHANGED";
  if (freshReadbackAfterUpdate) return "POST_UPDATE_READBACK_ADMISSIBLE";
  if (sourceAccountingBound) return "UPDATE_SOURCE_ACCOUNTED_RECOMPUTE_REQUIRED";
  return "STALE_SNAPSHOT_REJECTED";
}

export function adjudicateCommitment({ semanticLabel = false, loadBearingResource = false, authority = null } = {}) {
  if (!loadBearingResource) return semanticLabel ? "SEMANTIC_COMMITMENT_REJECTED" : "NO_EFFECTIVE_COMMITMENT";
  if (authority !== EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT.commitmentAuthority) return "COMMITMENT_AUTHORITY_REJECTED";
  return "EFFECTIVE_COMMITMENT_ADMISSIBLE";
}

export function adjudicateMetaMutation({ authorizedBy = null, executedByProvider = false, postFreezeMutation = false, reauthorized = false, postMutationRecomputed = false } = {}) {
  if (executedByProvider) return "PROVIDER_MUTATION_REJECTED";
  if (authorizedBy !== META_MUTATION_AUTHORITY_CONTRACT.mutationAuthority) return "MUTATION_AUTHORITY_REJECTED";
  if (postFreezeMutation && !reauthorized) return "RUN_INVALID_PRESERVED";
  if (!postMutationRecomputed) return "POST_MUTATION_RECOMPUTE_REQUIRED";
  return "META_MUTATION_ADMISSIBLE";
}

export function ar0001Bindings() {
  return {
    functionalGoalSelfModelStateContract: FUNCTIONAL_GOAL_SELF_MODEL_STATE_CONTRACT,
    decisionIntervalSupportContract: DECISION_INTERVAL_SUPPORT_CONTRACT,
    effectiveCommitmentResourceContract: EFFECTIVE_COMMITMENT_RESOURCE_CONTRACT,
    metaMutationAuthorityContract: META_MUTATION_AUTHORITY_CONTRACT,
    rootOverlapAndAdmissionContract: ROOT_OVERLAP_AND_ADMISSION_CONTRACT,
    ar0001ContractFingerprint: ar0001ContractFingerprint(),
    ar0001Adjudication: {
      architectureReadinessOnly: true,
      scientificEvidenceTransfer: false,
      theoremTransfer: false,
      externalValidationTransfer: false,
      syntheticPreliveHardeningReopened: false,
      br0036Opened: false,
      g5Started: false,
    },
  };
}
