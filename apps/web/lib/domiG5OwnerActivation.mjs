import crypto from "node:crypto";

export const DOMI_G5_OWNER_ACTIVATION_VERSION = "DOMI_G5_OWNER_LONGITUDINAL_ACTIVATION_V0_1";
export const G5_OWNER_AUTHORIZATION_MARKER = "AUTORIZO G5";
export const G5_OWNER_AUTHORIZED_AT = "2026-09-07T10:43:00-03:00";
export const G5_OWNER_AUTHORIZED_AT_UTC = "2026-09-07T13:43:00.000Z";
export const G5_OWNER_LABEL = "Manolo";
export const G5_OWNER_PURPOSE = "OWNER_ONLY_LONGITUDINAL_DOGFOOD";
export const G5_OWNER_DATA_CLASS = "OWNER_NON_SENSITIVE_PROSPECTIVE";
export const G5_OWNER_ALLOWED_SURFACES = Object.freeze([
  "PERSONAL_DESKTOP",
  "PERSONAL_MOBILE",
]);

export const G5_CLAIM_WALL = Object.freeze({
  realDevelopmentDemonstrated: false,
  subjecthoodDemonstrated: false,
  selfSpecificityEstablished: false,
  consciousnessDemonstrated: false,
  phenomenalConsciousness: "UNKNOWN",
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function requireText(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  return value.trim();
}

function toMillis(value, code) {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error(code);
  return millis;
}

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) freezeDeep(item);
  }
  return value;
}

export function createG5OwnerActivationReceipt({
  authorizationMarker = G5_OWNER_AUTHORIZATION_MARKER,
  sourceAuthorizationTimestamp = G5_OWNER_AUTHORIZED_AT,
  ownerLabel = G5_OWNER_LABEL,
} = {}) {
  if (authorizationMarker !== G5_OWNER_AUTHORIZATION_MARKER) {
    throw new Error("G5_EXPLICIT_OWNER_AUTHORIZATION_REQUIRED");
  }
  if (sourceAuthorizationTimestamp !== G5_OWNER_AUTHORIZED_AT) {
    throw new Error("G5_AUTHORIZATION_TIMESTAMP_MISMATCH");
  }
  if (ownerLabel !== G5_OWNER_LABEL) throw new Error("G5_OWNER_LABEL_MISMATCH");

  const receiptCore = {
    schema: "domi.g5.owner-activation.v1",
    version: DOMI_G5_OWNER_ACTIVATION_VERSION,
    activationReceiptId: "G5-OWNER-ACTIVATION-20260907T104300-0300",
    ownerLabel,
    authorizationMarker,
    sourceAuthorizationTimestamp,
    canonicalAuthorizationTimestampUtc: G5_OWNER_AUTHORIZED_AT_UTC,
    purpose: G5_OWNER_PURPOSE,
    allowedDataClasses: [G5_OWNER_DATA_CLASS],
    allowedSurfaces: [...G5_OWNER_ALLOWED_SURFACES],
    familyDataAllowed: false,
    holdoutsAllowed: false,
    productionAllowed: false,
    retentionPolicy: "OWNER_REVOCABLE",
    revocationPolicy: "FAIL_CLOSED",
    retroactiveMemoryImportAllowed: false,
    explicitOwnerAuthorization: true,
    activationAuthorized: true,
    activationState: "ACTIVE",
    g5Started: true,
    realOwnerMemoryBoundaryOpen: true,
    initialAdmissibleMemoryEntryCount: 0,
    realOwnerMemoryEntryCount: 0,
    priorConversationImported: false,
    scientificEvidenceTransfer: false,
    theoremTransfer: false,
    externalValidationTransfer: false,
    scientificRootsMintedByActivation: 0,
    ownerReviewIsIndependentScientificTruth: false,
    claimWall: { ...G5_CLAIM_WALL },
  };
  const activationFingerprint = sha256(receiptCore);
  return freezeDeep({ ...receiptCore, activationFingerprint });
}

