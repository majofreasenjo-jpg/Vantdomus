import crypto from "node:crypto";
import {
  G5_R3_OWNER_LEDGER_STATE,
  readG5R3FirstOwnerMemory,
  readG5R3SecondOwnerMemory,
  readG5ThirdOwnerMemory,
} from "./domiG5OwnerLongitudinalStateR3.mjs";

export const DOMI_G5_R3_SECONDARY_EVALUATOR_VERSION = "DOMI_G5_R3_SECONDARY_EVALUATOR_V0_1";
export const DOMI_G5_R3_SECONDARY_PROTOCOL = "R3_TRAJECTORY_ORACLE_SPEC_V1";
export const DOMI_G5_R3_SECONDARY_ARM_MODES = Object.freeze([
  "A_FULL_TRAJECTORY",
  "B_EARLY_HISTORY_ABLATION",
  "C_MIDDLE_HISTORY_ABLATION",
  "D_LATEST_HISTORY_ABLATION",
  "E_PREFIX_ONLY_HISTORY",
  "F_FORGED_CHRONOLOGY",
  "G_FORGED_PROVENANCE",
  "H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED",
  "I_WRITE_ONLY_HISTORY",
  "J_DIRECT_ENTRY_ONLY",
  "K_PAIR_ONLY",
  "L_MATCHED_PRESENT_SUMMARY_ONLY",
]);

const ACTION_COUNT = 64;
const TAG_TRAJECTORY = "DOMI_G5_R3_TRAJECTORY_V1";
const TAG_PERMUTATION = "DOMI_G5_R3_PERM_V1";
const TAG_OFFSET = "DOMI_G5_R3_OFFSET_V1";
const ENTRIES = Object.freeze([
  readG5R3FirstOwnerMemory(),
  readG5R3SecondOwnerMemory(),
  readG5ThirdOwnerMemory(),
]);

function hash(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function validateChallenge(challenge) {
  if (!challenge || Array.isArray(challenge) || typeof challenge !== "object") {
    throw new Error("G5_R3_SECONDARY_CHALLENGE_REQUIRED");
  }
  if (typeof challenge.challengeId !== "string" || !/^G5-R3-C-[0-9a-f]{24}$/.test(challenge.challengeId)) {
    throw new Error("G5_R3_SECONDARY_CHALLENGE_ID_INVALID");
  }
  if (!Number.isInteger(challenge.selector) || challenge.selector < 0 || challenge.selector >= ACTION_COUNT) {
    throw new Error("G5_R3_SECONDARY_SELECTOR_INVALID");
  }
  if (typeof challenge.nonce !== "string" || !/^[0-9a-f]{48}$/.test(challenge.nonce)) {
    throw new Error("G5_R3_SECONDARY_NONCE_INVALID");
  }
  return { challengeId: challenge.challengeId, selector: challenge.selector, nonce: challenge.nonce };
}

function validateArm(armMode) {
  if (!DOMI_G5_R3_SECONDARY_ARM_MODES.includes(armMode)) {
    throw new Error("G5_R3_SECONDARY_ARM_MODE_INVALID");
  }
  return armMode;
}

function canonicalEntries() {
  if (G5_R3_OWNER_LEDGER_STATE.entryCount !== 3 || G5_R3_OWNER_LEDGER_STATE.appendOnly !== true) {
    throw new Error("G5_R3_SECONDARY_LEDGER_CONTRACT_INVALID");
  }
  const sorted = ENTRIES.map((entry) => ({ ...entry })).sort((a, b) => {
    const aTime = Date.parse(a.observedAt);
    const bTime = Date.parse(b.observedAt);
    if (aTime !== bTime) return aTime - bTime;
    return a.entryId.localeCompare(b.entryId);
  });
  const ids = sorted.map((entry) => entry.entryId);
  if (ids.join(",") !== "G5-E-0001-REAL,G5-E-0002-REAL,G5-E-0003-REAL") {
    throw new Error("G5_R3_SECONDARY_CHRONOLOGY_INVALID");
  }
  return sorted;
}

function deriveTrajectoryDigest() {
  const fingerprints = canonicalEntries().map((entry) => entry.entryFingerprint);
  const initial = hash([TAG_TRAJECTORY, "ROOT", fingerprints.length].join("|"));
  return fingerprints.reduce((state, fingerprint, index) =>
    hash([TAG_TRAJECTORY, index, state, fingerprint].join("|")), initial);
}

function deriveAction(challenge) {
  const digest = deriveTrajectoryDigest();
  const ranked = [];
  for (let index = 0; index < ACTION_COUNT; index += 1) {
    const action = `R3_ACTION_${index.toString(16).toUpperCase().padStart(2, "0")}`;
    ranked.push([hash([TAG_PERMUTATION, digest, action].join("|")), action]);
  }
  ranked.sort((a, b) => a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]));
  const offsetHash = hash([TAG_OFFSET, challenge.nonce, digest].join("|"));
  const offset = Number.parseInt(offsetHash.substring(0, 8), 16) % ACTION_COUNT;
  const index = (challenge.selector * 17 + offset) % ACTION_COUNT;
  return ranked[index][1];
}

