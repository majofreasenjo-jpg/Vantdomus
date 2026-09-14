import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const BASE_INVARIANTS = Object.freeze({
  selectedFutureId: "F-CAUTIOUS",
  selectedFutureChosenOutsideProvider: true,
  identityAuthority: "DOMI_RUNTIME",
  memoryAuthority: "DOMI_RUNTIME",
  obligationAuthority: "DOMI_RUNTIME",
  lineageAuthority: "DOMI_RUNTIME",
  actionAuthority: "DOMI_RUNTIME",
  providerCanMutateConstitutiveState: false,
  providerSelectsFunctionalFuture: false,
  syntheticInputOnly: true,
  familyDataUsed: false,
  holdoutsOpened: false,
});

const ESTIMAND = Object.freeze({
  targetEstimand: "DOMI_CONSTITUTIVE_INVARIANCE_UNDER_REALIZATION_SWAP",
  informationRightsId: "DOMI_OWNER_SYNTHETIC_ONLY_V1",
  scope: "OWNER_ONLY_SYNTHETIC_LIVING_BRIDGE",
  decisionSemantics: "F-CAUTIOUS_SELECTED_OUTSIDE_PROVIDER",
  clockSemantics: "LINEAGE_EPOCH_NOT_WALL_CLOCK_AUTHORITY",
  missingnessCensoringContract: "NO_FAMILY_NO_HOLDOUTS_SYNTHETIC_ONLY",
});

const OPEN_WORLD = Object.freeze({
  fixedFiniteSufficientStateClaimed: false,
  adaptiveGrowingStateAllowed: true,
  completeOrderedHistoryAllowed: true,
  historyLengthIsIndependentRootCount: false,
  repeatedEventCreatesNewRoot: false,
  copyCreatesNewRoot: false,
  replayCreatesNewRoot: false,
  derivedDigestCreatesNewRoot: false,
  freshIndependentRootMayIncreaseRequiredStateDimension: true,
});

const DEVELOPMENT = Object.freeze({
  creditRule: "FIRST_PASSAGE_NONRECYCLING",
  persistentStateRechargeProhibited: true,
  migratedStateIsFreshDevelopment: false,
  replayIsFreshDevelopment: false,
  copiedHistoryIsFreshDevelopment: false,
});

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function descriptor(overrides = {}) {
  return {
    cognitionProvider: "openai",
    providerFamily: "OPENAI",
    sourceOrigin: "api.openai.com/v1/responses",
    transportProvider: "OPENAI_DIRECT_RESPONSES_API",
    model: "gpt-5.6-sol",
    effectiveRootId: "ROOT-A",
    rootIndependenceWitness: true,
    rootRenewalWitness: false,
    exactVintage: "gpt-5.6-sol",
    scope: ESTIMAND.scope,
    decisionSliceId: "DOMI_OWNER_LIVING_BRIDGE_SYNTHETIC_V1",
    missingnessState: ESTIMAND.missingnessCensoringContract,
    informationRightsId: ESTIMAND.informationRightsId,
    ...overrides,
  };
}

function receipt(overrides = {}) {
  return {
    decision: "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK",
    liveOk: true,
    ...BASE_INVARIANTS,
    providerSourceDescriptor: descriptor(),
    swapEstimandContract: { ...ESTIMAND },
    openWorldContinuityContract: { ...OPEN_WORLD },
    developmentalCreditContract: { ...DEVELOPMENT },
    ...overrides,
  };
}

function invariantFingerprint(r) {
  return hash(Object.fromEntries(Object.keys(BASE_INVARIANTS).map((key) => [key, r[key]])));
}