export function validateG5ProspectiveOwnerDatum(activationReceipt, {
  observedAt,
  surfaceClass,
  dataClass,
  content,
  familyData = false,
  holdout = false,
  production = false,
  retroactiveImport = false,
} = {}) {
  const reasons = [];
  if (!activationReceipt || activationReceipt.schema !== "domi.g5.owner-activation.v1") {
    reasons.push("G5_ACTIVATION_RECEIPT_INVALID");
  }
  if (activationReceipt?.activationState !== "ACTIVE" || activationReceipt?.g5Started !== true) {
    reasons.push("G5_NOT_ACTIVE");
  }
  if (activationReceipt?.realOwnerMemoryBoundaryOpen !== true) reasons.push("OWNER_MEMORY_BOUNDARY_CLOSED");
  if (!activationReceipt?.allowedSurfaces?.includes(surfaceClass)) reasons.push("SURFACE_OUT_OF_SCOPE");
  if (!activationReceipt?.allowedDataClasses?.includes(dataClass)) reasons.push("DATA_CLASS_OUT_OF_SCOPE");
  if (familyData === true) reasons.push("FAMILY_DATA_FORBIDDEN");
  if (holdout === true) reasons.push("HOLDOUT_FORBIDDEN");
  if (production === true) reasons.push("PRODUCTION_FORBIDDEN");
  if (retroactiveImport === true) reasons.push("RETROACTIVE_IMPORT_FORBIDDEN");
  if (typeof content !== "string" || content.trim() === "") reasons.push("OWNER_DATUM_CONTENT_REQUIRED");

  let observedMillis = Number.NaN;
  try {
    observedMillis = toMillis(observedAt, "INVALID_OBSERVED_AT");
  } catch {
    reasons.push("INVALID_OBSERVED_AT");
  }
  const activationMillis = toMillis(G5_OWNER_AUTHORIZED_AT, "INVALID_ACTIVATION_AT");
  if (Number.isFinite(observedMillis) && observedMillis < activationMillis) {
    reasons.push("OBSERVATION_PREDATES_G5_ACTIVATION");
  }

  return freezeDeep({
    pass: reasons.length === 0,
    reasons,
    prospectiveOnly: true,
    scientificEvidenceCredit: 0,
    developmentalCredit: 0,
  });
}

export function admitG5ProspectiveOwnerDatum(activationReceipt, {
  entryId,
  observedAt,
  surfaceClass,
  dataClass = G5_OWNER_DATA_CLASS,
  content,
  familyData = false,
  holdout = false,
  production = false,
  retroactiveImport = false,
} = {}) {
  const validation = validateG5ProspectiveOwnerDatum(activationReceipt, {
    observedAt,
    surfaceClass,
    dataClass,
    content,
    familyData,
    holdout,
    production,
    retroactiveImport,
  });
  if (!validation.pass) throw new Error(`G5_OWNER_DATUM_REJECTED:${validation.reasons.join("|")}`);

  const entryCore = {
    schema: "domi.g5.owner-prospective-entry.v1",
    entryId: requireText(entryId, "G5_ENTRY_ID_REQUIRED"),
    activationFingerprint: activationReceipt.activationFingerprint,
    observedAt,
    surfaceClass,
    dataClass,
    content: requireText(content, "OWNER_DATUM_CONTENT_REQUIRED"),
    prospective: true,
    retroactiveImport: false,
    familyData: false,
    holdout: false,
    production: false,
    scientificEvidenceRootMinted: false,
    developmentalCredit: 0,
  };
  return freezeDeep({ ...entryCore, entryFingerprint: sha256(entryCore) });
}

export function projectG5ActivationState(activationReceipt, entries = []) {
  const validEntries = entries.filter(
    (entry) => entry?.schema === "domi.g5.owner-prospective-entry.v1" &&
      entry.activationFingerprint === activationReceipt.activationFingerprint,
  );
  return freezeDeep({
    activationFingerprint: activationReceipt.activationFingerprint,
    g5Started: activationReceipt.g5Started === true,
    realOwnerMemoryBoundaryOpen: activationReceipt.realOwnerMemoryBoundaryOpen === true,
    realOwnerMemoryEntryCount: validEntries.length,
    retroactiveImport: false,
    familyData: false,
    holdouts: false,
    production: false,
    scientificRootsMinted: 0,
    claimWall: { ...G5_CLAIM_WALL },
  });
}

export function revokeG5OwnerActivation(activationReceipt, {
  revokedAt,
  reason = "OWNER_REVOKED",
} = {}) {
  requireText(revokedAt, "G5_REVOCATION_TIMESTAMP_REQUIRED");
  if (toMillis(revokedAt, "INVALID_REVOCATION_TIMESTAMP") < toMillis(G5_OWNER_AUTHORIZED_AT, "INVALID_ACTIVATION_AT")) {
    throw new Error("REVOCATION_PREDATES_ACTIVATION");
  }
  const tombstoneCore = {
    schema: "domi.g5.owner-activation-tombstone.v1",
    activationFingerprint: activationReceipt.activationFingerprint,
    revokedAt,
    reason: requireText(reason, "G5_REVOCATION_REASON_REQUIRED"),
    contentRetained: false,
    activeContextRetained: false,
    realOwnerMemoryBoundaryOpen: false,
    g5Started: false,
    scientificEvidenceRootMinted: false,
  };
  return freezeDeep({ ...tombstoneCore, tombstoneFingerprint: sha256(tombstoneCore) });
}

export function assertG5ActivationMintsNoScientificEvidence(activationReceipt) {
  return freezeDeep({
    pass:
      activationReceipt.scientificRootsMintedByActivation === 0 &&
      activationReceipt.scientificEvidenceTransfer === false &&
      activationReceipt.ownerReviewIsIndependentScientificTruth === false,
    scientificRootsMinted: 0,
    evidenceTransfer: false,
  });
}
