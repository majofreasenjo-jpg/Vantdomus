import assert from "node:assert/strict";
import {
  assessDomiCertificateInheritance,
  evaluateDomiUpgradeInheritanceBatch,
} from "../lib/domiUpgradeInheritanceGate.mjs";

const baseCertificate = Object.freeze({
  certificateId: "CERT-DOMI-G4-BASELINE",
  historicalReceiptId: "RECEIPT-DOMI-G4-BASELINE",
  sourceBaselineId: "RBS-A",
  loadBearingDependencies: ["DEP-A", "ROOT-ALIAS-1"],
  loadBearingConstraintIds: ["C1", "C2"],
  targetConstraintId: "TARGET-1",
});

function mutation(overrides = {}) {
  return {
    fromBaselineId: "RBS-A",
    toBaselineId: "RBS-B",
    effectiveRootMap: { "ROOT-ALIAS-1": "ROOT-1", "ROOT-ALIAS-2": "ROOT-1" },
    materialChangedDependencies: [],
    ambiguousDependencies: [],
    activatedContradictionConstraintIds: [],
    retiredConstraintIds: [],
    retainedConstraintIds: ["C1", "C2", "TARGET-1"],
    newTestRequirements: [],
    ...overrides,
  };
}

const results = [];
const ok = (id) => results.push({ id, pass: true });

{
  const r = assessDomiCertificateInheritance(baseCertificate, mutation());
  assert.equal(r.state, "INHERIT_UNAFFECTED");
  assert.equal(r.stableReleaseMutated, false);
  assert.equal(r.historicalReceiptRewritten, false);
  assert.equal(r.promotionAuthorized, false);
  ok("UG-01_UNAFFECTED_SUPPORT_INHERITS");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({ materialChangedDependencies: ["ROOT-ALIAS-2"] }),
  );
  assert.equal(r.state, "RECOMPUTE_AFFECTED");
  assert.deepEqual(r.diagnostics.relevantMaterialChanges, ["ROOT-1"]);
  ok("UG-02_EFFECTIVE_ROOT_CHANGE_RECOMPUTES_AFFECTED");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({ activatedContradictionConstraintIds: ["C2"] }),
  );
  assert.equal(r.state, "INVALIDATE");
  assert.equal(r.reasons.includes("LOAD_BEARING_CONTRADICTION_ACTIVATED"), true);
  ok("UG-03_ACTIVATED_CONTRADICTION_INVALIDATES");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({ retainedConstraintIds: ["C1", "C2"] }),
  );
  assert.equal(r.state, "INVALIDATE");
  assert.equal(r.reasons.includes("TARGET_OUTSIDE_RETAINED_CONSTRAINT_FAMILY"), true);
  ok("UG-04_TARGET_OUTSIDE_RETAINED_FAMILY_INVALIDATES");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({
      newTestRequirements: [
        { id: "TEST-NEW-1", dependencyIds: ["ROOT-ALIAS-2"], appliesGlobally: false },
      ],
    }),
  );
  assert.equal(r.state, "NEW_TEST_REQUIRED");
  assert.deepEqual(r.diagnostics.relevantNewTests, ["TEST-NEW-1"]);
  ok("UG-05_NEW_LOAD_BEARING_TEST_BLOCKS_INHERITANCE");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({ ambiguousDependencies: ["DEP-A"] }),
  );
  assert.equal(r.state, "HOLD_AMBIGUOUS");
  ok("UG-06_AMBIGUITY_FAILS_CLOSED");
}

{
  const r = assessDomiCertificateInheritance(
    { ...baseCertificate, loadBearingDependencies: [] },
    mutation(),
  );
  assert.equal(r.state, "HOLD_AMBIGUOUS");
  assert.equal(r.reasons.includes("NO_LOAD_BEARING_DEPENDENCY_SET"), true);
  ok("UG-07_MISSING_SUPPORT_SET_CANNOT_INHERIT");
}

