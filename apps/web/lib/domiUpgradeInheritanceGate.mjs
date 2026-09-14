import { createHash } from "node:crypto";

export const DOMI_CERTIFICATE_INHERITANCE_STATES = Object.freeze([
  "INHERIT_UNAFFECTED",
  "RECOMPUTE_AFFECTED",
  "INVALIDATE",
  "NEW_TEST_REQUIRED",
  "HOLD_AMBIGUOUS",
]);

export const DOMI_UPGRADE_INHERITANCE_METHOD = Object.freeze({
  id: "DOMI_UPGRADE_INHERITANCE_GATE_V0_1",
  donorMethod: "KG_L9_INHERITED_SIGNED_LATTICE_PERSISTENCE_METHOD_INSPIRATION",
  targetNativeRepresentation: "DEPENDENCY_GRAPH_PLUS_SIGNED_CONSTRAINT_IDENTITY",
  snfHnfUsed: false,
  snfHnfDeferralReason:
    "DOMI_SIGNED_INTEGER_LATTICE_REPRESENTATION_NOT_YET_FROZEN_TARGET_NATIVELY",
  researchBaselineHotMutationAllowed: false,
  historicalReceiptRewriteAllowed: false,
  ambiguousInheritanceDefaultsToPass: false,
});

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean))].sort();
}

function resolveAlias(id, effectiveRootMap = {}) {
  let current = id;
  const seen = new Set();
  while (effectiveRootMap[current]) {
    if (seen.has(current)) {
      return { id: current, ambiguous: true, reason: "ALIAS_CYCLE" };
    }
    seen.add(current);
    current = effectiveRootMap[current];
  }
  return { id: current, ambiguous: false, reason: null };
}

function canonicalize(values = [], effectiveRootMap = {}) {
  const ids = [];
  const ambiguities = [];
  for (const value of values) {
    const resolved = resolveAlias(value, effectiveRootMap);
    ids.push(resolved.id);
    if (resolved.ambiguous) ambiguities.push(value);
  }
  return { ids: uniqueSorted(ids), ambiguities: uniqueSorted(ambiguities) };
}

function intersect(a = [], b = []) {
  const bs = new Set(b);
  return uniqueSorted(a.filter((item) => bs.has(item)));
}

function normalizeNewTests(newTestRequirements = [], effectiveRootMap = {}) {
  return newTestRequirements.map((test) => ({
    id: test.id,
    appliesGlobally: test.appliesGlobally === true,
    dependencyIds: canonicalize(test.dependencyIds ?? [], effectiveRootMap).ids,
  }));
}

function makeReceipt({ certificate, mutation, state, reasons, diagnostics }) {
  const receiptCore = {
    gateVersion: DOMI_UPGRADE_INHERITANCE_METHOD.id,
    certificateId: certificate.certificateId,
    historicalReceiptId: certificate.historicalReceiptId,
    sourceBaselineId: certificate.sourceBaselineId,
    candidateBaselineId: mutation.toBaselineId,
    state,
    reasons: uniqueSorted(reasons),
    diagnostics,
    historicalReceiptRewritten: false,
    stableReleaseMutated: false,
    promotionAuthorized: false,
    methodTransferOnly: true,
    evidenceTransfer: false,
    identityPersistenceClaimed: false,
  };
  return Object.freeze({ ...receiptCore, receiptHash: hash(receiptCore) });
}

