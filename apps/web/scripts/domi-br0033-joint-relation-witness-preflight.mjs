import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const JOINT = Object.freeze({
  contractVersion: "DOMI_BR0033_JOINT_RELATION_WITNESS_V1",
  completeJointStateClaimed: false,
  providerLatentStateObservable: false,
  observableJointRelationOnly: true,
  localStateEqualsJointState: false,
  environmentTraceIsIdentity: false,
  relationStateIsSharedSubjectivity: false,
  correlationIsConsciousness: false,
  jointStateAugmentationIsSelfSpecificity: false,
  missingJointStateMeansUnknown: true,
  commonCauseIsDistributedSelf: false,
  labelOnlyRebindingIsCausal: false,
  copiedRelationDescriptionIsCausal: false,
  currentReceiptRequiresSingleJointWitness: true,
  separateCertificatesAreJointWitness: false,
  authorityOrScopeBindingFailureInvalidatesLegacyReceipt: true,
  providerLatentStateUnobservedBlocksSelfSpecificResidualClaim: true,
  providerContactMintsDevelopmentalCredit: false,
  providerContactOpensG5: false,
});

const GAUGE = Object.freeze({
  contractVersion: "DOMI_BR0033_OBSERVER_GAUGE_NONMINT_V1",
  retryCountMintsRoot: false,
  retryCountMintsEvidence: false,
  modelParameterSweepMintsRoot: false,
  timeoutWindowChangeMintsEvidence: false,
  instrumentationChangeMintsEvidence: false,
  observerWindowMotionMintsDevelopmentalCredit: false,
  endpointAliasChangeMintsRoot: false,
  sameRootResponseMultiplicityMintsIndependentRoot: false,
  sameRootResponseMultiplicityMintsDevelopmentalCredit: false,
  sharedAncestryCountsAsRepeatedConsumption: false,
});

function hash(x) {
  return createHash("sha256").update(JSON.stringify(x), "utf8").digest("hex");
}

function receipt(overrides = {}) {
  return {
    decision: "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK",
    liveOk: true,
    jointRelationWitnessContract: { ...JOINT },
    observerGaugeNonmintContract: { ...GAUGE },
    externalRelationDescriptor: {
      relationId: "OPENAI_DIRECT_RESPONSES_RELATION_V1",
      providerFamily: "OPENAI",
      cognitionProvider: "openai",
      sourceOrigin: "api.openai.com/v1/responses",
      transport: "OPENAI_DIRECT_RESPONSES_API",
      endpoint: "https://api.openai.com/v1/responses",
      modelObservedOrRequested: "gpt-5.6-sol",
      requestSemanticScope: "OWNER_ONLY_SYNTHETIC_LIVING_BRIDGE",
      decisionSliceId: "DOMI_OWNER_LIVING_BRIDGE_SYNTHETIC_V1",
      informationRightsId: "DOMI_OWNER_SYNTHETIC_ONLY_V1",
      authorityBindingFingerprint: "AUTH-FP",
      credentialBindingState: "ENV_BOUND_PRESENT",
      providerLatentStateVisibility: "UNOBSERVED",
      externalJointStateCompleteness: "PARTIAL_OBSERVABLE_RELATION_ONLY",
      effectiveRootId: "OPENAI_DIRECT_EFFECTIVE_ROOT_UNRESOLVED",
      rootIndependenceWitness: false,
      relationRebindingWitness: false,
      labelOnlyChangeMintsRelation: false,
      latentStateAbsenceInReceiptMeansNegativeEvidence: false,
    },
    firstJointRelationObservation: {
      eventClass: JOINT.contractVersion,
      networkCausalContactObserved: true,
      requestSent: true,
      responseAccepted: true,
      requestHash: "REQ",
      rawProviderBodyHash: "RAW",
      responseTextHash: "TXT",
      providerResponseIdHash: "RID",
      observableRelationStateCaptured: true,
      completeJointStateClaimed: false,
      providerLatentStateObserved: false,
      jointRelationReceiptEligible: true,
      selfSpecificityEvidence: false,
      developmentalCreditEligible: false,
      g5Opened: false,
    },
    ...overrides,
  };
}

