import crypto from "node:crypto";

export const DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION = "DOMI_G5_FUR1_SECONDARY_EVALUATOR_V0_1";
export const DOMI_G5_FUR1_SECONDARY_CANONICAL_ENTRY_ID = "G5-E-0001-REAL";
export const DOMI_G5_FUR1_SECONDARY_CANONICAL_ENTRY_FINGERPRINT = "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4";
export const DOMI_G5_FUR1_SECONDARY_ACTION_SPACE = Object.freeze(
  [..."0123456789ABCDEF"].map((symbol) => `ACTION_${symbol}`),
);
export const DOMI_G5_FUR1_SECONDARY_ARMS = Object.freeze([
  "A_MEMORY_AVAILABLE",
  "B_MEMORY_ABLATED",
  "C_UNGOVERNED_MATCHED_CONTROL",
  "D_RENDERING_PERTURBATION",
]);

const CHALLENGE_PREFIX = "G5-FUR1-C-";

function digestHex(algorithm, text) {
  return crypto.createHash(algorithm).update(Buffer.from(text, "utf8")).digest("hex");
}

function inspectChallenge(candidate) {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("G5_FUR1_SECONDARY_CHALLENGE_REQUIRED");
  }

  const challengeId = candidate.challengeId;
  const selector = candidate.selector;
  const nonce = candidate.nonce;

  if (
    typeof challengeId !== "string" ||
    challengeId.length !== CHALLENGE_PREFIX.length + 24 ||
    !challengeId.startsWith(CHALLENGE_PREFIX) ||
    !/^[0-9a-f]{24}$/.test(challengeId.slice(CHALLENGE_PREFIX.length))
  ) {
    throw new Error("G5_FUR1_SECONDARY_CHALLENGE_ID_INVALID");
  }

  if (!Number.isSafeInteger(selector) || selector > 15 || selector < 0) {
    throw new Error("G5_FUR1_SECONDARY_SELECTOR_INVALID");
  }

  if (typeof nonce !== "string" || nonce.length !== 32 || !/^[0-9a-f]+$/.test(nonce)) {
    throw new Error("G5_FUR1_SECONDARY_NONCE_INVALID");
  }

  return Object.freeze({ challengeId, selector, nonce });
}

function inspectCanonicalMemory(candidate) {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("G5_FUR1_SECONDARY_MEMORY_REQUIRED");
  }

  if (candidate.entryId !== DOMI_G5_FUR1_SECONDARY_CANONICAL_ENTRY_ID) {
    throw new Error("G5_FUR1_SECONDARY_MEMORY_ENTRY_ID_INVALID");
  }
  if (candidate.entryFingerprint !== DOMI_G5_FUR1_SECONDARY_CANONICAL_ENTRY_FINGERPRINT) {
    throw new Error("G5_FUR1_SECONDARY_MEMORY_FINGERPRINT_INVALID");
  }
  if (typeof candidate.content !== "string" || candidate.content === "") {
    throw new Error("G5_FUR1_SECONDARY_MEMORY_CONTENT_REQUIRED");
  }
  if (candidate.prospective !== true) {
    throw new Error("G5_FUR1_SECONDARY_MEMORY_NOT_PROSPECTIVE");
  }
  if (candidate.appendOnly !== true || candidate.overwriteAllowed !== false) {
    throw new Error("G5_FUR1_SECONDARY_MEMORY_GOVERNANCE_INVALID");
  }
  if (candidate.realOwnerMemoryEntryCount !== 1) {
    throw new Error("G5_FUR1_SECONDARY_MEMORY_COUNT_INVALID");
  }
  if (candidate.scientificRootsMinted !== 0) {
    throw new Error("G5_FUR1_SECONDARY_SCIENTIFIC_ROOT_INVALID");
  }

  return Object.freeze({
    content: candidate.content.normalize("NFC"),
    entryId: candidate.entryId,
    entryFingerprint: candidate.entryFingerprint,
  });
}

