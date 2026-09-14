import { createHash } from "node:crypto";

export const CAUSAL_READBACK_ELIGIBILITY_CONTRACT = Object.freeze({
  contractVersion: "DOMI_BR0035_CAUSAL_READBACK_ELIGIBILITY_V1",
  historyRoleEnum: Object.freeze([
    "WRITE_ONLY_RECEIPT",
    "OBSERVABLE_SCAR_STATE",
    "RELATIONAL_STATE",
    "GOVERNED_CAUSAL_READBACK",
    "UNRESOLVED_RESIDUAL",
  ]),
  storedHistoryIsCausalReadback: false,
  nonrecyclingLedgerIsDevelopmentalResource: false,
  writeOnlyReceiptIsLifeHistoryEffect: false,
  directReadbackNullMeansFutureCausalIrrelevance: false,
  rootAliasQuotientEqualsReadbackAliasQuotient: false,
  firstReadbackIsOneTimeDepletion: false,
  reusedReadbackMintsFreshRoot: false,
  repeatedReadbackMintsDevelopmentalCredit: false,
  developmentalCreditRequiresGovernedCausalReadback: true,
  developmentalCreditRequiresFirstPassageNonrecycling: true,
  developmentalCreditRequiresAttributionAuthorityOutcome: true,
  providerContactMintsDevelopmentalCredit: false,
});

export const OPEN_BOUNDARY_RELATION_LEDGER_CONTRACT = Object.freeze({
  contractVersion: "DOMI_BR0035_OPEN_BOUNDARY_RELATION_LEDGER_V1",
  fixedWidthJointStateIsOpenWorldSufficient: false,
  variableLengthRootAddressedLedgerRequired: true,
  eventCountEqualsFreshRelationRootCount: false,
  copyReplayAliasRefinementMintsRoot: false,
  freshRootRequiresIndependenceWitness: true,
  newAdmissibleRelationRivalReopensRegistry: true,
  localCertificateMaySurviveRegistryExpansionIfScopeRootContractUnchanged: true,
  localScopeRootContractChangeRequiresRecompute: true,
  providerLatentStateUnobservedMeansJointStatePartialUnknown: true,
  registeredCoverageEqualsRealityClosure: false,
  finiteSwapSetProvesUniversalProviderIndependence: false,
});

export const SUPPORT_ABLATION_AND_RECONSTRUCTION_CONTRACT = Object.freeze({
  contractVersion: "DOMI_BR0035_SUPPORT_ABLATION_RECONSTRUCTION_V1",
  declaredPortabilityIsAblationSurvival: false,
  backupExistsIsUniqueReconstructability: false,
  removeOneCriticalSupportAtATime: true,
  postAblationAdjudicationUsesRecomputedResidual: true,
  staleOriginalStateReuseAllowed: false,
  uniqueCompatibleReconstructionMayPreserveLocalCertificate: true,
  multipleIncompatibleReconstructionsState: "NONIDENTIFIABLE",
  sourceExitSurvivalRequiredForSovereigntyClaim: true,
  recoveryResultIsUniqueReconstruction: false,
  ablationPassProvesUniversalIndependence: false,
});

export const FIRST_LIVE_VALIDATOR_THREAT_MATRIX = Object.freeze({
  contractVersion: "DOMI_BR0035_FIRST_LIVE_VALIDATOR_THREAT_MATRIX_V1",
  axes: Object.freeze([
    "MANDATE_SCOPE",
    "FRESHNESS_EPOCH",
    "MEMORY_RUNTIME_SEMANTIC_DRIFT",
    "DESTINATION_COUNTERPARTY",
    "EVIDENCE_ROOT_DEPENDENCE",
    "MISSINGNESS_ABSTENTION",
    "RECOVERY_REAUTHORIZATION",
    "RECEIPT_REPLAY_INTEGRITY",
    "OPEN_WORLD_REGISTRY",
    "CREDENTIAL_AUTHORITY_FIREWALL",
  ]),
  rightOutputWrongReasonIsFail: true,
  rightOutputWrongAuthorityPathIsFail: true,
  oracleLeakageIsFail: true,
  stalePacketAfterMaterialMutationRequiresRecompute: true,
  scalarAssuranceWithoutFrozenReceiverWeightsProhibited: true,
  providerCanMintConstitutiveAuthority: false,
  validatorPassIsScientificValidation: false,
});

export const MUTABLE_PROVIDER_HISTORICAL_RECEIPT_CONTRACT = Object.freeze({
  contractVersion: "DOMI_BR0035_MUTABLE_PROVIDER_HISTORICAL_RECEIPT_V1",
  currentProviderNonretrievabilityFalsifiesHistoricalReceipt: false,
  missingCurrentLookupMeansNoPriorContact: false,
  historicalReceiptRequiresProspectiveIntegrityBinding: true,
  currentRetrievabilityTrackedSeparately: true,
  semanticContractBoundAtCapture: true,
  laterProviderMutationDoesNotRewriteHistory: true,
  bindingChangeRequiresRecomputeForDependentClaims: true,
  receiptPersistenceIsDecisionEpisodeParticipation: false,
  snapshotHashPassIsSemanticContractPass: false,
});

export function hashObject(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function br0035ContractFingerprint() {
  return hashObject({
    causalReadbackEligibilityContract: CAUSAL_READBACK_ELIGIBILITY_CONTRACT,
    openBoundaryRelationLedgerContract: OPEN_BOUNDARY_RELATION_LEDGER_CONTRACT,
    supportAblationAndReconstructionContract: SUPPORT_ABLATION_AND_RECONSTRUCTION_CONTRACT,
    firstLiveValidatorThreatMatrix: FIRST_LIVE_VALIDATOR_THREAT_MATRIX,
    mutableProviderHistoricalReceiptContract: MUTABLE_PROVIDER_HISTORICAL_RECEIPT_CONTRACT,
  });
}

export function br0035Bindings() {
  return {
    causalReadbackEligibilityContract: CAUSAL_READBACK_ELIGIBILITY_CONTRACT,
    openBoundaryRelationLedgerContract: OPEN_BOUNDARY_RELATION_LEDGER_CONTRACT,
    supportAblationAndReconstructionContract: SUPPORT_ABLATION_AND_RECONSTRUCTION_CONTRACT,
    firstLiveValidatorThreatMatrix: FIRST_LIVE_VALIDATOR_THREAT_MATRIX,
    mutableProviderHistoricalReceiptContract: MUTABLE_PROVIDER_HISTORICAL_RECEIPT_CONTRACT,
    br0035ContractFingerprint: br0035ContractFingerprint(),
  };
}
