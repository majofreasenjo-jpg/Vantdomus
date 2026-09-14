import crypto from "node:crypto";

export const DOMI_G5_FUR2_PRIMARY_EVALUATOR_VERSION = "DOMI_G5_FUR2_PRIMARY_EVALUATOR_V0_1";
export const DOMI_G5_FUR2_PRIMARY_ENTRY_1_ID = "G5-E-0001-REAL";
export const DOMI_G5_FUR2_PRIMARY_ENTRY_2_ID = "G5-E-0002-REAL";
export const DOMI_G5_FUR2_PRIMARY_ENTRY_1_FINGERPRINT = "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4";
export const DOMI_G5_FUR2_PRIMARY_ENTRY_2_FINGERPRINT = "b4a42f88b79e3fa5ea266e783fe8682b42852d54fa0f379e1683ab42d6141b31";
export const DOMI_G5_FUR2_PRIMARY_ACTION_SPACE = Object.freeze(
  Array.from({ length: 32 }, (_, index) => `R2_ACTION_${index.toString(16).toUpperCase().padStart(2, "0")}`),
);
export const DOMI_G5_FUR2_PRIMARY_TARGET_CLASSES = Object.freeze([
  "OLDER_ONLY",
  "NEWER_ONLY",
  "ORDERED_PAIR",
  "PROVENANCE_CONTROL",
  "ENUMERATION_ORDER_INVARIANCE",
]);
export const DOMI_G5_FUR2_PRIMARY_CONTROLS = Object.freeze([
  "PRINCIPAL",
  "ABLATE_REQUIRED",
  "ENUM_REVERSED",
]);

const SALTS = Object.freeze({
  singleBasis: "DOMI_G5_FUR2_SINGLE_BASIS_V1",
  pairBasis: "DOMI_G5_FUR2_ORDERED_PAIR_BASIS_V1",
  permutation: "DOMI_G5_FUR2_PERM_V1",
  offset: "DOMI_G5_FUR2_OFFSET_V1",
  classBias: "DOMI_G5_FUR2_CLASS_BIAS_V1",
});

const FINGERPRINT_BY_ID = Object.freeze({
  [DOMI_G5_FUR2_PRIMARY_ENTRY_1_ID]: DOMI_G5_FUR2_PRIMARY_ENTRY_1_FINGERPRINT,
  [DOMI_G5_FUR2_PRIMARY_ENTRY_2_ID]: DOMI_G5_FUR2_PRIMARY_ENTRY_2_FINGERPRINT,
});

function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function sha512Text(value) {
  return crypto.createHash("sha512").update(value, "utf8").digest("hex");
}

function requireChallenge(challenge) {
  if (!challenge || typeof challenge !== "object" || Array.isArray(challenge)) {
    throw new Error("G5_FUR2_PRIMARY_CHALLENGE_REQUIRED");
  }
  const { challengeId, targetClass, selector, nonce, provenanceTarget = null } = challenge;
  if (typeof challengeId !== "string" || !/^G5-FUR2-C-[0-9a-f]{24}$/.test(challengeId)) {
    throw new Error("G5_FUR2_PRIMARY_CHALLENGE_ID_INVALID");
  }
  if (!DOMI_G5_FUR2_PRIMARY_TARGET_CLASSES.includes(targetClass)) {
    throw new Error("G5_FUR2_PRIMARY_TARGET_CLASS_INVALID");
  }
  if (!Number.isInteger(selector) || selector < 0 || selector > 31) {
    throw new Error("G5_FUR2_PRIMARY_SELECTOR_INVALID");
  }
  if (typeof nonce !== "string" || !/^[0-9a-f]{40}$/.test(nonce)) {
    throw new Error("G5_FUR2_PRIMARY_NONCE_INVALID");
  }
  if (targetClass === "PROVENANCE_CONTROL") {
    if (!['OLDER', 'NEWER', 'PAIR'].includes(provenanceTarget)) {
      throw new Error("G5_FUR2_PRIMARY_PROVENANCE_TARGET_INVALID");
    }
  } else if (provenanceTarget !== null) {
    throw new Error("G5_FUR2_PRIMARY_PROVENANCE_TARGET_UNEXPECTED");
  }
  return Object.freeze({ challengeId, targetClass, selector, nonce, provenanceTarget });
}

function requiredIds(challenge) {
  if (challenge.targetClass === "OLDER_ONLY") return [DOMI_G5_FUR2_PRIMARY_ENTRY_1_ID];
  if (challenge.targetClass === "NEWER_ONLY") return [DOMI_G5_FUR2_PRIMARY_ENTRY_2_ID];
  if (challenge.targetClass === "PROVENANCE_CONTROL") {
    if (challenge.provenanceTarget === "OLDER") return [DOMI_G5_FUR2_PRIMARY_ENTRY_1_ID];
    if (challenge.provenanceTarget === "NEWER") return [DOMI_G5_FUR2_PRIMARY_ENTRY_2_ID];
  }
  return [DOMI_G5_FUR2_PRIMARY_ENTRY_1_ID, DOMI_G5_FUR2_PRIMARY_ENTRY_2_ID];
}

function basisFromFingerprints(targetClass, fingerprints) {
  if (fingerprints.length === 1) {
    return sha512Text(`${SALTS.singleBasis}|${targetClass}|${fingerprints[0]}`);
  }
  return sha512Text(`${SALTS.pairBasis}|${targetClass}|${fingerprints[0]}|${fingerprints[1]}`);
}

