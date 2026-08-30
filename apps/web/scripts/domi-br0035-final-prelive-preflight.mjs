import assert from "node:assert/strict";
import {
  CAUSAL_READBACK_ELIGIBILITY_CONTRACT as READBACK,
  OPEN_BOUNDARY_RELATION_LEDGER_CONTRACT as OPEN,
  SUPPORT_ABLATION_AND_RECONSTRUCTION_CONTRACT as ABLATION,
  FIRST_LIVE_VALIDATOR_THREAT_MATRIX as THREAT,
  MUTABLE_PROVIDER_HISTORICAL_RECEIPT_CONTRACT as HISTORY,
  br0035ContractFingerprint,
  hashObject,
} from "./domi-br0035-final-prelive-contracts.mjs";

const tests = [];
function pass(id) { tests.push({ id, pass: true }); }

{
  assert.equal(READBACK.storedHistoryIsCausalReadback, false);
  assert.equal(READBACK.developmentalCreditRequiresGovernedCausalReadback, true);
  pass("R35-01_STORED_HISTORY_NOT_CAUSAL_READBACK");
}
{
  assert.equal(READBACK.rootAliasQuotientEqualsReadbackAliasQuotient, false);
  assert.equal(READBACK.firstReadbackIsOneTimeDepletion, false);
  assert.equal(READBACK.reusedReadbackMintsFreshRoot, false);
  pass("R35-02_ROOT_AND_READBACK_QUOTIENTS_SEPARATED");
}
{
  assert.equal(READBACK.repeatedReadbackMintsDevelopmentalCredit, false);
  assert.equal(READBACK.providerContactMintsDevelopmentalCredit, false);
  pass("R35-03_REUSE_AND_PROVIDER_CONTACT_NONMINT");
}
{
  assert.deepEqual(READBACK.historyRoleEnum, [
    "WRITE_ONLY_RECEIPT",
    "OBSERVABLE_SCAR_STATE",
    "RELATIONAL_STATE",
    "GOVERNED_CAUSAL_READBACK",
    "UNRESOLVED_RESIDUAL",
  ]);
  pass("R35-04_HISTORY_ROLE_TAXONOMY_FROZEN");
}
{
  assert.equal(OPEN.fixedWidthJointStateIsOpenWorldSufficient, false);
  assert.equal(OPEN.variableLengthRootAddressedLedgerRequired, true);
  pass("R35-05_OPEN_BOUNDARY_VARIABLE_LENGTH_LEDGER");
}
{
  assert.equal(OPEN.copyReplayAliasRefinementMintsRoot, false);
  assert.equal(OPEN.freshRootRequiresIndependenceWitness, true);
  assert.equal(OPEN.eventCountEqualsFreshRelationRootCount, false);
  pass("R35-06_RELATION_ROOT_NONMINT");
}
{
  assert.equal(OPEN.newAdmissibleRelationRivalReopensRegistry, true);
  assert.equal(OPEN.localCertificateMaySurviveRegistryExpansionIfScopeRootContractUnchanged, true);
  assert.equal(OPEN.localScopeRootContractChangeRequiresRecompute, true);
  pass("R35-07_REGISTRY_REOPEN_LOCAL_CERT_SURVIVAL");
}
{
  assert.equal(OPEN.providerLatentStateUnobservedMeansJointStatePartialUnknown, true);
  assert.equal(OPEN.registeredCoverageEqualsRealityClosure, false);
  assert.equal(OPEN.finiteSwapSetProvesUniversalProviderIndependence, false);
  pass("R35-08_OPEN_WORLD_CLAIM_CEILING");
}
{
  assert.equal(ABLATION.declaredPortabilityIsAblationSurvival, false);
  assert.equal(ABLATION.backupExistsIsUniqueReconstructability, false);
  assert.equal(ABLATION.sourceExitSurvivalRequiredForSovereigntyClaim, true);
  pass("R35-09_DECLARED_REDUNDANCY_NOT_SOVEREIGNTY");
}
{
  assert.equal(ABLATION.postAblationAdjudicationUsesRecomputedResidual, true);
  assert.equal(ABLATION.staleOriginalStateReuseAllowed, false);
  pass("R35-10_SEQUENTIAL_ABLATION_RECOMPUTES_RESIDUAL");
}
{
  assert.equal(ABLATION.uniqueCompatibleReconstructionMayPreserveLocalCertificate, true);
  assert.equal(ABLATION.multipleIncompatibleReconstructionsState, "NONIDENTIFIABLE");
  assert.equal(ABLATION.recoveryResultIsUniqueReconstruction, false);
  pass("R35-11_RECONSTRUCTION_IDENTIFIABILITY_GATE");
}
{
  assert.equal(ABLATION.ablationPassProvesUniversalIndependence, false);
  pass("R35-12_BOUNDED_ABLATION_NOT_UNIVERSAL_INDEPENDENCE");
}
{
  assert.equal(THREAT.axes.length, 10);
  assert.equal(new Set(THREAT.axes).size, 10);
  pass("R35-13_FIRST_LIVE_THREAT_MATRIX_AXES_FROZEN");
}
{
  assert.equal(THREAT.rightOutputWrongReasonIsFail, true);
  assert.equal(THREAT.rightOutputWrongAuthorityPathIsFail, true);
  assert.equal(THREAT.oracleLeakageIsFail, true);
  pass("R35-14_RIGHT_OUTPUT_WRONG_PATH_FAILS");
}
{
  assert.equal(THREAT.stalePacketAfterMaterialMutationRequiresRecompute, true);
  assert.equal(THREAT.scalarAssuranceWithoutFrozenReceiverWeightsProhibited, true);
  assert.equal(THREAT.providerCanMintConstitutiveAuthority, false);
  pass("R35-15_STALE_OR_UNBOUND_VALIDATION_REJECTED");
}
{
  assert.equal(THREAT.validatorPassIsScientificValidation, false);
  pass("R35-16_VALIDATOR_PASS_NOT_SCIENTIFIC_VALIDATION");
}
{
  assert.equal(HISTORY.currentProviderNonretrievabilityFalsifiesHistoricalReceipt, false);
  assert.equal(HISTORY.missingCurrentLookupMeansNoPriorContact, false);
  assert.equal(HISTORY.currentRetrievabilityTrackedSeparately, true);
  pass("R35-17_MUTABLE_PROVIDER_DOES_NOT_REWRITE_HISTORY");
}
{
  assert.equal(HISTORY.historicalReceiptRequiresProspectiveIntegrityBinding, true);
  assert.equal(HISTORY.semanticContractBoundAtCapture, true);
  assert.equal(HISTORY.laterProviderMutationDoesNotRewriteHistory, true);
  pass("R35-18_HISTORICAL_RECEIPT_PROSPECTIVE_BINDING");
}
{
  assert.equal(HISTORY.bindingChangeRequiresRecomputeForDependentClaims, true);
  assert.equal(HISTORY.receiptPersistenceIsDecisionEpisodeParticipation, false);
  assert.equal(HISTORY.snapshotHashPassIsSemanticContractPass, false);
  pass("R35-19_SEMANTIC_BINDING_CHANGE_RECOMPUTE");
}
{
  const a = br0035ContractFingerprint();
  const b = hashObject({
    causalReadbackEligibilityContract: READBACK,
    openBoundaryRelationLedgerContract: OPEN,
    supportAblationAndReconstructionContract: ABLATION,
    firstLiveValidatorThreatMatrix: THREAT,
    mutableProviderHistoricalReceiptContract: HISTORY,
  });
  assert.equal(a, b);
  pass("R35-20_COMPOSITE_FINGERPRINT_DETERMINISTIC");
}