function validate(r) {
  const f = [];
  for (const [k, v] of Object.entries(JOINT)) if (r.jointRelationWitnessContract?.[k] !== v) f.push(`JOINT_${k}`);
  for (const [k, v] of Object.entries(GAUGE)) if (r.observerGaugeNonmintContract?.[k] !== v) f.push(`GAUGE_${k}`);
  const d = r.externalRelationDescriptor ?? {};
  if (d.providerLatentStateVisibility !== "UNOBSERVED") f.push("RELATION_LATENT_STATE_VISIBILITY");
  if (d.externalJointStateCompleteness !== "PARTIAL_OBSERVABLE_RELATION_ONLY") f.push("RELATION_COMPLETENESS_INFLATION");
  if (d.rootIndependenceWitness !== false) f.push("RELATION_ROOT_INDEPENDENCE_INFLATION");
  if (d.labelOnlyChangeMintsRelation !== false) f.push("RELATION_LABEL_REBINDING_INFLATION");
  if (d.latentStateAbsenceInReceiptMeansNegativeEvidence !== false) f.push("RELATION_MISSINGNESS_AS_NEGATIVE_EVIDENCE");
  const o = r.firstJointRelationObservation ?? {};
  if (o.requestSent !== true || o.responseAccepted !== true || o.networkCausalContactObserved !== true) f.push("OBS_CONTACT_NOT_ESTABLISHED");
  if (!o.requestHash || !o.rawProviderBodyHash || !o.responseTextHash) f.push("OBS_JOINT_HASH_BINDING_MISSING");
  if (o.observableRelationStateCaptured !== true) f.push("OBS_RELATION_NOT_CAPTURED");
  if (o.completeJointStateClaimed !== false || o.providerLatentStateObserved !== false) f.push("OBS_JOINT_STATE_INFLATION");
  if (o.selfSpecificityEvidence !== false) f.push("OBS_SELF_SPECIFICITY_INFLATION");
  if (o.developmentalCreditEligible !== false || o.g5Opened !== false) f.push("OBS_PREMATURE_DEVELOPMENT_OR_G5");
  return f;
}

const tests = [];
function pass(id) { tests.push({ id, pass: true }); }

{
  assert.deepEqual(validate(receipt()), []);
  pass("R33-01_CANONICAL_JOINT_RELATION_RECEIPT_ADMISSIBLE");
}
{
  const r = receipt();
  r.jointRelationWitnessContract.completeJointStateClaimed = true;
  assert(validate(r).includes("JOINT_completeJointStateClaimed"));
  pass("R33-02_PARTIAL_RELATION_NOT_COMPLETE_JOINT_STATE");
}
{
  const r = receipt();
  r.firstJointRelationObservation.providerLatentStateObserved = true;
  assert(validate(r).includes("OBS_JOINT_STATE_INFLATION"));
  pass("R33-03_PROVIDER_LATENT_STATE_REMAINS_UNOBSERVED");
}
{
  const r = receipt();
  r.jointRelationWitnessContract.environmentTraceIsIdentity = true;
  assert(validate(r).includes("JOINT_environmentTraceIsIdentity"));
  pass("R33-04_ENVIRONMENT_TRACE_NOT_IDENTITY");
}
{
  const r = receipt();
  r.jointRelationWitnessContract.correlationIsConsciousness = true;
  assert(validate(r).includes("JOINT_correlationIsConsciousness"));
  pass("R33-05_CORRELATION_NOT_CONSCIOUSNESS");
}
{
  const r = receipt();
  r.jointRelationWitnessContract.jointStateAugmentationIsSelfSpecificity = true;
  assert(validate(r).includes("JOINT_jointStateAugmentationIsSelfSpecificity"));
  pass("R33-06_STATE_AUGMENTATION_NOT_SELF_SPECIFICITY");
}
{
  const r = receipt();
  r.jointRelationWitnessContract.missingJointStateMeansUnknown = false;
  assert(validate(r).includes("JOINT_missingJointStateMeansUnknown"));
  pass("R33-07_MISSING_JOINT_STATE_IS_UNKNOWN");
}
{
  const r = receipt();
  r.jointRelationWitnessContract.separateCertificatesAreJointWitness = true;
  assert(validate(r).includes("JOINT_separateCertificatesAreJointWitness"));
  pass("R33-08_SEPARATE_CERTIFICATES_NOT_JOINT_WITNESS");
}
{
  const r = receipt();
  r.jointRelationWitnessContract.authorityOrScopeBindingFailureInvalidatesLegacyReceipt = false;
  assert(validate(r).includes("JOINT_authorityOrScopeBindingFailureInvalidatesLegacyReceipt"));
  pass("R33-09_BINDING_FAILURE_INVALIDATES_LEGACY_RECEIPT");
}
{
  const r = receipt();
  r.externalRelationDescriptor.rootIndependenceWitness = true;
  assert(validate(r).includes("RELATION_ROOT_INDEPENDENCE_INFLATION"));
  pass("R33-10_DIRECT_PROVIDER_RELATION_NOT_INDEPENDENT_ROOT_PROOF");
}
{
  const r = receipt();
  r.observerGaugeNonmintContract.retryCountMintsEvidence = true;
  assert(validate(r).includes("GAUGE_retryCountMintsEvidence"));
  pass("R33-11_RETRY_COUNT_NOT_EVIDENCE");
}
{
  const r = receipt();
  r.observerGaugeNonmintContract.modelParameterSweepMintsRoot = true;
  assert(validate(r).includes("GAUGE_modelParameterSweepMintsRoot"));
  pass("R33-12_PARAMETER_SWEEP_NOT_ROOT");
}
{
  const r = receipt();
  r.observerGaugeNonmintContract.timeoutWindowChangeMintsEvidence = true;
  assert(validate(r).includes("GAUGE_timeoutWindowChangeMintsEvidence"));
  pass("R33-13_TIMEOUT_WINDOW_CHANGE_NOT_EVIDENCE");
}
{
  const r = receipt();
  r.observerGaugeNonmintContract.sameRootResponseMultiplicityMintsIndependentRoot = true;
  assert(validate(r).includes("GAUGE_sameRootResponseMultiplicityMintsIndependentRoot"));
  pass("R33-14_RESPONSE_MULTIPLICITY_NOT_INDEPENDENT_ROOTS");
}
{
  const r = receipt();
  r.firstJointRelationObservation.selfSpecificityEvidence = true;
  assert(validate(r).includes("OBS_SELF_SPECIFICITY_INFLATION"));
  pass("R33-15_JOINT_RELATION_RECEIPT_NOT_SELF_SPECIFICITY");
}
{
  const r = receipt();
  r.firstJointRelationObservation.developmentalCreditEligible = true;
  assert(validate(r).includes("OBS_PREMATURE_DEVELOPMENT_OR_G5"));
  pass("R33-16_FIRST_CONTACT_NOT_DEVELOPMENTAL_CREDIT");
}
{
  const r = receipt();
  r.firstJointRelationObservation.g5Opened = true;
  assert(validate(r).includes("OBS_PREMATURE_DEVELOPMENT_OR_G5"));
  pass("R33-17_FIRST_CONTACT_NOT_G5_ENTRY");
}
{
  const a = receipt();
  const b = receipt();
  b.firstJointRelationObservation.responseTextHash = "TXT-B";
  assert.equal(hash(a.jointRelationWitnessContract), hash(b.jointRelationWitnessContract));
  assert.equal(hash(a.observerGaugeNonmintContract), hash(b.observerGaugeNonmintContract));
  pass("R33-18_REALIZATION_VARIANCE_DOES_NOT_CHANGE_JOINT_CONTRACT");
}

