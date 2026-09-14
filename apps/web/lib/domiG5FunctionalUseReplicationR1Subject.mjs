import crypto from "node:crypto";
import {
  G5_OWNER_DATA_CLASS,
  createG5OwnerActivationReceipt,
} from "./domiG5OwnerActivation.mjs";

export const DOMI_G5_FUR1_SUBJECT_VERSION = "DOMI_G5_FUR1_SUBJECT_V0_2";
export const DOMI_G5_FUR1_CANONICAL_ENTRY_ID = "G5-E-0001-REAL";
export const DOMI_G5_FUR1_CANONICAL_ENTRY_FINGERPRINT = "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4";
export const DOMI_G5_FUR1_ACTION_SPACE = Object.freeze([
  "ACTION_0", "ACTION_1", "ACTION_2", "ACTION_3",
  "ACTION_4", "ACTION_5", "ACTION_6", "ACTION_7",
  "ACTION_8", "ACTION_9", "ACTION_A", "ACTION_B",
  "ACTION_C", "ACTION_D", "ACTION_E", "ACTION_F",
]);

const DOMI_G5_FUR1_ACTIVATION_FINGERPRINT = createG5OwnerActivationReceipt().activationFingerprint;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256Canonical(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function normalizeContent(content) {
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("G5_FUR1_MEMORY_CONTENT_REQUIRED");
  }
  return content.normalize("NFC");
}

function normalizeChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") {
    throw new Error("G5_FUR1_CHALLENGE_REQUIRED");
  }
  const { challengeId, selector, nonce } = challenge;
  if (typeof challengeId !== "string" || !/^G5-FUR1-C-[0-9a-f]{24}$/.test(challengeId)) {
    throw new Error("G5_FUR1_CHALLENGE_ID_INVALID");
  }
  if (!Number.isInteger(selector) || selector < 0 || selector > 15) {
    throw new Error("G5_FUR1_SELECTOR_INVALID");
  }
  if (typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)) {
    throw new Error("G5_FUR1_NONCE_INVALID");
  }
  return Object.freeze({ challengeId, selector, nonce });
}

function reproduceEntryFingerprint(memory) {
  if (
    !memory ||
    typeof memory !== "object" ||
    typeof memory.content !== "string" ||
    typeof memory.observedAt !== "string" ||
    typeof memory.surfaceClass !== "string"
  ) {
    return null;
  }

  const entryCore = {
    schema: "domi.g5.owner-prospective-entry.v1",
    entryId: memory.entryId,
    activationFingerprint: DOMI_G5_FUR1_ACTIVATION_FINGERPRINT,
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
  if (memory.entryId !== DOMI_G5_FUR1_CANONICAL_ENTRY_ID) return false;
  if (memory.entryFingerprint !== DOMI_G5_FUR1_CANONICAL_ENTRY_FINGERPRINT) return false;
  if (memory.prospective !== true) return false;
  if (memory.appendOnly !== true || memory.overwriteAllowed !== false) return false;
  if (memory.realOwnerMemoryEntryCount !== 1) return false;
  if (memory.scientificRootsMinted !== 0) return false;
  return reproduceEntryFingerprint(memory) === DOMI_G5_FUR1_CANONICAL_ENTRY_FINGERPRINT;
}

function memoryDerivedPermutation(content) {
  const normalized = normalizeContent(content);
  const memoryDigest = crypto
    .createHash("sha512")
    .update(`DOMI_G5_FUR1_MEMORY_V1|${normalized}`, "utf8")
    .digest("hex");

  return Object.freeze(
    [...DOMI_G5_FUR1_ACTION_SPACE].sort((a, b) => {
      const rankA = crypto
        .createHash("sha256")
        .update(`DOMI_G5_FUR1_PERM_V1|${memoryDigest}|${a}`, "utf8")
        .digest("hex");
      const rankB = crypto
        .createHash("sha256")
        .update(`DOMI_G5_FUR1_PERM_V1|${memoryDigest}|${b}`, "utf8")
        .digest("hex");
      if (rankA === rankB) return a.localeCompare(b);
      return rankA.localeCompare(rankB);
    })
  );
}

function challengeOffset(nonce) {
  const digest = crypto
    .createHash("sha256")
    .update(`DOMI_G5_FUR1_OFFSET_V1|${nonce}`, "utf8")
    .digest("hex");
  return Number.parseInt(digest.slice(0, 8), 16) % 16;
}

export function solveG5FunctionalUseReplicationR1({ challenge, memoryProvider } = {}) {
  const normalizedChallenge = normalizeChallenge(challenge);
  if (typeof memoryProvider !== "function") {
    throw new Error("G5_FUR1_MEMORY_PROVIDER_REQUIRED");
  }

  let memoryReadCount = 0;
  let memory;
  try {
    memoryReadCount += 1;
    memory = memoryProvider();
  } catch {
    return Object.freeze({
      disposition: "HOLD_MEMORY_UNAVAILABLE",
      action: null,
      memoryReadCount,
      contentEchoed: false,
      scientificRootsMinted: 0,
      production: false,
    });
  }

  if (!isCanonicalGovernedMemory(memory)) {
    return Object.freeze({
      disposition: "HOLD_UNGOVERNED_MEMORY",
      action: null,
      memoryReadCount,
      contentEchoed: false,
      scientificRootsMinted: 0,
      production: false,
    });
  }

  const permutation = memoryDerivedPermutation(memory.content);
  const offset = challengeOffset(normalizedChallenge.nonce);
  const position = (normalizedChallenge.selector + offset) % 16;
  const action = permutation[position];

  return Object.freeze({
    disposition: "ACTION_SELECTED_FROM_GOVERNED_MEMORY_R1",
    action,
    memoryReadCount,
    contentEchoed: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