function expectedContract(armMode) {
  const contracts = {
    A_FULL_TRAJECTORY: ["PASS_ACTION", 3, 3, true],
    B_EARLY_HISTORY_ABLATION: ["HOLD_HISTORY_INCOMPLETE", 2, 0, false],
    C_MIDDLE_HISTORY_ABLATION: ["HOLD_HISTORY_INCOMPLETE", 2, 0, false],
    D_LATEST_HISTORY_ABLATION: ["HOLD_HISTORY_INCOMPLETE", 2, 0, false],
    E_PREFIX_ONLY_HISTORY: ["HOLD_HISTORY_INCOMPLETE", 2, 0, false],
    F_FORGED_CHRONOLOGY: ["HOLD_UNGOVERNED_HISTORY", 3, 0, false],
    G_FORGED_PROVENANCE: ["HOLD_UNGOVERNED_HISTORY", 3, 0, false],
    H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED: ["PASS_ACTION", 3, 3, true],
    I_WRITE_ONLY_HISTORY: ["HOLD_HISTORY_UNAVAILABLE", 0, 0, false],
    J_DIRECT_ENTRY_ONLY: ["HOLD_HISTORY_INCOMPLETE", 1, 0, false],
    K_PAIR_ONLY: ["HOLD_HISTORY_INCOMPLETE", 2, 0, false],
    L_MATCHED_PRESENT_SUMMARY_ONLY: ["HOLD_HISTORY_UNAVAILABLE", 0, 0, false],
  };
  const [disposition, entryCount, historyDepth, expectsAction] = contracts[armMode];
  return { disposition, entryCount, historyDepth, expectsAction };
}

export function deriveG5R3SecondaryExpectation({ challenge, armMode } = {}) {
  const checkedChallenge = validateChallenge(challenge);
  const checkedArm = validateArm(armMode);
  const contract = expectedContract(checkedArm);
  return Object.freeze({
    evaluator: "SECONDARY",
    evaluatorVersion: DOMI_G5_R3_SECONDARY_EVALUATOR_VERSION,
    protocol: DOMI_G5_R3_SECONDARY_PROTOCOL,
    challengeId: checkedChallenge.challengeId,
    armMode: checkedArm,
    expectedDisposition: contract.disposition,
    expectedAction: contract.expectsAction ? deriveAction(checkedChallenge) : null,
    expectedMemoryReadCount: 1,
    expectedMemoryEntryCountSeen: contract.entryCount,
    expectedHistoryDepthUsed: contract.historyDepth,
    expectedContentEchoed: false,
    expectedProduction: false,
    expectedScientificRootsMinted: 0,
  });
}

export function describeG5R3SecondaryEvaluatorFreeze() {
  return Object.freeze({
    version: DOMI_G5_R3_SECONDARY_EVALUATOR_VERSION,
    protocol: DOMI_G5_R3_SECONDARY_PROTOCOL,
    evaluator: "SECONDARY",
    armModes: DOMI_G5_R3_SECONDARY_ARM_MODES,
    subjectImported: false,
    subjectExecuted: false,
    primaryEvaluatorImported: false,
    primaryExpectationsImported: false,
    heldoutOutcomeInspected: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
