import crypto from "node:crypto";
import {
  G5_OWNER_DATA_CLASS,
  createG5OwnerActivationReceipt,
} from "./domiG5OwnerActivation.mjs";
import {
  G5_THIRD_REAL_OWNER_ENTRY_ID,
  G5_R3_OWNER_LEDGER_STATE,
  G5_R3_OWNER_LONGITUDINAL_STATE,
  readG5R3FirstOwnerMemory,
  readG5R3SecondOwnerMemory,
  readG5ThirdOwnerMemory,
} from "./domiG5OwnerLongitudinalStateR3.mjs";

export const DOMI_G5_R4_SUBJECT_VERSION = "DOMI_G5_R4_SUBJECT_V0_1";
export const DOMI_G5_R4_ENTRY_IDS = Object.freeze([
  "G5-E-0001-REAL",
  "G5-E-0002-REAL",
  G5_THIRD_REAL_OWNER_ENTRY_ID,
]);
export const DOMI_G5_R4_ACTION_SPACE = Object.freeze(
  Array.from({ length: 64 }, (_, index) => `R4_ACTION_${index.toString(16).toUpperCase().padStart(2, "0")}`),
);
export const DOMI_G5_R4_SALTS = Object.freeze({
  trajectory: "DOMI_G5_R4_TRAJECTORY_V1",
  permutation: "DOMI_G5_R4_PERM_V1",
  offset: "DOMI_G5_R4_OFFSET_V1",
});

const ACTIVATION_FINGERPRINT = createG5OwnerActivationReceipt().activationFingerprint;
const CANONICAL_ENTRIES = Object.freeze([
  readG5R3FirstOwnerMemory(),
  readG5R3SecondOwnerMemory(),
  readG5ThirdOwnerMemory(),
]);
const EXPECTED_BY_ID = new Map(CANONICAL_ENTRIES.map((entry) => [entry.entryId, entry]));
const EXPECTED_LEDGER_FINGERPRINT = G5_R3_OWNER_LEDGER_STATE.ledgerFingerprint;
const EXPECTED_LEDGER_HEAD_RECORD_FINGERPRINT = G5_R3_OWNER_LEDGER_STATE.headRecordFingerprint;

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

function reproduceEntryFingerprint(memory) {
  if (
    !memory || typeof memory !== "object" || typeof memory.entryId !== "string" ||
    typeof memory.content !== "string" || typeof memory.observedAt !== "string" ||
    typeof memory.surfaceClass !== "string"
  ) return null;

  return sha256Canonical({
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
  });
}

function normalizeChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") throw new Error("G5_R4_CHALLENGE_REQUIRED");
  for (const forbidden of ["text", "prompt", "content", "memoryHint", "historySummary", "targetAction", "trajectoryDigest"]) {
    if (Object.hasOwn(challenge, forbidden)) throw new Error("G5_R4_CHALLENGE_HISTORY_CHANNEL_FORBIDDEN");
  }
  const { challengeId, selector, nonce } = challenge;
  if (typeof challengeId !== "string" || !/^G5-R4-C-[0-9a-f]{24}$/.test(challengeId)) throw new Error("G5_R4_CHALLENGE_ID_INVALID");
  if (!Number.isInteger(selector) || selector < 0 || selector > 63) throw new Error("G5_R4_SELECTOR_INVALID");
  if (typeof nonce !== "string" || !/^[0-9a-f]{48}$/.test(nonce)) throw new Error("G5_R4_NONCE_INVALID");
  return Object.freeze({ challengeId, selector, nonce });
}

function isCanonicalGovernedEntry(memory) {
  const expected = EXPECTED_BY_ID.get(memory?.entryId);
  if (!expected) return false;
  if (memory.entryFingerprint !== expected.entryFingerprint) return false;
  if (memory.observedAt !== expected.observedAt) return false;
  if (memory.surfaceClass !== expected.surfaceClass) return false;
  if (memory.prospective !== true) return false;
  if (memory.appendOnly !== true || memory.overwriteAllowed !== false) return false;
  if (memory.realOwnerMemoryEntryCount !== 3) return false;
  if (memory.scientificRootsMinted !== 0) return false;
  if (memory.ledgerFingerprint !== EXPECTED_LEDGER_FINGERPRINT) return false;
  if (memory.ledgerHeadRecordFingerprint !== EXPECTED_LEDGER_HEAD_RECORD_FINGERPRINT) return false;
  return reproduceEntryFingerprint(memory) === expected.entryFingerprint;
}

function validateHistory(value) {
  if (!Array.isArray(value) || value.length === 0) return Object.freeze({ ok: false, disposition: "HOLD_HISTORY_UNAVAILABLE", byId: new Map() });
  const byId = new Map();
  for (const memory of value) {
    if (!isCanonicalGovernedEntry(memory) || byId.has(memory.entryId)) return Object.freeze({ ok: false, disposition: "HOLD_UNGOVERNED_HISTORY", byId: new Map() });
    byId.set(memory.entryId, memory);
  }
  if (byId.size !== DOMI_G5_R4_ENTRY_IDS.length) return Object.freeze({ ok: false, disposition: "HOLD_HISTORY_INCOMPLETE", byId });
  for (const id of DOMI_G5_R4_ENTRY_IDS) if (!byId.has(id)) return Object.freeze({ ok: false, disposition: "HOLD_HISTORY_INCOMPLETE", byId });
  return Object.freeze({ ok: true, disposition: null, byId });
}

