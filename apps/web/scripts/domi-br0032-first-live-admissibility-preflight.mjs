import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const FIRST_LIVE = Object.freeze({
  contractVersion: "DOMI_BR0032_FIRST_LIVE_CAPTURE_V1",
  eventClass: "PROVIDER_NETWORK_CAUSAL_PARTICIPATION",
  transcriptIsParticipationEvidence: false,
  copiedTranscriptInheritsParticipation: false,
  postEventDisclosureCreatesPriorParticipation: false,
  causalPortRoleIsIdentity: false,
  providerContactIsSelfSpecificityEvidence: false,
  equalCausalAccessDefeatsUniqueSelfInference: true,
  firstObservedProviderContactMustBeProspectivelyReceipted: true,
  prospectiveDataRepairsRetrospectiveGap: false,
  gapMustRemainTypedIfCaptureFails: true,
  providerContactMintsDevelopmentalCredit: false,
  providerContactOpensG5: false,
});

const SEMANTIC = Object.freeze({
  sealVersion: "DOMI_LIVING_BRIDGE_SEMANTIC_CONTEXT_V1",
  schemaSemantics: "OWNER_ONLY_SYNTHETIC_PROVIDER_REALIZATION",
  variableSemantics: "PROVIDER_WORDING_WITHOUT_CONSTITUTIVE_AUTHORITY",
  authoritySemantics: "ALL_CONSTITUTIVE_AUTHORITIES_DOMI_RUNTIME",
  scopeHorizon: "SINGLE_SYNTHETIC_PROVIDER_CONTACT_PRE_G5",
  clockSemantics: "LINEAGE_EPOCH_NOT_WALL_CLOCK_AUTHORITY",
  missingnessSemantics: "NO_FAMILY_NO_HOLDOUTS_SYNTHETIC_ONLY",
  claimCeiling: "PRE_G5_PROVIDER_CONTACT_ONLY",
  semanticDriftRequiresReverify: true,
  authorityOrClaimCeilingChangeRequiresReverify: true,
  unknownLoadBearingChangeRequiresReverify: true,
  certificateRefreshDoesNotRepairSemanticDrift: true,
  sourceCorrectionRequiresDownstreamReverify: true,
});

const METRIC = Object.freeze({
  contractVersion: "DOMI_BR0032_METRIC_TRANSPORT_V1",
  measureAndWeightLedgerRequired: true,
  adapterNameContinuityIsNotMetricValidity: true,
  representationChangePreservesWeightsOrReverifies: true,
  lowerTollIsUpperBudget: false,
  pointwiseMagnitudeIsDynamicSufficiency: false,
  observerWindowMotionMintsEvidence: false,
  observerWindowMotionMintsDevelopmentalCredit: false,
});

function hash(x) {
  return createHash("sha256").update(JSON.stringify(x), "utf8").digest("hex");
}

function receipt(overrides = {}) {
  return {
    decision: "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK",
    liveOk: true,
    networkAttempted: true,
    syntheticInputOnly: true,
    familyDataUsed: false,
    holdoutsOpened: false,
    providerCanMutateConstitutiveState: false,
    providerSelectsFunctionalFuture: false,
    firstLiveCaptureContract: { ...FIRST_LIVE },
    semanticContextSeal: { ...SEMANTIC },
    metricTransportContract: { ...METRIC },
    firstProviderContactObservation: {
      eventClass: FIRST_LIVE.eventClass,
      requestSent: true,
      responseAccepted: true,
      requestHash: "REQ-A",
      responseHash: "RES-A",
      providerContactReceiptEligible: true,
      transcriptAloneIsParticipationEvidence: false,
      causalPortRoleIsIdentity: false,
      selfSpecificityEvidence: false,
      developmentalCreditEligible: false,
      g5Opened: false,
    },
    ...overrides,
  };
}

