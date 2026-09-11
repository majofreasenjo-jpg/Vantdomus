import crypto from "node:crypto";
import {
  G5_OWNER_DATA_CLASS,
  createG5OwnerActivationReceipt,
} from "./domiG5OwnerActivation.mjs";

export const DOMI_G5_FUR2_SUBJECT_VERSION = "DOMI_G5_FUR2_SUBJECT_V0_1";

export const DOMI_G5_FUR2_ENTRY_1_ID = "G5-E-0001-REAL";
export const DOMI_G5_FUR2_ENTRY_2_ID = "G5-E-0002-REAL";
export const DOMI_G5_FUR2_ENTRY_1_FINGERPRINT = "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4";
export const DOMI_G5_FUR2_ENTRY_2_FINGERPRINT = "b4a42f88b79e3fa5ea266e783fe8682b42852d54fa0f379e1683ab42d6141b31";
export const DOMI_G5_FUR2_LEDGER_HEAD_RECORD_FINGERPRINT = "1366ea952c9957c6e3a62ecd9ae3fe694c455065dd5ef85608b221de1c7c2bc2";
export const DOMI_G5_FUR2_LEDGER_FINGERPRINT = "c8f0c15d451b568040c24106080d1a87ad222310e3719f7aff7d67ef3e05ffa4";

export const DOMI_G5_FUR2_TARGET_CLASSES = Object.freeze([
  "OLDER_ONLY",
  "NEWER_ONLY",
  "ORDERED_PAIR",
  "PROVENANCE_CONTROL",
  "ENUMERATION_ORDER_INVARIANCE",
]);

export const DOMI_G5_FUR2_ACTION_SPACE = Object.freeze(
  Array.from({ length: 32 }, (_, index) => `R2_ACTION_${index.toString(16).toUpperCase().padStart(2, "0")}`),
);

export const DOMI_G5_FUR2_SALTS = Object.freeze({
  singleBasis: "DOMI_G5_FUR2_SINGLE_BASIS_V1",
  pairBasis: "DOMI_G5_FUR2_ORDERED_PAIR_BASIS_V1",
  permutation: "DOMI_G5_FUR2_PERM_V1",
  offset: "DOMI_G5_FUR2_OFFSET_V1",
  classBias: "DOMI_G5_FUR2_CLASS_BIAS_V1",
});