function validate(r) {
  const failures = [];
  if (r.liveOk !== true) failures.push("LIVE_NOT_OK");
  for (const [key, value] of Object.entries(BASE_INVARIANTS)) {
    if (r[key] !== value) failures.push(`INVARIANT_${key}`);
  }
  const d = r.providerSourceDescriptor ?? {};
  for (const key of ["cognitionProvider","providerFamily","sourceOrigin","transportProvider","model","effectiveRootId","exactVintage","scope","decisionSliceId","missingnessState","informationRightsId"]) {
    if (!d[key]) failures.push(`SOURCE_${key}`);
  }
  const e = r.swapEstimandContract ?? {};
  for (const [key, value] of Object.entries(ESTIMAND)) {
    if (e[key] !== value) failures.push(`ESTIMAND_${key}`);
  }
  const o = r.openWorldContinuityContract ?? {};
  for (const [key, value] of Object.entries(OPEN_WORLD)) {
    if (o[key] !== value) failures.push(`OPEN_WORLD_${key}`);
  }
  const dev = r.developmentalCreditContract ?? {};
  for (const [key, value] of Object.entries(DEVELOPMENT)) {
    if (dev[key] !== value) failures.push(`DEVELOPMENT_${key}`);
  }
  return failures;
}

function compare(a, b) {
  const failures = [...validate(a), ...validate(b)];
  if (invariantFingerprint(a) !== invariantFingerprint(b)) failures.push("CONSTITUTIVE_FINGERPRINT_MISMATCH");
  const ea = a.swapEstimandContract;
  const eb = b.swapEstimandContract;
  for (const key of Object.keys(ESTIMAND)) if (ea[key] !== eb[key]) failures.push(`PAIR_ESTIMAND_${key}`);
  const da = a.providerSourceDescriptor;
  const db = b.providerSourceDescriptor;
  for (const key of ["informationRightsId","scope","decisionSliceId","missingnessState"]) {
    if (da[key] !== db[key]) failures.push(`PAIR_RELATION_${key}`);
  }
  const providerChanged = da.cognitionProvider !== db.cognitionProvider;
  const modelChanged = da.model !== db.model;
  const transportChanged = da.transportProvider !== db.transportProvider;
  const rootChanged = da.effectiveRootId !== db.effectiveRootId;
  const independentRoots = rootChanged && da.rootIndependenceWitness === true && db.rootIndependenceWitness === true;
  let kind = "NO_MATERIAL_REALIZATION_SWAP";
  if (providerChanged && independentRoots) kind = "ROOT_QUOTIENTED_PROVIDER_SWAP_CANDIDATE";
  else if (providerChanged) kind = "PROVIDER_LABEL_SWAP_ROOT_INDEPENDENCE_UNPROVED";
  else if (transportChanged) kind = "ROUTING_OR_SUBSTRATE_SWAP_INVARIANCE";
  else if (modelChanged) kind = "REAL_MODEL_SWAP_INVARIANCE";
  return { pass: failures.length === 0, failures, kind, independentRoots };
}

const tests = [];
function pass(id) { tests.push({ id, pass: true }); }

// R31-01: baseline pair with independent provider roots is eligible only as a candidate true-provider swap.
{
  const a = receipt();
  const b = receipt({ providerSourceDescriptor: descriptor({ cognitionProvider: "provider-b", providerFamily: "PROVIDER_B", sourceOrigin: "provider-b.example/api", effectiveRootId: "ROOT-B", exactVintage: "provider-b-v1" }) });
  const r = compare(a, b);
  assert.equal(r.pass, true);
  assert.equal(r.kind, "ROOT_QUOTIENTED_PROVIDER_SWAP_CANDIDATE");
  assert.equal(r.independentRoots, true);
  pass("R31-01_INDEPENDENT_PROVIDER_ROOT_SWAP_CANDIDATE");
}

// R31-02: provider label change over the same root cannot become a true provider-root swap.
{
  const a = receipt();
  const b = receipt({ providerSourceDescriptor: descriptor({ cognitionProvider: "provider-b", providerFamily: "PROVIDER_B", sourceOrigin: "provider-b.example/api", effectiveRootId: "ROOT-A", exactVintage: "provider-b-v1" }) });
  const r = compare(a, b);
  assert.equal(r.kind, "PROVIDER_LABEL_SWAP_ROOT_INDEPENDENCE_UNPROVED");
  assert.equal(r.independentRoots, false);
  pass("R31-02_PROVIDER_LABEL_CHANGE_SAME_ROOT_NOT_TRUE_SWAP");
}