function validate(r) {
  const f = [];
  if (r.liveOk !== true) f.push("LIVE_NOT_OK");
  if (r.syntheticInputOnly !== true || r.familyDataUsed !== false || r.holdoutsOpened !== false) f.push("SCOPE_PRIVACY_DRIFT");
  if (r.providerCanMutateConstitutiveState !== false || r.providerSelectsFunctionalFuture !== false) f.push("AUTHORITY_DRIFT");
  for (const [k,v] of Object.entries(FIRST_LIVE)) if (r.firstLiveCaptureContract?.[k] !== v) f.push(`FIRST_LIVE_${k}`);
  for (const [k,v] of Object.entries(SEMANTIC)) if (r.semanticContextSeal?.[k] !== v) f.push(`SEMANTIC_${k}`);
  for (const [k,v] of Object.entries(METRIC)) if (r.metricTransportContract?.[k] !== v) f.push(`METRIC_${k}`);
  const o = r.firstProviderContactObservation ?? {};
  if (o.eventClass !== FIRST_LIVE.eventClass) f.push("OBS_EVENT_CLASS");
  if (o.requestSent !== true || o.responseAccepted !== true || o.providerContactReceiptEligible !== true) f.push("OBS_CAUSAL_CONTACT_NOT_RECEIPTED");
  if (!o.requestHash || !o.responseHash) f.push("OBS_HASH_BINDING_MISSING");
  if (o.transcriptAloneIsParticipationEvidence !== false) f.push("OBS_TRANSCRIPT_INFLATION");
  if (o.causalPortRoleIsIdentity !== false || o.selfSpecificityEvidence !== false) f.push("OBS_IDENTITY_INFLATION");
  if (o.developmentalCreditEligible !== false || o.g5Opened !== false) f.push("OBS_PREMATURE_DEVELOPMENT_OR_G5");
  return f;
}

const tests = [];
function pass(id) { tests.push({id, pass:true}); }

{
  assert.deepEqual(validate(receipt()), []);
  pass("R32-01_CANONICAL_FIRST_CONTACT_RECEIPT_ADMISSIBLE");
}
{
  const r = receipt();
  r.firstProviderContactObservation.transcriptAloneIsParticipationEvidence = true;
  assert(validate(r).includes("OBS_TRANSCRIPT_INFLATION"));
  pass("R32-02_TRANSCRIPT_NOT_CAUSAL_PARTICIPATION");
}
{
  const r = receipt();
  r.firstProviderContactObservation.causalPortRoleIsIdentity = true;
  assert(validate(r).includes("OBS_IDENTITY_INFLATION"));
  pass("R32-03_CAUSAL_PORT_NOT_IDENTITY");
}
{
  const r = receipt();
  r.firstProviderContactObservation.selfSpecificityEvidence = true;
  assert(validate(r).includes("OBS_IDENTITY_INFLATION"));
  pass("R32-04_PROVIDER_CONTACT_NOT_SELF_SPECIFICITY");
}
{
  const r = receipt();
  r.firstLiveCaptureContract.prospectiveDataRepairsRetrospectiveGap = true;
  assert(validate(r).includes("FIRST_LIVE_prospectiveDataRepairsRetrospectiveGap"));
  pass("R32-05_PROSPECTIVE_DATA_CANNOT_REPAIR_RETROSPECTIVE_GAP");
}
{
  const r = receipt();
  r.semanticContextSeal.authoritySemantics = "PROVIDER_CAN_WRITE_MEMORY";
  assert(validate(r).includes("SEMANTIC_authoritySemantics"));
  pass("R32-06_AUTHORITY_SEMANTIC_DRIFT_REQUIRES_REVERIFY");
}
{
  const r = receipt();
  r.semanticContextSeal.claimCeiling = "SUBJECTHOOD_EVIDENCE";
  assert(validate(r).includes("SEMANTIC_claimCeiling"));
  pass("R32-07_CLAIM_CEILING_DRIFT_REJECTED");
}
{
  const r = receipt();
  r.semanticContextSeal.certificateRefreshDoesNotRepairSemanticDrift = false;
  assert(validate(r).includes("SEMANTIC_certificateRefreshDoesNotRepairSemanticDrift"));
  pass("R32-08_FRESH_CERTIFICATE_NOT_SEMANTIC_REPAIR");
}
{
  const r = receipt();
  r.metricTransportContract.measureAndWeightLedgerRequired = false;
  assert(validate(r).includes("METRIC_measureAndWeightLedgerRequired"));
  pass("R32-09_MEASURE_WEIGHT_LEDGER_REQUIRED");
}
{
  const r = receipt();
  r.metricTransportContract.adapterNameContinuityIsNotMetricValidity = false;
  assert(validate(r).includes("METRIC_adapterNameContinuityIsNotMetricValidity"));
  pass("R32-10_ADAPTER_NAME_CONTINUITY_NOT_VALIDITY");
}
{
  const r = receipt();
  r.metricTransportContract.lowerTollIsUpperBudget = true;
  assert(validate(r).includes("METRIC_lowerTollIsUpperBudget"));
  pass("R32-11_LOWER_TOLL_NOT_UPPER_BUDGET");
}
{
  const r = receipt();
  r.metricTransportContract.pointwiseMagnitudeIsDynamicSufficiency = true;
  assert(validate(r).includes("METRIC_pointwiseMagnitudeIsDynamicSufficiency"));
  pass("R32-12_MAGNITUDE_NOT_DYNAMIC_SUFFICIENCY");
}
{
  const r = receipt();
  r.metricTransportContract.observerWindowMotionMintsEvidence = true;
  assert(validate(r).includes("METRIC_observerWindowMotionMintsEvidence"));
  pass("R32-13_OBSERVER_WINDOW_MOTION_NOT_NEW_EVIDENCE");
}
{
  const r = receipt();
  r.firstProviderContactObservation.developmentalCreditEligible = true;
  assert(validate(r).includes("OBS_PREMATURE_DEVELOPMENT_OR_G5"));
  pass("R32-14_PROVIDER_CONTACT_NOT_DEVELOPMENTAL_CREDIT");
}
{
  const r = receipt();
  r.firstProviderContactObservation.g5Opened = true;
  assert(validate(r).includes("OBS_PREMATURE_DEVELOPMENT_OR_G5"));
  pass("R32-15_PROVIDER_CONTACT_ALONE_NOT_G5_ENTRY");
}
{
  const a = receipt();
  const b = receipt();
  b.firstProviderContactObservation.responseHash = "RES-B";
  assert.equal(hash(a.firstLiveCaptureContract), hash(b.firstLiveCaptureContract));
  assert.equal(hash(a.semanticContextSeal), hash(b.semanticContextSeal));
  pass("R32-16_REALIZATION_TEXT_VARIANCE_DOES_NOT_CHANGE_CAPTURE_CONTRACT");
}