export function assessDomiCertificateInheritance(certificate, mutation) {
  const effectiveRootMap = mutation.effectiveRootMap ?? {};
  const dep = canonicalize(certificate.loadBearingDependencies ?? [], effectiveRootMap);
  const changed = canonicalize(mutation.materialChangedDependencies ?? [], effectiveRootMap);
  const ambiguous = canonicalize(mutation.ambiguousDependencies ?? [], effectiveRootMap);
  const constraintIds = uniqueSorted(certificate.loadBearingConstraintIds ?? []);
  const contradictions = uniqueSorted(mutation.activatedContradictionConstraintIds ?? []);
  const retired = uniqueSorted(mutation.retiredConstraintIds ?? []);
  const retained = mutation.retainedConstraintIds
    ? new Set(uniqueSorted(mutation.retainedConstraintIds))
    : null;
  const newTests = normalizeNewTests(mutation.newTestRequirements ?? [], effectiveRootMap);

  const diagnostics = {
    canonicalLoadBearingDependencies: dep.ids,
    canonicalMaterialChanges: changed.ids,
    canonicalAmbiguousDependencies: ambiguous.ids,
    relevantMaterialChanges: intersect(dep.ids, changed.ids),
    relevantAmbiguities: intersect(dep.ids, ambiguous.ids),
    relevantActivatedContradictions: intersect(constraintIds, contradictions),
    retiredLoadBearingConstraints: intersect(constraintIds, retired),
    relevantNewTests: [],
    aliasResolutionAmbiguities: uniqueSorted([
      ...dep.ambiguities,
      ...changed.ambiguities,
      ...ambiguous.ambiguities,
    ]),
    aliasRefinementsObserved: uniqueSorted(mutation.aliasRefinementDependencies ?? []),
    targetConstraintId: certificate.targetConstraintId ?? null,
    targetConstraintRetained:
      certificate.targetConstraintId && retained
        ? retained.has(certificate.targetConstraintId)
        : null,
  };

  const reasons = [];

  if (!certificate.certificateId || !certificate.historicalReceiptId) {
    reasons.push("MISSING_CERTIFICATE_OR_RECEIPT_ID");
    return makeReceipt({
      certificate,
      mutation,
      state: "HOLD_AMBIGUOUS",
      reasons,
      diagnostics,
    });
  }

  if (certificate.sourceBaselineId !== mutation.fromBaselineId) {
    reasons.push("SOURCE_BASELINE_MISMATCH");
    return makeReceipt({
      certificate,
      mutation,
      state: "HOLD_AMBIGUOUS",
      reasons,
      diagnostics,
    });
  }

  if (dep.ids.length === 0) {
    reasons.push("NO_LOAD_BEARING_DEPENDENCY_SET");
    return makeReceipt({
      certificate,
      mutation,
      state: "HOLD_AMBIGUOUS",
      reasons,
      diagnostics,
    });
  }

  if (
    mutation.globalAmbiguity === true ||
    diagnostics.relevantAmbiguities.length > 0 ||
    diagnostics.aliasResolutionAmbiguities.length > 0
  ) {
    reasons.push("AMBIGUOUS_DEPENDENCY_PERSISTENCE");
    return makeReceipt({
      certificate,
      mutation,
      state: "HOLD_AMBIGUOUS",
      reasons,
      diagnostics,
    });
  }

  const target = certificate.targetConstraintId ?? null;
  if (target && retired.includes(target)) {
    reasons.push("TARGET_CONSTRAINT_RETIRED");
    return makeReceipt({
      certificate,
      mutation,
      state: "INVALIDATE",
      reasons,
      diagnostics,
    });
  }

  if (target && retained && !retained.has(target)) {
    reasons.push("TARGET_OUTSIDE_RETAINED_CONSTRAINT_FAMILY");
    return makeReceipt({
      certificate,
      mutation,
      state: "INVALIDATE",
      reasons,
      diagnostics,
    });
  }

  if (
    diagnostics.relevantActivatedContradictions.length > 0 ||
    diagnostics.retiredLoadBearingConstraints.length > 0
  ) {
    if (diagnostics.relevantActivatedContradictions.length > 0) {
      reasons.push("LOAD_BEARING_CONTRADICTION_ACTIVATED");
    }
    if (diagnostics.retiredLoadBearingConstraints.length > 0) {
      reasons.push("LOAD_BEARING_CONSTRAINT_RETIRED");
    }
    return makeReceipt({
      certificate,
      mutation,
      state: "INVALIDATE",
      reasons,
      diagnostics,
    });
  }

  diagnostics.relevantNewTests = uniqueSorted(
    newTests
      .filter(
        (test) =>
          test.appliesGlobally || intersect(dep.ids, test.dependencyIds).length > 0,
      )
      .map((test) => test.id),
  );

  if (diagnostics.relevantNewTests.length > 0) {
    reasons.push("NEW_LOAD_BEARING_TEST_REQUIRED");
    return makeReceipt({
      certificate,
      mutation,
      state: "NEW_TEST_REQUIRED",
      reasons,
      diagnostics,
    });
  }

  if (diagnostics.relevantMaterialChanges.length > 0) {
    reasons.push("LOAD_BEARING_DEPENDENCY_CHANGED");
    return makeReceipt({
      certificate,
      mutation,
      state: "RECOMPUTE_AFFECTED",
      reasons,
      diagnostics,
    });
  }

  reasons.push("LOAD_BEARING_SUPPORT_UNAFFECTED");
  return makeReceipt({
    certificate,
    mutation,
    state: "INHERIT_UNAFFECTED",
    reasons,
    diagnostics,
  });
}

export function evaluateDomiUpgradeInheritanceBatch(certificates, mutation) {
  const receipts = certificates.map((certificate) =>
    assessDomiCertificateInheritance(certificate, mutation),
  );
  const counts = Object.fromEntries(
    DOMI_CERTIFICATE_INHERITANCE_STATES.map((state) => [
      state,
      receipts.filter((receipt) => receipt.state === state).length,
    ]),
  );
  const summaryCore = {
    gateVersion: DOMI_UPGRADE_INHERITANCE_METHOD.id,
    fromBaselineId: mutation.fromBaselineId,
    toBaselineId: mutation.toBaselineId,
    stableBaselineRemainsPinned: true,
    promotionAuthorized: false,
    historicalReceiptsRewritten: false,
    counts,
    receiptHashes: receipts.map((receipt) => receipt.receiptHash),
  };
  return Object.freeze({
    ...summaryCore,
    batchHash: hash(summaryCore),
    receipts: Object.freeze(receipts),
  });
}