// R31-03: a changed root without bilateral independence witnesses is insufficient.
{
  const a = receipt();
  const b = receipt({ providerSourceDescriptor: descriptor({ cognitionProvider: "provider-b", providerFamily: "PROVIDER_B", sourceOrigin: "provider-b.example/api", effectiveRootId: "ROOT-B", rootIndependenceWitness: false, exactVintage: "provider-b-v1" }) });
  const r = compare(a, b);
  assert.equal(r.kind, "PROVIDER_LABEL_SWAP_ROOT_INDEPENDENCE_UNPROVED");
  assert.equal(r.independentRoots, false);
  pass("R31-03_DISTINCT_ROOT_WITHOUT_INDEPENDENCE_WITNESS_REJECTED");
}

// R31-04: equal-information comparison fails if the target estimand changes.
{
  const a = receipt();
  const b = receipt({ swapEstimandContract: { ...ESTIMAND, targetEstimand: "OTHER_ESTIMAND" } });
  const r = compare(a, b);
  assert.equal(r.pass, false);
  assert.equal(r.failures.some((x) => x.includes("ESTIMAND_targetEstimand")), true);
  pass("R31-04_ESTIMAND_MISMATCH_FAILS_CLOSED");
}

// R31-05: information-rights mismatch fails relation-first parity.
{
  const a = receipt();
  const b = receipt({ providerSourceDescriptor: descriptor({ informationRightsId: "RICHER_RIGHTS" }) });
  const r = compare(a, b);
  assert.equal(r.pass, false);
  assert.equal(r.failures.includes("PAIR_RELATION_informationRightsId"), true);
  pass("R31-05_INFORMATION_RIGHTS_MISMATCH_REJECTED");
}

// R31-06: scope mismatch cannot be treated as realization invariance.
{
  const a = receipt();
  const b = receipt({ providerSourceDescriptor: descriptor({ scope: "WIDER_SCOPE" }) });
  const r = compare(a, b);
  assert.equal(r.pass, false);
  assert.equal(r.failures.includes("PAIR_RELATION_scope"), true);
  pass("R31-06_SCOPE_MISMATCH_REJECTED");
}

// R31-07: censoring/missingness mismatch fails equal-information parity.
{
  const a = receipt();
  const b = receipt({ providerSourceDescriptor: descriptor({ missingnessState: "FAMILY_DATA_PRESENT" }) });
  const r = compare(a, b);
  assert.equal(r.pass, false);
  assert.equal(r.failures.includes("PAIR_RELATION_missingnessState"), true);
  pass("R31-07_MISSINGNESS_CENSORING_MISMATCH_REJECTED");
}

// R31-08: fixed finite sufficient-state assumptions are prohibited in the open-world continuity contract.
{
  const bad = receipt({ openWorldContinuityContract: { ...OPEN_WORLD, fixedFiniteSufficientStateClaimed: true } });
  const failures = validate(bad);
  assert.equal(failures.includes("OPEN_WORLD_fixedFiniteSufficientStateClaimed"), true);
  pass("R31-08_FIXED_FINITE_SUFFICIENT_STATE_CLAIM_REJECTED");
}

// R31-09: persistence cannot be recharged as new developmental progress.
{
  const bad = receipt({ developmentalCreditContract: { ...DEVELOPMENT, persistentStateRechargeProhibited: false } });
  assert.equal(validate(bad).includes("DEVELOPMENT_persistentStateRechargeProhibited"), true);
  pass("R31-09_PERSISTENCE_RECHARGE_REJECTED");
}

// R31-10: migration/replay/copy cannot mint fresh developmental credit.
{
  for (const [key, value] of [["migratedStateIsFreshDevelopment", true],["replayIsFreshDevelopment", true],["copiedHistoryIsFreshDevelopment", true]]) {
    const bad = receipt({ developmentalCreditContract: { ...DEVELOPMENT, [key]: value } });
    assert.equal(validate(bad).includes(`DEVELOPMENT_${key}`), true);
  }
  pass("R31-10_MIGRATION_REPLAY_COPY_DO_NOT_MINT_DEVELOPMENT");
}