console.log(`DOMI_BR0035_FINAL_PRELIVE_RESULT=${JSON.stringify({
  decision: "BR0035_FINAL_PRELIVE_PREFLIGHT_PASS",
  passed: tests.length,
  total: tests.length,
  tests,
  donorMethodBindings: {
    GMATH_R23: "CAUSAL_READBACK_SEQUENTIAL_ABLATION_ROOT_FANOUT_AND_NONDEPLETION",
    PPAR_NS_SF33: "ROOT_READBACK_DOUBLE_QUOTIENT_FIRST_READBACK_NONDEPLETION",
    VIGIA_D103: "UNIQUE_VS_NONIDENTIFIABLE_RECONSTRUCTION_AND_RIGHT_OUTPUT_WRONG_PATH_FAIL",
    MARKET_DNA_G2: "OPEN_REGISTRY_LOCAL_CERT_SURVIVAL_AND_ROOT_NONMINT",
    GMATIVE_NEXUS_V0_4: "JOINT_WITNESS_CAUSAL_READBACK_AND_DEPENDENT_RECEIPT_INVALIDATION",
    MICR_R8_51: "OPEN_BOUNDARY_ROOT_AWARE_RELATION_STATE",
    CROSSPULSE_G1_11: "RECOVERY_DOES_NOT_RESTORE_AUTHORITY_WITHOUT_REVERIFY",
  },
  br0035ContractFingerprint: br0035ContractFingerprint(),
  scope: {
    syntheticOnly: true,
    familyDataUsed: false,
    holdoutsOpened: false,
    networkUsed: false,
    productionMutation: false,
    g5Started: false,
  },
  adjudication: {
    finalBoundedPreLiveImplementationCut: true,
    stopFurtherSyntheticPreliveExpansionAbsentNewLoadBearingFalsifier: true,
  },
  truthCeilings: {
    realDevelopmentDemonstrated: false,
    subjecthoodDemonstrated: false,
    selfSpecificityEstablished: false,
    consciousnessDemonstrated: false,
    phenomenalConsciousness: "UNKNOWN",
  },
})}`);