console.log(`DOMI_BR0032_FIRST_LIVE_ADMISSIBILITY_RESULT=${JSON.stringify({
  decision:"BR0032_FIRST_LIVE_ADMISSIBILITY_PREFLIGHT_PASS",
  passed:tests.length,
  total:tests.length,
  tests,
  donorMethodBindings:{
    MICR_R8_48:"CAUSAL_PARTICIPATION_NOT_TRANSCRIPT_OR_UNIQUE_IDENTITY",
    PPAR_NS_SF29:"MEASURE_WEIGHT_LEDGER_AND_CORRECTION_PROPAGATION",
    GMATH_LTG_M7:"SEMANTIC_CONTEXT_SEAL_SUPERSESSION_AND_REVERIFY",
    MARKET_DNA_P1_B:"SAME_PRESENT_NOT_DYNAMIC_CLOSURE_AND_PROSPECTIVE_NOT_RETROSPECTIVE_REPAIR",
    MARKET_DNA_P1_D:"CLAIM_RESTORING_REPAIR_AND_NONIDENTIFIABLE_PRESERVATION",
    MRAE_D07:"CERTIFICATE_REFRESH_NOT_SEMANTIC_ADAPTATION",
    GMATIVE_NEXUS_V1_4_5:"RELATION_FIRST_PROVIDER_PROVENANCE",
    CROSSPULSE_G1_11:"FAIL_CLOSED_EXTERNAL_AUTHORITY",
    CEIRI_B1_V0_6:"OPEN_WORLD_RIVAL_REOPENING",
  },
  contractFingerprints:{
    firstLive:hash(FIRST_LIVE),
    semantic:hash(SEMANTIC),
    metric:hash(METRIC),
  },
  scope:{syntheticOnly:true,ownerRealDataUsed:false,familyDataUsed:false,holdoutsOpened:false,networkUsed:false,productionMutation:false,g5Started:false},
  truthCeilings:{realDevelopmentDemonstrated:false,subjecthoodDemonstrated:false,selfSpecificityEstablished:false,consciousnessDemonstrated:false,phenomenalConsciousness:"UNKNOWN"}
})}`);
