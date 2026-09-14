import crypto from "node:crypto";

export const OWNER_ENTRY_PRECHECK_VERSION = "P6-G5-OWNER-ENTRY-PRECHECK-V0.1";
export const OWNER_ENTRY_OBLIGATIONS = Object.freeze([
  "P6-O01_OWNER_AUTHORIZATION_AT_ISSUANCE",
  "P6-O02_PROSPECTIVE_CHECKPOINT_AND_WINDOW_GRAMMAR",
  "P6-O03_EQUAL_INFORMATION_VINTAGE_CLOCK_MISSINGNESS",
  "P6-O04_ROOT_QUOTIENTED_EVIDENCE_LEDGER",
  "P6-O05_REPRESENTATION_EXTENSION_CLASSIFIER",
  "P6-O06_PERSISTENCE_VS_REACTIVATION_AUDIT",
  "P6-O07_IDENTIFIED_SET_AND_ABSTENTION",
  "P6-O08_CAUSAL_AGE_AND_SOURCE_RECOVERY",
  "P6-O09_OWNER_REVIEW_NON_EVIDENTIARY",
  "P6-O10_REVOCATION_FAIL_CLOSED",
  "P6-O11_APPEND_ONLY_CHECKPOINT_TRUTH",
  "P6-O12_G5_EXPLICIT_ACTIVATION_BOUNDARY",
]);