function deriveAction(challenge) {
  const ids = requiredIds(challenge);
  const fingerprints = ids.map((id) => FINGERPRINT_BY_ID[id]);
  const basisClass = challenge.targetClass === "PROVENANCE_CONTROL"
    ? `PROVENANCE_${challenge.provenanceTarget}`
    : challenge.targetClass;
  const basis = basisFromFingerprints(basisClass, fingerprints);
  const permutation = [...DOMI_G5_FUR2_PRIMARY_ACTION_SPACE].sort((left, right) => {
    const rankLeft = sha256Text(`${SALTS.permutation}|${basis}|${left}`);
    const rankRight = sha256Text(`${SALTS.permutation}|${basis}|${right}`);
    return rankLeft === rankRight ? left.localeCompare(right) : rankLeft.localeCompare(rankRight);
  });
  const offset = Number.parseInt(
    sha256Text(`${SALTS.offset}|${basisClass}|${challenge.nonce}`).slice(0, 8),
    16,
  ) % 32;
  const classBias = Number.parseInt(
    sha256Text(`${SALTS.classBias}|${basisClass}`).slice(0, 8),
    16,
  ) % 32;
  const position = ((challenge.selector * 13) + offset + classBias) % 32;
  return permutation[position];
}

function expectation({ challenge, control, disposition, action, memoryEntryCountSeen, ablationTarget = null }) {
  return Object.freeze({
    evaluator: "PRIMARY",
    evaluatorVersion: DOMI_G5_FUR2_PRIMARY_EVALUATOR_VERSION,
    challengeId: challenge.challengeId,
    targetClass: challenge.targetClass,
    control,
    ablationTarget,
    expectedDisposition: disposition,
    expectedAction: action,
    expectedMemoryReadCount: 1,
    expectedMemoryEntryCountSeen: memoryEntryCountSeen,
    expectedContentEchoed: false,
    scientificRootsMinted: 0,
    production: false,
  });
}

export function deriveG5Fur2PrimaryExpectation({ challenge, control = "PRINCIPAL", ablationTarget = null } = {}) {
  const checked = requireChallenge(challenge);
  if (!DOMI_G5_FUR2_PRIMARY_CONTROLS.includes(control)) {
    throw new Error("G5_FUR2_PRIMARY_CONTROL_INVALID");
  }

  if (control === "ENUM_REVERSED") {
    if (checked.targetClass !== "ENUMERATION_ORDER_INVARIANCE") {
      throw new Error("G5_FUR2_PRIMARY_ENUM_REVERSED_CLASS_INVALID");
    }
    return expectation({
      challenge: checked,
      control,
      disposition: "ACTION_SELECTED_ENUMERATION_ORDER_INVARIANCE_R2",
      action: deriveAction(checked),
      memoryEntryCountSeen: 2,
    });
  }

  if (control === "ABLATE_REQUIRED") {
    if (!["OLDER_ONLY", "NEWER_ONLY", "ORDERED_PAIR"].includes(checked.targetClass)) {
      throw new Error("G5_FUR2_PRIMARY_ABLATION_CLASS_INVALID");
    }
    if (checked.targetClass === "ORDERED_PAIR") {
      if (!['OLDER', 'NEWER'].includes(ablationTarget)) {
        throw new Error("G5_FUR2_PRIMARY_PAIR_ABLATION_TARGET_REQUIRED");
      }
      return expectation({
        challenge: checked,
        control,
        disposition: "HOLD_MEMORY_INCOMPLETE",
        action: null,
        memoryEntryCountSeen: 1,
        ablationTarget,
      });
    }
    return expectation({
      challenge: checked,
      control,
      disposition: "HOLD_MEMORY_UNAVAILABLE",
      action: null,
      memoryEntryCountSeen: 0,
    });
  }

  if (checked.targetClass === "PROVENANCE_CONTROL") {
    return expectation({
      challenge: checked,
      control,
      disposition: "HOLD_UNGOVERNED_MEMORY",
      action: null,
      memoryEntryCountSeen: checked.provenanceTarget === "PAIR" ? 2 : 1,
    });
  }

  const memoryEntryCountSeen = ["OLDER_ONLY", "NEWER_ONLY"].includes(checked.targetClass) ? 1 : 2;
  return expectation({
    challenge: checked,
    control,
    disposition: `ACTION_SELECTED_${checked.targetClass}_R2`,
    action: deriveAction(checked),
    memoryEntryCountSeen,
  });
}

export function describeG5Fur2PrimaryEvaluatorFreeze() {
  return Object.freeze({
    version: DOMI_G5_FUR2_PRIMARY_EVALUATOR_VERSION,
    evaluator: "PRIMARY",
    actionCount: DOMI_G5_FUR2_PRIMARY_ACTION_SPACE.length,
    targetClasses: DOMI_G5_FUR2_PRIMARY_TARGET_CLASSES,
    controls: DOMI_G5_FUR2_PRIMARY_CONTROLS,
    principalProvenanceBehavior: "FORGED_SAME_CONTENT_IDENTITY_OR_FINGERPRINT_MUST_HOLD_UNGOVERNED",
    pairAblationBehavior: "ONE_REQUIRED_MEMBER_ABLATED_PER_HELDOUT_ROW_TARGET_FROZEN_BY_HARNESS_PLAN",
    subjectImported: false,
    secondaryEvaluatorImported: false,
    heldoutGeneratorImported: false,
    governedMemoryReaderImported: false,
    subjectExecuted: false,
    heldoutOutcomeInspected: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