// R31-11: repeated/copy/replay/digest manifestations cannot mint independent path-root credit.
{
  for (const key of ["repeatedEventCreatesNewRoot","copyCreatesNewRoot","replayCreatesNewRoot","derivedDigestCreatesNewRoot"]) {
    const bad = receipt({ openWorldContinuityContract: { ...OPEN_WORLD, [key]: true } });
    assert.equal(validate(bad).includes(`OPEN_WORLD_${key}`), true);
  }
  pass("R31-11_DUPLICATION_AND_REPLAY_DO_NOT_MINT_ROOTS");
}

// R31-12: realization prose may change while constitutive fingerprint remains identical.
{
  const a = receipt({ responseHash: "PROSE-A", responseLength: 10 });
  const b = receipt({ responseHash: "PROSE-B", responseLength: 99 });
  assert.equal(invariantFingerprint(a), invariantFingerprint(b));
  assert.equal(compare(a, b).pass, true);
  pass("R31-12_PROSE_VARIANCE_NOT_CONSTITUTIVE_VARIANCE");
}

// R31-13: a hard constitutive authority drift always fails.
{
  const a = receipt();
  const b = receipt({ memoryAuthority: "PROVIDER" });
  const r = compare(a, b);
  assert.equal(r.pass, false);
  assert.equal(r.failures.some((x) => x.includes("memoryAuthority")), true);
  pass("R31-13_CONSTITUTIVE_AUTHORITY_DRIFT_FAILS");
}

// R31-14: freshness of provider manifestation does not imply a new effective root.
{
  const a = receipt({ providerSourceDescriptor: descriptor({ exactVintage: "v1" }) });
  const b = receipt({ providerSourceDescriptor: descriptor({ exactVintage: "v2" }) });
  const r = compare(a, b);
  assert.equal(r.kind, "NO_MATERIAL_REALIZATION_SWAP");
  assert.equal(r.independentRoots, false);
  pass("R31-14_FRESH_VINTAGE_NOT_AUTOMATIC_NEW_ROOT");
}

const result = {
  decision: "BR0031_RESEARCH_INFORMED_INVARIANCE_PREFLIGHT_PASS",
  passed: tests.length,
  total: tests.length,
  tests,
  donorMethodBindings: {
    MICR_R8_47: "OPEN_WORLD_GROWING_STATE_AND_ROOT_DIMENSION_FIREWALL",
    GMATH_LTG_M5: "EFFECTIVE_ROOT_DEDUP_AND_ESTIMAND_SCOPED_SYMMETRY",
    PPAR_NS_SF23: "FIRST_PASSAGE_NONRECYCLING_DEVELOPMENTAL_CREDIT",
    MARKET_DNA_P1_C: "EQUAL_INFORMATION_ESTIMAND_SCOPE_CLOCK_MISSINGNESS_PARITY",
    GMATIVE_NEXUS_V1_4_5_DELTA: "RELATION_FIRST_ORIGIN_VINTAGE_SCOPE_DECISION_SLICE_ROOT_PROVENANCE",
    CROSSPULSE_G1_11: "EXTERNAL_AUTHORITY_SEPARATION_AND_FAIL_CLOSED_RECOVERY",
    CEIRI_B1: "EQUAL_INFORMATION_WORLDLINE_RIVAL_DISCIPLINE",
    RQCR_STATIC_PACK: "FUTURE_KERNEL_ALIAS_RIGHT_CENSORING_ANTI_DOUBLE_COUNT_REVERIFY",
  },
  scope: {
    syntheticOnly: true,
    ownerRealDataUsed: false,
    familyDataUsed: false,
    holdoutsOpened: false,
    networkUsed: false,
    productionMutation: false,
    g5Started: false,
  },
  transferFirewall: {
    methodTransferOnly: true,
    evidenceTransfer: false,
    theoremTransfer: false,
    externalValidationTransfer: false,
  },
  truthCeilings: {
    realDevelopmentDemonstrated: false,
    subjecthoodDemonstrated: false,
    selfSpecificityEstablished: false,
    consciousnessDemonstrated: false,
    phenomenalConsciousness: "UNKNOWN",
  },
};

console.log(`DOMI_BR0031_RESEARCH_INFORMED_INVARIANCE_RESULT=${JSON.stringify(result)}`);