function buildIndependentPermutation(memoryContent) {
  const memoryDigest = digestHex("sha512", `DOMI_G5_FUR1_MEMORY_V1|${memoryContent}`);
  const ranks = new Map();
  for (const action of DOMI_G5_FUR1_SECONDARY_ACTION_SPACE) {
    ranks.set(action, digestHex("sha256", `DOMI_G5_FUR1_PERM_V1|${memoryDigest}|${action}`));
  }

  const remaining = [...DOMI_G5_FUR1_SECONDARY_ACTION_SPACE];
  const ordered = [];
  while (remaining.length > 0) {
    let bestIndex = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const incumbent = remaining[bestIndex];
      const candidateRank = ranks.get(candidate);
      const incumbentRank = ranks.get(incumbent);
      if (
        candidateRank < incumbentRank ||
        (candidateRank === incumbentRank && candidate < incumbent)
      ) {
        bestIndex = index;
      }
    }
    ordered.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }
  return Object.freeze(ordered);
}

function independentOffset(nonce) {
  const firstWord = digestHex("sha256", `DOMI_G5_FUR1_OFFSET_V1|${nonce}`).slice(0, 8);
  return Number(BigInt(`0x${firstWord}`) % 16n);
}

export function deriveG5Fur1SecondaryExpectedAction({ challenge, canonicalMemory } = {}) {
  const checkedChallenge = inspectChallenge(challenge);
  const checkedMemory = inspectCanonicalMemory(canonicalMemory);
  const orderedActions = buildIndependentPermutation(checkedMemory.content);
  const slot = (checkedChallenge.selector + independentOffset(checkedChallenge.nonce)) & 15;

  return Object.freeze({
    evaluator: "SECONDARY",
    evaluatorVersion: DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION,
    expectedDisposition: "ACTION_SELECTED_FROM_GOVERNED_MEMORY_R1",
    expectedAction: orderedActions[slot],
    expectedMemoryReadCount: 1,
    expectedContentEchoed: false,
    scientificRootsMinted: 0,
    production: false,
  });
}

export function deriveG5Fur1SecondaryArmExpectation({ arm, challenge, canonicalMemory } = {}) {
  if (!DOMI_G5_FUR1_SECONDARY_ARMS.includes(arm)) {
    throw new Error("G5_FUR1_SECONDARY_ARM_INVALID");
  }

  const checkedChallenge = inspectChallenge(challenge);

  if (arm === "B_MEMORY_ABLATED") {
    return Object.freeze({
      evaluator: "SECONDARY",
      evaluatorVersion: DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION,
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
    return Object.freeze({
      evaluator: "SECONDARY",
      evaluatorVersion: DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION,
      arm,
      expectedDisposition: "HOLD_UNGOVERNED_MEMORY",
      expectedAction: null,
      expectedMemoryReadCount: 1,
      expectedContentEchoed: false,
      scientificRootsMinted: 0,
      production: false,
    });
  }

  const expectation = deriveG5Fur1SecondaryExpectedAction({
    challenge: checkedChallenge,
    canonicalMemory,
  });
  return Object.freeze({ ...expectation, arm });
}

export function describeG5Fur1SecondaryEvaluatorFreeze() {
  return Object.freeze({
    version: DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION,
    evaluator: "SECONDARY",
    implementationStrategy: "ITERATIVE_MIN_SELECTION_PLUS_BIGINT_MOD16",
    canonicalEntryId: DOMI_G5_FUR1_SECONDARY_CANONICAL_ENTRY_ID,
    canonicalEntryFingerprint: DOMI_G5_FUR1_SECONDARY_CANONICAL_ENTRY_FINGERPRINT,
    actionCount: DOMI_G5_FUR1_SECONDARY_ACTION_SPACE.length,
    arms: DOMI_G5_FUR1_SECONDARY_ARMS,
    primaryEvaluatorImported: false,
    subjectImported: false,
    heldoutGeneratorImported: false,
    parentScorerImported: false,
    governedMemoryReaderImported: false,
    governedMemoryReadPerformedByDescriptor: false,
    subjectExecuted: false,
    outcomeProduced: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
