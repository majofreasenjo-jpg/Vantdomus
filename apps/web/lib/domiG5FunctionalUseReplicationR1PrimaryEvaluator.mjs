import crypto from "node:crypto";

export const DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION = "DOMI_G5_FUR1_PRIMARY_EVALUATOR_V0_1";
export const DOMI_G5_FUR1_PRIMARY_CANONICAL_ENTRY_ID = "G5-E-0001-REAL";
export const DOMI_G5_FUR1_PRIMARY_CANONICAL_ENTRY_FINGERPRINT = "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4";
export const DOMI_G5_FUR1_PRIMARY_ACTION_SPACE = Object.freeze([
  "ACTION_0", "ACTION_1", "ACTION_2", "ACTION_3",
  "ACTION_4", "ACTION_5", "ACTION_6", "ACTION_7",
  "ACTION_8", "ACTION_9", "ACTION_A", "ACTION_B",
  "ACTION_C", "ACTION_D", "ACTION_E", "ACTION_F",
]);
export const DOMI_G5_FUR1_PRIMARY_ARMS = Object.freeze([
  "A_MEMORY_AVAILABLE",
  "B_MEMORY_ABLATED",
  "C_UNGOVERNED_MATCHED_CONTROL",
  "D_RENDERING_PERTURBATION",
]);

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function sha512Hex(value) {
  return crypto.createHash("sha512").update(value, "utf8").digest("hex");
}

function requireCanonicalChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") {
    throw new Error("G5_FUR1_PRIMARY_CHALLENGE_REQUIRED");
  }
  const challengeId = challenge.challengeId;
  const selector = challenge.selector;
  const nonce = challenge.nonce;
  if (typeof challengeId !== "string" || !/^G5-FUR1-C-[0-9a-f]{24}$/.test(challengeId)) {
    throw new Error("G5_FUR1_PRIMARY_CHALLENGE_ID_INVALID");
  }
  if (!Number.isInteger(selector) || selector < 0 || selector > 15) {
    throw new Error("G5_FUR1_PRIMARY_SELECTOR_INVALID");
  }
  if (typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)) {
    throw new Error("G5_FUR1_PRIMARY_NONCE_INVALID");
  }
  return Object.freeze({ challengeId, selector, nonce });
}

function requireCanonicalMemoryFixture(memory) {
  if (!memory || typeof memory !== "object") {
    throw new Error("G5_FUR1_PRIMARY_MEMORY_REQUIRED");
  }
  if (memory.entryId !== DOMI_G5_FUR1_PRIMARY_CANONICAL_ENTRY_ID) {
    throw new Error("G5_FUR1_PRIMARY_MEMORY_ENTRY_ID_INVALID");
  }
  if (memory.entryFingerprint !== DOMI_G5_FUR1_PRIMARY_CANONICAL_ENTRY_FINGERPRINT) {
    throw new Error("G5_FUR1_PRIMARY_MEMORY_FINGERPRINT_INVALID");
  }
  if (typeof memory.content !== "string" || memory.content.length === 0) {
    throw new Error("G5_FUR1_PRIMARY_MEMORY_CONTENT_REQUIRED");
  }
  if (memory.prospective !== true) {
    throw new Error("G5_FUR1_PRIMARY_MEMORY_NOT_PROSPECTIVE");
  }
  if (memory.appendOnly !== true || memory.overwriteAllowed !== false) {
    throw new Error("G5_FUR1_PRIMARY_MEMORY_GOVERNANCE_INVALID");
  }
  if (memory.realOwnerMemoryEntryCount !== 1) {
    throw new Error("G5_FUR1_PRIMARY_MEMORY_COUNT_INVALID");
  }
  if (memory.scientificRootsMinted !== 0) {
    throw new Error("G5_FUR1_PRIMARY_SCIENTIFIC_ROOT_INVALID");
  }
  return Object.freeze({
    entryId: memory.entryId,
    entryFingerprint: memory.entryFingerprint,
    content: memory.content.normalize("NFC"),
  });
}

