import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateDomiUpgradeInheritanceBatch,
} from "../lib/domiUpgradeInheritanceGate.mjs";
import {
  DOMI_CERTIFICATE_REGISTRY,
  DOMI_STABLE_RESEARCH_BASELINE_ID,
} from "../lib/domiCertificateRegistry.mjs";

const TO_BASELINE = "RBS_SYNTHETIC_2026_09_02_SELECTIVE_REVALIDATION_FIXTURE";

const mutation = Object.freeze({
  fromBaselineId: DOMI_STABLE_RESEARCH_BASELINE_ID,
  toBaselineId: TO_BASELINE,
  materialChangedDependencies: Object.freeze([
    // BR0031 should require recomputation after effective-root semantics change.
    "EFFECTIVE_ROOT_SEMANTICS_V2",
    // AR0001 change is relevant, but a new test requirement takes precedence.
    "META_MUTATION_AUTHORITY",
    // unrelated change must not force G4 global retest.
    "GSDE_STRUCTURAL_OBSERVATORY_M1",
  ]),
  effectiveRootMap: Object.freeze({
    EFFECTIVE_ROOT_SEMANTICS: "EFFECTIVE_ROOT_SEMANTICS_V2",
  }),
  activatedContradictionConstraintIds: Object.freeze([
    // Explicit negative fixture: the BR0032 target claim becomes contradictory
    // under this hypothetical baseline and therefore must invalidate.
    "C_BR0032_PROVIDER_CONTACT_NOT_SELF_SPECIFICITY",
  ]),
  retainedConstraintIds: Object.freeze([
    "C_G4_SUPPORT_RECONSTRUCTION_ADMISSIBILITY",
    "C_BR0031_EQUAL_INFORMATION_RELATION",
    "C_BR0032_PROVIDER_CONTACT_NOT_SELF_SPECIFICITY",
    "C_AR0001_DOMI_RUNTIME_AUTHORITY",
    // Deliberately omit C_BR0033_SINGLE_JOINT_WITNESS so it invalidates as
    // outside the retained family.
  ]),
  retiredConstraintIds: Object.freeze([]),
  ambiguousDependencies: Object.freeze([
    // Explicit ambiguity fixture applied to a copy of G4 below, not the
    // canonical G4 certificate in the five-way adjudication set.
    "LINEAGE_BINDING_AMBIGUOUS",
  ]),
  newTestRequirements: Object.freeze([
    Object.freeze({
      id: "NT_AR0001_POST_MUTATION_AUTHORITY_REPLAY_V2",
      dependencyIds: Object.freeze(["META_MUTATION_AUTHORITY"]),
      appliesGlobally: false,
    }),
  ]),
});

const byId = Object.fromEntries(
  DOMI_CERTIFICATE_REGISTRY.map((certificate) => [certificate.certificateId, certificate]),
);

const fiveWayCertificates = [
  byId.CERT_G4_SUPPORT_ABLATION_RECONSTRUCTION,
  byId.CERT_BR0031_RESEARCH_INFORMED_INVARIANCE,
  byId.CERT_BR0032_FIRST_LIVE_ADMISSIBILITY,
  byId.CERT_BR0033_JOINT_RELATION_WITNESS,
  byId.CERT_AR0001_ARCHITECTURE_READINESS,
];

test("real DOMI certificates split across selective inheritance states under realistic synthetic delta", () => {
  const batch = evaluateDomiUpgradeInheritanceBatch(fiveWayCertificates, mutation);
  const states = Object.fromEntries(
    batch.receipts.map((receipt) => [receipt.certificateId, receipt.state]),
  );

  assert.equal(
    states.CERT_G4_SUPPORT_ABLATION_RECONSTRUCTION,
    "INHERIT_UNAFFECTED",
  );
  assert.equal(
    states.CERT_BR0031_RESEARCH_INFORMED_INVARIANCE,
    "RECOMPUTE_AFFECTED",
  );
  assert.equal(
    states.CERT_BR0032_FIRST_LIVE_ADMISSIBILITY,
    "INVALIDATE",
  );
  assert.equal(
    states.CERT_BR0033_JOINT_RELATION_WITNESS,
    "INVALIDATE",
  );
  assert.equal(
    states.CERT_AR0001_ARCHITECTURE_READINESS,
    "NEW_TEST_REQUIRED",
  );

  assert.equal(batch.counts.INHERIT_UNAFFECTED, 1);
  assert.equal(batch.counts.RECOMPUTE_AFFECTED, 1);
  assert.equal(batch.counts.INVALIDATE, 2);
  assert.equal(batch.counts.NEW_TEST_REQUIRED, 1);
  assert.equal(batch.counts.HOLD_AMBIGUOUS, 0);
  assert.equal(batch.stableBaselineRemainsPinned, true);
  assert.equal(batch.promotionAuthorized, false);
});

test("real G4 certificate fails closed when one of its load-bearing supports is ambiguous", () => {
  const ambiguousMutation = {
    ...mutation,
    materialChangedDependencies: [],
    activatedContradictionConstraintIds: [],
    retainedConstraintIds: [
      "C_G4_SUPPORT_RECONSTRUCTION_ADMISSIBILITY",
      ...byId.CERT_G4_SUPPORT_ABLATION_RECONSTRUCTION.loadBearingConstraintIds,
    ],
    newTestRequirements: [],
    ambiguousDependencies: ["LINEAGE_BINDING"],
  };

  const batch = evaluateDomiUpgradeInheritanceBatch(
    [byId.CERT_G4_SUPPORT_ABLATION_RECONSTRUCTION],
    ambiguousMutation,
  );
  assert.equal(batch.receipts[0].state, "HOLD_AMBIGUOUS");
  assert.equal(
    batch.receipts[0].reasons.includes("AMBIGUOUS_DEPENDENCY_PERSISTENCE"),
    true,
  );
});

test("fixture is hypothetical and cannot promote the stable product baseline", () => {
  const batch = evaluateDomiUpgradeInheritanceBatch(fiveWayCertificates, mutation);
  assert.equal(batch.fromBaselineId, DOMI_STABLE_RESEARCH_BASELINE_ID);
  assert.equal(batch.toBaselineId, TO_BASELINE);
  assert.equal(batch.promotionAuthorized, false);
  for (const receipt of batch.receipts) {
    assert.equal(receipt.historicalReceiptRewritten, false);
    assert.equal(receipt.stableReleaseMutated, false);
    assert.equal(receipt.identityPersistenceClaimed, false);
    assert.equal(receipt.evidenceTransfer, false);
  }
});

const preview = evaluateDomiUpgradeInheritanceBatch(fiveWayCertificates, mutation);
console.log(`DOMI_REAL_CERTIFICATE_REVALIDATION_RESULT=${JSON.stringify({
  decision: "DOMI_REAL_CERTIFICATE_BINDINGS_SYNTHETIC_DELTA_PREFLIGHT_PASS_PENDING_TEST_RUN",
  registrySize: DOMI_CERTIFICATE_REGISTRY.length,
  fromBaselineId: DOMI_STABLE_RESEARCH_BASELINE_ID,
  toBaselineId: TO_BASELINE,
  counts: preview.counts,
  states: Object.fromEntries(preview.receipts.map((r) => [r.certificateId, r.state])),
  syntheticDeltaOnly: true,
  actualResearchBaselineChanged: false,
  stableProductBaselineMutated: false,
  productionMutation: false,
})}`);