function chronologicalTrajectory(byId) {
  const ordered = DOMI_G5_R4_ENTRY_IDS.map((id) => byId.get(id)).sort((a, b) => {
    const delta = Date.parse(a.observedAt) - Date.parse(b.observedAt);
    return delta !== 0 ? delta : a.entryId.localeCompare(b.entryId);
  });
  if (ordered.map((entry) => entry.entryId).join("|") !== DOMI_G5_R4_ENTRY_IDS.join("|")) throw new Error("G5_R4_CANONICAL_TEMPORAL_ORDER_INVALID");
  return ordered;
}

function trajectoryDigestFromFingerprints(fingerprints) {
  let state = sha256Text(`${DOMI_G5_R4_SALTS.trajectory}|ROOT|${fingerprints.length}`);
  fingerprints.forEach((fingerprint, index) => {
    state = sha256Text(`${DOMI_G5_R4_SALTS.trajectory}|${index}|${state}|${fingerprint}`);
  });
  return state;
}

function actionFromTrajectory({ selector, nonce, trajectoryDigest }) {
  const permutation = [...DOMI_G5_R4_ACTION_SPACE].sort((a, b) => {
    const rankA = sha256Text(`${DOMI_G5_R4_SALTS.permutation}|${trajectoryDigest}|${a}`);
    const rankB = sha256Text(`${DOMI_G5_R4_SALTS.permutation}|${trajectoryDigest}|${b}`);
    return rankA === rankB ? a.localeCompare(b) : rankA.localeCompare(rankB);
  });
  const offset = Number.parseInt(sha256Text(`${DOMI_G5_R4_SALTS.offset}|${nonce}|${trajectoryDigest}`).slice(0, 8), 16) % DOMI_G5_R4_ACTION_SPACE.length;
  return permutation[(selector * 19 + offset) % DOMI_G5_R4_ACTION_SPACE.length];
}

function hold(disposition, memoryReadCount, memoryEntryCountSeen = 0) {
  return Object.freeze({ disposition, action: null, memoryReadCount, memoryEntryCountSeen, historyDepthUsed: 0, contentEchoed: false, production: false, scientificRootsMinted: 0 });
}

export function getG5R4SubjectFreezeDescriptor() {
  return Object.freeze({
    version: DOMI_G5_R4_SUBJECT_VERSION,
    entryIds: DOMI_G5_R4_ENTRY_IDS,
    entryFingerprints: Object.freeze(CANONICAL_ENTRIES.map((entry) => entry.entryFingerprint)),
    ledgerFingerprint: EXPECTED_LEDGER_FINGERPRINT,
    ledgerHeadRecordFingerprint: EXPECTED_LEDGER_HEAD_RECORD_FINGERPRINT,
    realOwnerMemoryEntryCount: G5_R3_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,
    actionSpace: DOMI_G5_R4_ACTION_SPACE,
    salts: DOMI_G5_R4_SALTS,
    providerReadPolicy: "EXACTLY_ONCE_PER_SUBJECT_CALL",
    canonicalOrder: "OBSERVED_AT_ASC_THEN_ENTRY_ID",
    trajectoryConstruction: "ITERATED_SHA256_ALL_THREE_ENTRY_FINGERPRINTS_FRESH_R4_SALTS",
    challengeHistoryChannel: "FORBIDDEN",
    priorOutcomeReuse: "FORBIDDEN",
    subjectOutcomesGenerated: false,
    production: false,
    scientificRootsMinted: 0,
  });
}

export function diagnoseG5R4TrajectoryLoadBearing() {
  const fingerprints = CANONICAL_ENTRIES.map((entry) => entry.entryFingerprint);
  const full = trajectoryDigestFromFingerprints(fingerprints);
  const ablations = [fingerprints.slice(1), [fingerprints[0], fingerprints[2]], fingerprints.slice(0, 2)].map(trajectoryDigestFromFingerprints);
  const reversed = trajectoryDigestFromFingerprints([...fingerprints].reverse());
  return Object.freeze({ diagnosticOnly: true, allThreeLoadBearingAtDigestLayer: new Set([full, ...ablations]).size === 4, chronologySensitiveAtDigestLayer: full !== reversed, subjectOutcomeGenerated: false });
}

export function solveG5HistoryDependenceR4({ challenge, memoryProvider } = {}) {
  const normalizedChallenge = normalizeChallenge(challenge);
  if (typeof memoryProvider !== "function") throw new Error("G5_R4_MEMORY_PROVIDER_REQUIRED");

  let memoryReadCount = 0;
  let supplied;
  try {
    memoryReadCount += 1;
    supplied = memoryProvider();
  } catch {
    return hold("HOLD_HISTORY_UNAVAILABLE", memoryReadCount, 0);
  }

  const memoryEntryCountSeen = Array.isArray(supplied) ? supplied.length : 0;
  const validation = validateHistory(supplied);
  if (!validation.ok) return hold(validation.disposition, memoryReadCount, memoryEntryCountSeen);

  const ordered = chronologicalTrajectory(validation.byId);
  const trajectoryDigest = trajectoryDigestFromFingerprints(ordered.map((entry) => entry.entryFingerprint));
  return Object.freeze({
    disposition: "PASS_ACTION",
    action: actionFromTrajectory({ ...normalizedChallenge, trajectoryDigest }),
    memoryReadCount,
    memoryEntryCountSeen,
    historyDepthUsed: 3,
    contentEchoed: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