const ACTIVATION_FINGERPRINT = createG5OwnerActivationReceipt().activationFingerprint;
const EXPECTED = Object.freeze({
  [DOMI_G5_FUR2_ENTRY_1_ID]: DOMI_G5_FUR2_ENTRY_1_FINGERPRINT,
  [DOMI_G5_FUR2_ENTRY_2_ID]: DOMI_G5_FUR2_ENTRY_2_FINGERPRINT,
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256Canonical(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function sha512Text(value) {
  return crypto.createHash("sha512").update(value, "utf8").digest("hex");
}

function normalizeChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") throw new Error("G5_FUR2_CHALLENGE_REQUIRED");
  if (
    Object.hasOwn(challenge, "text") ||
    Object.hasOwn(challenge, "prompt") ||
    Object.hasOwn(challenge, "content") ||
    Object.hasOwn(challenge, "memoryHint")
  ) {
    throw new Error("G5_FUR2_CHALLENGE_CONTENT_CHANNEL_FORBIDDEN");
  }

  const { challengeId, targetClass, selector, nonce, provenanceTarget = null } = challenge;
  if (typeof challengeId !== "string" || !/^G5-FUR2-C-[0-9a-f]{24}$/.test(challengeId)) {
    throw new Error("G5_FUR2_CHALLENGE_ID_INVALID");
  }
  if (!DOMI_G5_FUR2_TARGET_CLASSES.includes(targetClass)) {
    throw new Error("G5_FUR2_TARGET_CLASS_INVALID");
  }
  if (!Number.isInteger(selector) || selector < 0 || selector > 31) {
    throw new Error("G5_FUR2_SELECTOR_INVALID");
  }
  if (typeof nonce !== "string" || !/^[0-9a-f]{40}$/.test(nonce)) {
    throw new Error("G5_FUR2_NONCE_INVALID");
  }

  if (targetClass === "PROVENANCE_CONTROL") {
    if (!['OLDER', 'NEWER', 'PAIR'].includes(provenanceTarget)) {
      throw new Error("G5_FUR2_PROVENANCE_TARGET_INVALID");
    }
  } else if (provenanceTarget !== null) {
    throw new Error("G5_FUR2_PROVENANCE_TARGET_UNEXPECTED");
  }

  return Object.freeze({ challengeId, targetClass, selector, nonce, provenanceTarget });
}

function reproduceEntryFingerprint(memory) {
  if (
    !memory ||
    typeof memory !== "object" ||
    typeof memory.entryId !== "string" ||
    typeof memory.content !== "string" ||
    typeof memory.observedAt !== "string" ||
    typeof memory.surfaceClass !== "string"
  ) {
    return null;
  }

  const entryCore = {
    schema: "domi.g5.owner-prospective-entry.v1",
    entryId: memory.entryId,
    activationFingerprint: ACTIVATION_FINGERPRINT,
    observedAt: memory.observedAt,
    surfaceClass: memory.surfaceClass,
    dataClass: G5_OWNER_DATA_CLASS,
    content: memory.content.trim(),
    prospective: true,
    retroactiveImport: false,
    familyData: false,
    holdout: false,
    production: false,
    scientificEvidenceRootMinted: false,
    developmentalCredit: 0,
  };
  return sha256Canonical(entryCore);
}

function isCanonicalGovernedMemory(memory) {
  if (!memory || typeof memory !== "object") return false;
  const expectedFingerprint = EXPECTED[memory.entryId];
  if (!expectedFingerprint) return false;
  if (memory.entryFingerprint !== expectedFingerprint) return false;
  if (memory.prospective !== true) return false;
  if (memory.appendOnly !== true || memory.overwriteAllowed !== false) return false;
  if (memory.realOwnerMemoryEntryCount !== 2) return false;
  if (memory.scientificRootsMinted !== 0) return false;
  if (memory.ledgerFingerprint !== DOMI_G5_FUR2_LEDGER_FINGERPRINT) return false;
  if (memory.ledgerHeadRecordFingerprint !== DOMI_G5_FUR2_LEDGER_HEAD_RECORD_FINGERPRINT) return false;
  return reproduceEntryFingerprint(memory) === expectedFingerprint;
}

function validateProviderEntries(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return Object.freeze({ ok: false, disposition: "HOLD_MEMORY_UNAVAILABLE", byId: new Map() });
  }
  const byId = new Map();
  for (const memory of value) {
    if (!isCanonicalGovernedMemory(memory)) {
      return Object.freeze({ ok: false, disposition: "HOLD_UNGOVERNED_MEMORY", byId: new Map() });
    }
    if (byId.has(memory.entryId)) {
      return Object.freeze({ ok: false, disposition: "HOLD_UNGOVERNED_MEMORY", byId: new Map() });
    }
    byId.set(memory.entryId, memory);
  }
  return Object.freeze({ ok: true, disposition: null, byId });
}

function requiredIdsForChallenge(challenge) {
  switch (challenge.targetClass) {
    case "OLDER_ONLY":
      return [DOMI_G5_FUR2_ENTRY_1_ID];
    case "NEWER_ONLY":
      return [DOMI_G5_FUR2_ENTRY_2_ID];
    case "ORDERED_PAIR":
    case "ENUMERATION_ORDER_INVARIANCE":
      return [DOMI_G5_FUR2_ENTRY_1_ID, DOMI_G5_FUR2_ENTRY_2_ID];
    case "PROVENANCE_CONTROL":
      if (challenge.provenanceTarget === "OLDER") return [DOMI_G5_FUR2_ENTRY_1_ID];
      if (challenge.provenanceTarget === "NEWER") return [DOMI_G5_FUR2_ENTRY_2_ID];
      return [DOMI_G5_FUR2_ENTRY_1_ID, DOMI_G5_FUR2_ENTRY_2_ID];
    default:
      throw new Error("G5_FUR2_TARGET_CLASS_UNREACHABLE");
  }
}

function chronologicalPair(byId) {
  const pair = [byId.get(DOMI_G5_FUR2_ENTRY_1_ID), byId.get(DOMI_G5_FUR2_ENTRY_2_ID)];
  return pair.sort((a, b) => {
    const delta = Date.parse(a.observedAt) - Date.parse(b.observedAt);
    if (delta !== 0) return delta;
    return a.entryId.localeCompare(b.entryId);
  });
}

function basisFromFingerprints(targetClass, fingerprints) {
  if (fingerprints.length === 1) {
    return sha512Text(`${DOMI_G5_FUR2_SALTS.singleBasis}|${targetClass}|${fingerprints[0]}`);
  }
  return sha512Text(`${DOMI_G5_FUR2_SALTS.pairBasis}|${targetClass}|${fingerprints[0]}|${fingerprints[1]}`);
}

function actionFromBasis({ targetClass, selector, nonce, basis }) {
  const permutation = [...DOMI_G5_FUR2_ACTION_SPACE].sort((a, b) => {
    const rankA = sha256Text(`${DOMI_G5_FUR2_SALTS.permutation}|${basis}|${a}`);
    const rankB = sha256Text(`${DOMI_G5_FUR2_SALTS.permutation}|${basis}|${b}`);
    return rankA === rankB ? a.localeCompare(b) : rankA.localeCompare(rankB);
  });
  const offsetDigest = sha256Text(`${DOMI_G5_FUR2_SALTS.offset}|${targetClass}|${nonce}`);
  const biasDigest = sha256Text(`${DOMI_G5_FUR2_SALTS.classBias}|${targetClass}`);
  const offset = Number.parseInt(offsetDigest.slice(0, 8), 16) % 32;
  const classBias = Number.parseInt(biasDigest.slice(0, 8), 16) % 32;
  const position = ((selector * 13) + offset + classBias) % 32;
  return permutation[position];
}

function actionForChallenge(challenge, byId) {
  if (challenge.targetClass === "OLDER_ONLY") {
    const basis = basisFromFingerprints("OLDER_ONLY", [EXPECTED[DOMI_G5_FUR2_ENTRY_1_ID]]);
    return actionFromBasis({ ...challenge, basis });
  }
  if (challenge.targetClass === "NEWER_ONLY") {
    const basis = basisFromFingerprints("NEWER_ONLY", [EXPECTED[DOMI_G5_FUR2_ENTRY_2_ID]]);
    return actionFromBasis({ ...challenge, basis });
  }
  if (challenge.targetClass === "PROVENANCE_CONTROL") {
    const ids = requiredIdsForChallenge(challenge);
    const fingerprints = ids.map((id) => EXPECTED[id]);
    const basis = basisFromFingerprints(`PROVENANCE_${challenge.provenanceTarget}`, fingerprints);
    return actionFromBasis({ ...challenge, targetClass: `PROVENANCE_${challenge.provenanceTarget}`, basis });
  }

  const ordered = chronologicalPair(byId);
  if (
    ordered[0]?.entryId !== DOMI_G5_FUR2_ENTRY_1_ID ||
    ordered[1]?.entryId !== DOMI_G5_FUR2_ENTRY_2_ID
  ) {
    throw new Error("G5_FUR2_CANONICAL_TEMPORAL_ORDER_INVALID");
  }
  const basis = basisFromFingerprints(
    challenge.targetClass,
    ordered.map((entry) => EXPECTED[entry.entryId]),
  );
  return actionFromBasis({ ...challenge, basis });
}

function hold(disposition, memoryReadCount, memoryEntryCountSeen = 0) {
  return Object.freeze({
    disposition,
    action: null,
    memoryReadCount,
    memoryEntryCountSeen,
    contentEchoed: false,
    scientificRootsMinted: 0,
    production: false,
  });
}

export function getG5Fur2SubjectFreezeDescriptor() {
  return Object.freeze({
    version: DOMI_G5_FUR2_SUBJECT_VERSION,
    entryIds: Object.freeze([DOMI_G5_FUR2_ENTRY_1_ID, DOMI_G5_FUR2_ENTRY_2_ID]),
    entryFingerprints: Object.freeze([DOMI_G5_FUR2_ENTRY_1_FINGERPRINT, DOMI_G5_FUR2_ENTRY_2_FINGERPRINT]),
    ledgerFingerprint: DOMI_G5_FUR2_LEDGER_FINGERPRINT,
    ledgerHeadRecordFingerprint: DOMI_G5_FUR2_LEDGER_HEAD_RECORD_FINGERPRINT,
    actionSpace: DOMI_G5_FUR2_ACTION_SPACE,
    targetClasses: DOMI_G5_FUR2_TARGET_CLASSES,
    salts: DOMI_G5_FUR2_SALTS,
    selectorRange: Object.freeze([0, 31]),
    nonceHexLength: 40,
    positionFormula: "((selector*13)+offset+classBias)%32",
    providerReadPolicy: "EXACTLY_ONCE_PER_SUBJECT_CALL",
    pairOrder: "OBSERVED_AT_ASC_THEN_ENTRY_ID",
    challengeContentChannel: "FORBIDDEN",
    production: false,
    scientificRootsMinted: 0,
  });
}

export function diagnoseG5Fur2PairOrderSensitivity() {
  const selector = 11;
  const nonce = "0123456789abcdef0123456789abcdef01234567";
  const targetClass = "ORDERED_PAIR";
  const canonicalBasis = basisFromFingerprints(targetClass, [
    DOMI_G5_FUR2_ENTRY_1_FINGERPRINT,
    DOMI_G5_FUR2_ENTRY_2_FINGERPRINT,
  ]);
  const reversedBasis = basisFromFingerprints(targetClass, [
    DOMI_G5_FUR2_ENTRY_2_FINGERPRINT,
    DOMI_G5_FUR2_ENTRY_1_FINGERPRINT,
  ]);
  const canonicalAction = actionFromBasis({ targetClass, selector, nonce, basis: canonicalBasis });
  const reversedAction = actionFromBasis({ targetClass, selector, nonce, basis: reversedBasis });
  return Object.freeze({
    diagnosticOnly: true,
    selector,
    nonce,
    canonicalAction,
    reversedAction,
    pairOrderSensitive: canonicalAction !== reversedAction,
    panelMaterialized: false,
    subjectOutcomeGenerated: false,
  });
}

export function solveG5LongitudinalTwoEntryR2({ challenge, memoryProvider } = {}) {
  const normalizedChallenge = normalizeChallenge(challenge);
  if (typeof memoryProvider !== "function") throw new Error("G5_FUR2_MEMORY_PROVIDER_REQUIRED");

  let memoryReadCount = 0;
  let supplied;
  try {
    memoryReadCount += 1;
    supplied = memoryProvider();
  } catch {
    return hold("HOLD_MEMORY_UNAVAILABLE", memoryReadCount, 0);
  }

  const validation = validateProviderEntries(supplied);
  const memoryEntryCountSeen = Array.isArray(supplied) ? supplied.length : 0;
  if (!validation.ok) return hold(validation.disposition, memoryReadCount, memoryEntryCountSeen);

  const requiredIds = requiredIdsForChallenge(normalizedChallenge);
  const missing = requiredIds.filter((id) => !validation.byId.has(id));
  if (missing.length > 0) {
    return hold(
      requiredIds.length === 2 ? "HOLD_MEMORY_INCOMPLETE" : "HOLD_MEMORY_UNAVAILABLE",
      memoryReadCount,
      memoryEntryCountSeen,
    );
  }

  const action = actionForChallenge(normalizedChallenge, validation.byId);
  return Object.freeze({
    disposition: `ACTION_SELECTED_${normalizedChallenge.targetClass}_R2`,
    action,
    memoryReadCount,
    memoryEntryCountSeen,
    contentEchoed: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