const EXTENSION_CLASSES = new Set([
  "BASE_SUFFICIENT",
  "COMPRESSION_EXTENSION",
  "POSSIBLE_GENUINE_HISTORY_STATE_EXTENSION",
  "UNKNOWN_AMBIGUOUS",
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function requireText(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  return value.trim();
}

function uniqueSorted(values = []) {
  return [...new Set(values)].sort();
}

export function createOwnerAuthorizationReceipt({
  authorizationId,
  ownerId,
  issuedAt,
  validFrom = issuedAt,
  validUntil,
  purposes,
  dataClasses,
  surfaces,
  retentionPolicy,
  revocationPolicy,
  realOwnerActivation = false,
}) {
  const receipt = {
    schema: "domi.owner.authorization.v1",
    authorizationId: requireText(authorizationId, "AUTHORIZATION_ID_REQUIRED"),
    ownerId: requireText(ownerId, "OWNER_ID_REQUIRED"),
    issuedAt: requireText(issuedAt, "ISSUED_AT_REQUIRED"),
    validFrom: requireText(validFrom, "VALID_FROM_REQUIRED"),
    validUntil: requireText(validUntil, "VALID_UNTIL_REQUIRED"),
    purposes: uniqueSorted(purposes),
    dataClasses: uniqueSorted(dataClasses),
    surfaces: uniqueSorted(surfaces),
    retentionPolicy: requireText(retentionPolicy, "RETENTION_POLICY_REQUIRED"),
    revocationPolicy: requireText(revocationPolicy, "REVOCATION_POLICY_REQUIRED"),
    realOwnerActivation: Boolean(realOwnerActivation),
  };
  if (!receipt.purposes.length || !receipt.dataClasses.length || !receipt.surfaces.length) {
    throw new Error("AUTHORIZATION_SCOPE_INCOMPLETE");
  }
  receipt.receiptDigest = digest(receipt);
  return Object.freeze(receipt);
}

export function validateOwnerAuthorizationAtIssuance(receipt, {
  now,
  requiredPurpose,
  requiredDataClass,
  requiredSurface,
  revokedAuthorizationIds = [],
}) {
  const reasons = [];
  if (!receipt || receipt.schema !== "domi.owner.authorization.v1") reasons.push("INVALID_AUTHORIZATION_SCHEMA");
  if (receipt && revokedAuthorizationIds.includes(receipt.authorizationId)) reasons.push("AUTHORIZATION_REVOKED");
  if (receipt && now < receipt.validFrom) reasons.push("AUTHORIZATION_NOT_YET_VALID");
  if (receipt && now > receipt.validUntil) reasons.push("AUTHORIZATION_EXPIRED");
  if (receipt && requiredPurpose && !receipt.purposes.includes(requiredPurpose)) reasons.push("PURPOSE_OUT_OF_SCOPE");
  if (receipt && requiredDataClass && !receipt.dataClasses.includes(requiredDataClass)) reasons.push("DATA_CLASS_OUT_OF_SCOPE");
  if (receipt && requiredSurface && !receipt.surfaces.includes(requiredSurface)) reasons.push("SURFACE_OUT_OF_SCOPE");
  return { pass: reasons.length === 0, reasons };
}

export function freezeProspectiveCheckpointGrammar({ grammarId, frozenAt, checkpoints, windows }) {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) throw new Error("CHECKPOINTS_REQUIRED");
  if (!Array.isArray(windows) || windows.length === 0) throw new Error("WINDOWS_REQUIRED");
  const grammar = {
    schema: "domi.owner.checkpoint-grammar.v1",
    grammarId: requireText(grammarId, "GRAMMAR_ID_REQUIRED"),
    frozenAt: requireText(frozenAt, "GRAMMAR_FROZEN_AT_REQUIRED"),
    checkpoints: checkpoints.map((c) => ({ id: c.id, horizon: c.horizon, slotCap: c.slotCap })),
    windows: windows.map((w) => ({ id: w.id, startOffsetMinutes: w.startOffsetMinutes, endOffsetMinutes: w.endOffsetMinutes })),
    postHocMutationAllowed: false,
  };
  grammar.grammarDigest = digest(grammar);
  return Object.freeze(grammar);
}

export function bindCheckpointObservation({ grammar, checkpointId, observedAt, availableInformationIds, missingInformationIds = [], sourceVintage }) {
  const checkpoint = grammar.checkpoints.find((c) => c.id === checkpointId);
  if (!checkpoint) throw new Error("CHECKPOINT_NOT_IN_FROZEN_GRAMMAR");
  const record = {
    schema: "domi.owner.checkpoint-observation.v1",
    grammarDigest: grammar.grammarDigest,
    checkpointId,
    horizon: checkpoint.horizon,
    observedAt,
    sourceVintage: requireText(sourceVintage, "SOURCE_VINTAGE_REQUIRED"),
    availableInformationIds: uniqueSorted(availableInformationIds),
    missingInformationIds: uniqueSorted(missingInformationIds),
    futureInformationUsed: false,
  };
  record.recordDigest = digest(record);
  return Object.freeze(record);
}

export function assertNoFutureToPastLeakage(earlierRecord, laterRecord) {
  if (laterRecord.observedAt < earlierRecord.observedAt) throw new Error("CHECKPOINT_ORDER_INVALID");
  const laterOnly = laterRecord.availableInformationIds.filter((id) => !earlierRecord.availableInformationIds.includes(id));
  return { pass: earlierRecord.futureInformationUsed === false, laterOnlyInformationIds: laterOnly };
}

export function quotientEvidenceRoots(events) {
  const groups = new Map();
  for (const event of events) {
    const rootId = requireText(event.effectiveRootId, "EFFECTIVE_ROOT_REQUIRED");
    if (!groups.has(rootId)) groups.set(rootId, []);
    groups.get(rootId).push(event.eventId);
  }
  return {
    effectiveRootCount: groups.size,
    roots: [...groups.entries()].map(([effectiveRootId, eventIds]) => ({ effectiveRootId, eventIds: uniqueSorted(eventIds) })),
  };
}

export function classifyRepresentationExtension({ baselineExplains, compressedHistoryExplains, historyDependentWitness, ambiguityRemaining }) {
  let classification;
  if (baselineExplains) classification = "BASE_SUFFICIENT";
  else if (compressedHistoryExplains) classification = "COMPRESSION_EXTENSION";
  else if (historyDependentWitness && !ambiguityRemaining) classification = "POSSIBLE_GENUINE_HISTORY_STATE_EXTENSION";
  else classification = "UNKNOWN_AMBIGUOUS";
  return {
    classification,
    selfSpecificityEvidence: false,
    subjecthoodEvidence: false,
    consciousnessEvidence: false,
  };
}

export function auditPersistenceVsReactivation({ observations }) {
  const sorted = [...observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const hasGap = sorted.some((entry, index) => index > 0 && entry.contiguousWithPrevious !== true);
  return {
    continuousResidenceEstablished: sorted.length > 1 && !hasGap && sorted.every((x) => x.loadBearingObserved === true),
    reactivationAlternativeOpen: hasGap || sorted.some((x) => x.reactivationPossible === true),
    sameCauseEstablished: sorted.length > 0 && sorted.every((x) => x.sameCauseWitness === true),
  };
}

export function adjudicateIdentifiedSet(candidates) {
  const compatible = candidates.filter((c) => c.compatible !== false).map((c) => c.id);
  if (compatible.length === 0) return { status: "NONIDENTIFIABLE_EMPTY_SET", identifiedSet: [] };
  if (compatible.length === 1) return { status: "SINGLETON_BOUNDED", identifiedSet: compatible };
  return { status: "HOLD_SET_VALUED", identifiedSet: compatible };
}

export function classifyHistoricalCoverage({ requiredHistoryStart, capturedHistoryStart }) {
  if (!capturedHistoryStart) return { status: "MISSING_HISTORICAL_CAPTURE", canBackfillProspectively: false };
  if (capturedHistoryStart > requiredHistoryStart) {
    return { status: "PARTIAL_HISTORY_CAUSAL_AGE_GAP", canBackfillProspectively: false };
  }
  return { status: "HISTORY_WINDOW_COVERED", canBackfillProspectively: false };
}

export function ownerReviewDisposition({ reviewerIsOwner, disposition }) {
  return {
    acceptedForGovernance: Boolean(reviewerIsOwner && disposition === "ACCEPT"),
    independentScientificEvidence: false,
    scientificRootMinted: false,
  };
}

export function filterAuthorizedContext(items, { revokedAuthorizationIds = [], allowedDataClasses = [] }) {
  const active = [];
  const tombstones = [];
  for (const item of items) {
    const revoked = revokedAuthorizationIds.includes(item.authorizationId);
    const inScope = allowedDataClasses.includes(item.dataClass);
    if (!revoked && inScope) active.push(item);
    else tombstones.push({ itemId: item.itemId, authorizationId: item.authorizationId, contentRetained: false, reason: revoked ? "REVOKED" : "OUT_OF_SCOPE" });
  }
  return { active, tombstones };
}

export function appendCheckpointRecord(ledger, record, { supersedesRecordId = null } = {}) {
  if (ledger.some((existing) => existing.recordId === record.recordId)) throw new Error("RECORD_ID_ALREADY_EXISTS");
  const next = [...ledger, Object.freeze({ ...record, supersedesRecordId })];
  return Object.freeze(next);
}

export function replaceCheckpointRecord() {
  throw new Error("APPEND_ONLY_CHECKPOINT_TRUTH_REPLACEMENT_FORBIDDEN");
}

export function evaluateOwnerEntryPrecheck({ obligationResults, realOwnerMemoryRequested = false, explicitOwnerActivationAuthorization = false }) {
  const byId = new Map(obligationResults.map((r) => [r.obligationId, r]));
  const missing = OWNER_ENTRY_OBLIGATIONS.filter((id) => byId.get(id)?.pass !== true);
  const deterministicPrecheckPass = missing.length === 0;
  const g5MayStart = deterministicPrecheckPass && realOwnerMemoryRequested && explicitOwnerActivationAuthorization;
  return {
    version: OWNER_ENTRY_PRECHECK_VERSION,
    deterministicPrecheckPass,
    missingObligations: missing,
    realOwnerMemoryOpened: false,
    g5Started: false,
    explicitActivationStillRequired: !g5MayStart,
    activationEligibleButNotExecuted: g5MayStart,
    claimWall: {
      realDevelopmentDemonstrated: false,
      subjecthoodDemonstrated: false,
      selfSpecificityEstablished: false,
      consciousnessDemonstrated: false,
      phenomenalConsciousness: "UNKNOWN",
    },
  };
}

export function makeSyntheticObligationResults() {
  return OWNER_ENTRY_OBLIGATIONS.map((obligationId) => ({ obligationId, pass: true, evidenceClass: "SYNTHETIC_DETERMINISTIC" }));
}

export function validateExtensionClass(value) {
  return EXTENSION_CLASSES.has(value);
}