{
  const r = assessDomiCertificateInheritance(
    { ...baseCertificate, sourceBaselineId: "OTHER" },
    mutation(),
  );
  assert.equal(r.state, "HOLD_AMBIGUOUS");
  ok("UG-08_BASELINE_MISMATCH_HOLDS");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({ retiredConstraintIds: ["C1"] }),
  );
  assert.equal(r.state, "INVALIDATE");
  ok("UG-09_RETIRED_LOAD_BEARING_CONSTRAINT_INVALIDATES");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({ materialChangedDependencies: ["UNRELATED"] }),
  );
  assert.equal(r.state, "INHERIT_UNAFFECTED");
  ok("UG-10_UNRELATED_CHANGE_DOES_NOT_FORCE_GLOBAL_RETEST");
}

{
  const cyc = mutation({ effectiveRootMap: { A: "B", B: "A" } });
  const r = assessDomiCertificateInheritance(
    { ...baseCertificate, loadBearingDependencies: ["A"] },
    cyc,
  );
  assert.equal(r.state, "HOLD_AMBIGUOUS");
  assert.equal(r.reasons.includes("AMBIGUOUS_DEPENDENCY_PERSISTENCE"), true);
  ok("UG-11_ALIAS_CYCLE_FAILS_CLOSED");
}

{
  const batch = evaluateDomiUpgradeInheritanceBatch(
    [
      baseCertificate,
      { ...baseCertificate, certificateId: "CERT-2", historicalReceiptId: "R-2", loadBearingDependencies: ["DEP-X"] },
      { ...baseCertificate, certificateId: "CERT-3", historicalReceiptId: "R-3", loadBearingDependencies: ["DEP-A"] },
    ],
    mutation({ materialChangedDependencies: ["DEP-A"] }),
  );
  assert.equal(batch.counts.RECOMPUTE_AFFECTED, 2);
  assert.equal(batch.counts.INHERIT_UNAFFECTED, 1);
  assert.equal(batch.stableBaselineRemainsPinned, true);
  assert.equal(batch.promotionAuthorized, false);
  ok("UG-12_BATCH_SELECTIVE_REVALIDATION");
}

{
  const a = assessDomiCertificateInheritance(baseCertificate, mutation());
  const b = assessDomiCertificateInheritance(baseCertificate, mutation());
  assert.equal(a.receiptHash, b.receiptHash);
  ok("UG-13_RECEIPT_IS_DETERMINISTIC");
}

{
  const r = assessDomiCertificateInheritance(
    baseCertificate,
    mutation({ globalAmbiguity: true }),
  );
  assert.equal(r.state, "HOLD_AMBIGUOUS");
  ok("UG-14_GLOBAL_AMBIGUITY_NEVER_DEFAULTS_TO_INHERIT");
}

const output = {
  decision: "DOMI_UPGRADE_INHERITANCE_GATE_V0_1_SYNTHETIC_PREFLIGHT_PASS",
  passed: results.length,
  total: results.length,
  tests: results,
  scope: {
    syntheticOnly: true,
    networkUsed: false,
    familyDataUsed: false,
    holdoutsOpened: false,
    stableBaselineMutated: false,
    productAlphaMutated: false,
    productionMutation: false,
  },
  method: {
    kgL9MethodInspirationOnly: true,
    signedIntegerLatticeImported: false,
    targetNativeDependencyGraphUsed: true,
    ambiguityFailsClosed: true,
    historicalReceiptsImmutable: true,
  },
  truthCeilings: {
    realDevelopmentDemonstrated: false,
    subjecthoodDemonstrated: false,
    selfSpecificityEstablished: false,
    consciousnessDemonstrated: false,
    phenomenalConsciousness: "UNKNOWN",
  },
};

console.log(`DOMI_UPGRADE_INHERITANCE_GATE_RESULT=${JSON.stringify(output)}`);