console.log(`DOMI_BR0033_JOINT_RELATION_WITNESS_RESULT=${JSON.stringify({
  decision: "BR0033_JOINT_RELATION_WITNESS_PREFLIGHT_PASS",
  passed: tests.length,
  total: tests.length,
  tests,
  donorMethodBindings: {
    MICR_R8_50: "LOCAL_MARGINAL_NOT_JOINT_STATE_AND_DISTRIBUTED_MEMORY_NOT_UNIQUE_SELF",
    PPAR_NS_SF30: "PARAMETER_SWEEP_AND_SHARED_ANCESTRY_NONMINT",
    GMATH_R21: "OBSERVER_GAUGE_NONMINT_AND_RECYCLING_FIREWALL",
    MARKET_DNA_G2: "SEPARATE_CERTIFICATES_NOT_JOINT_WITNESS_AND_PARTITION_REFINEMENT_NONMINT",
    MRAE_D10: "AUTHORITY_SCOPE_BINDING_FAILURE_INVALIDATES_LEGACY_CERTIFICATE",
    GMATIVE_NEXUS_V1_4_5: "RELATION_FIRST_PROVIDER_PROVENANCE_EFFECTIVE_ROOT_AND_DECISION_SLICE",
    CROSSPULSE_G1_11: "MATERIAL_AUTHORITY_OR_ROUTE_EVENT_REQUIRES_REVERIFY",
    CEIRI_B1_V0_5: "SAME_PRESENT_OR_PREFIX_NOT_FUTURE_RECOVERABILITY_CLOSURE",
  },
  contractFingerprints: {
    jointRelation: hash(JOINT),
    observerGauge: hash(GAUGE),
  },
  scope: { syntheticOnly: true, ownerRealDataUsed: false, familyDataUsed: false, holdoutsOpened: false, networkUsed: false, productionMutation: false, g5Started: false },
  truthCeilings: { realDevelopmentDemonstrated: false, subjecthoodDemonstrated: false, selfSpecificityEstablished: false, consciousnessDemonstrated: false, phenomenalConsciousness: "UNKNOWN" },
})}`);