function deriveMemoryPermutation(memoryContent) {
  const memoryDigest = sha512Hex(`DOMI_G5_FUR1_MEMORY_V1|${memoryContent}`);
  const ranked = DOMI_G5_FUR1_PRIMARY_ACTION_SPACE.map((action) => Object.freeze({
    action,
    rank: sha256Hex(`DOMI_G5_FUR1_PERM_V1|${memoryDigest}|${action}`),
  }));
  ranked.sort((left, right) => {
    const rankOrder = left.rank.localeCompare(right.rank);
    return rankOrder !== 0 ? rankOrder : left.action.localeCompare(right.action);
  });
  return Object.freeze(ranked.map((item) => item.action));
}

function deriveChallengeOffset(nonce) {
  const digest = sha256Hex(`DOMI_G5_FUR1_OFFSET_V1|${nonce}`);
  return Number.parseInt(digest.slice(0, 8), 16) % 16;
}

export function deriveG5Fur1PrimaryExpectedAction({ challenge, canonicalMemory } = {}) {
  const normalizedChallenge = requireCanonicalChallenge(challenge);
  const normalizedMemory = requireCanonicalMemoryFixture(canonicalMemory);
  const permutation = deriveMemoryPermutation(normalizedMemory.content);
  const offset = deriveChallengeOffset(normalizedChallenge.nonce);
  const position = (normalizedChallenge.selector + offset) % 16;
  return Object.freeze({
    evaluator: "PRIMARY",
    evaluatorVersion: DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION,
    expectedDisposition: "ACTION_SELECTED_FROM_GOVERNED_MEMORY_R1",
    expectedAction: permutation[position],
    expectedMemoryReadCount: 1,
    expectedContentEchoed: false,
    scientificRootsMinted: 0,
    production: false,
  });
}

export function deriveG5Fur1PrimaryArmExpectation({ arm, challenge, canonicalMemory } = {}) {
  if (!DOMI_G5_FUR1_PRIMARY_ARMS.includes(arm)) {
    throw new Error("G5_FUR1_PRIMARY_ARM_INVALID");
  }

  if (arm === "B_MEMORY_ABLATED") {
    requireCanonicalChallenge(challenge);
    return Object.freeze({
      evaluator: "PRIMARY",
      evaluatorVersion: DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION,
      arm,
      expectedDisposition: "HOLD_MEMORY_UNAVAILABLE",
      expectedAction: null,
      expectedMemoryReadCount: 1,
      expectedContentEchoed: false,
      scientificRootsMinted: 0,
      production: false,
    });
  }

  if (arm === "C_UNGOVERNED_MATCHED_CONTROL") {
    requireCanonicalChallenge(challenge);
    return Object.freeze({
      evaluator: "PRIMARY",
      evaluatorVersion: DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION,
      arm,
      expectedDisposition: "HOLD_UNGOVERNED_MEMORY",
      expectedAction: null,
      expectedMemoryReadCount: 1,
      expectedContentEchoed: false,
      scientificRootsMinted: 0,
      production: false,
    });
  }

  const expectation = deriveG5Fur1PrimaryExpectedAction({ challenge, canonicalMemory });
  return Object.freeze({ ...expectation, arm });
}

export function describeG5Fur1PrimaryEvaluatorFreeze() {
  return Object.freeze({
    version: DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION,
    evaluator: "PRIMARY",
    canonicalEntryId: DOMI_G5_FUR1_PRIMARY_CANONICAL_ENTRY_ID,
    canonicalEntryFingerprint: DOMI_G5_FUR1_PRIMARY_CANONICAL_ENTRY_FINGERPRINT,
    actionCount: DOMI_G5_FUR1_PRIMARY_ACTION_SPACE.length,
    arms: DOMI_G5_FUR1_PRIMARY_ARMS,
    subjectImported: false,
    parentScorerImported: false,
    heldoutGeneratorImported: false,
    governedMemoryReadPerformedByDescriptor: false,
    subjectExecuted: false,
    outcomeProduced: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
