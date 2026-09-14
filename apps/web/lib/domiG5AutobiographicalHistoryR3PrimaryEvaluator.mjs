import crypto from "node:crypto";
import {
  G5_R3_OWNER_LEDGER_STATE,
  readG5R3FirstOwnerMemory,
  readG5R3SecondOwnerMemory,
  readG5ThirdOwnerMemory,
} from "./domiG5OwnerLongitudinalStateR3.mjs";

export const DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION = "DOMI_G5_R3_PRIMARY_EVALUATOR_V0_1";
export const DOMI_G5_R3_PRIMARY_PROTOCOL = "R3_TRAJECTORY_ORACLE_SPEC_V1";
export const DOMI_G5_R3_PRIMARY_ARM_MODES = Object.freeze([
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

const ACTIONS = Object.freeze(
  Array.from({ length: 64 }, (_, index) => `R3_ACTION_${index.toString(16).toUpperCase().padStart(2, "0")}`),
);
const ORACLE_TAGS = Object.freeze({
  trajectory: "DOMI_G5_R3_TRAJECTORY_V1",
  permutation: "DOMI_G5_R3_PERM_V1",
  offset: "DOMI_G5_R3_OFFSET_V1",
});
const GOVERNED = Object.freeze([
  readG5R3FirstOwnerMemory(),
  readG5R3SecondOwnerMemory(),
  readG5ThirdOwnerMemory(),
]);
const GOVERNED_IDS = Object.freeze(GOVERNED.map((entry) => entry.entryId));
const GOVERNED_BY_ID = new Map(GOVERNED.map((entry) => [entry.entryId, entry]));

function sha(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function requireChallenge(challenge) {
  if (!challenge || typeof challenge !== "object" || Array.isArray(challenge)) {
    throw new Error("G5_R3_PRIMARY_CHALLENGE_REQUIRED");
  }
  const { challengeId, selector, nonce } = challenge;
  if (typeof challengeId !== "string" || !/^G5-R3-C-[0-9a-f]{24}$/.test(challengeId)) {
    throw new Error("G5_R3_PRIMARY_CHALLENGE_ID_INVALID");
  }
  if (!Number.isInteger(selector) || selector < 0 || selector > 63) {
    throw new Error("G5_R3_PRIMARY_SELECTOR_INVALID");
  }
  if (typeof nonce !== "string" || !/^[0-9a-f]{48}$/.test(nonce)) {
    throw new Error("G5_R3_PRIMARY_NONCE_INVALID");
  }
  return Object.freeze({ challengeId, selector, nonce });
}

function requireArmMode(armMode) {
  if (!DOMI_G5_R3_PRIMARY_ARM_MODES.includes(armMode)) {
    throw new Error("G5_R3_PRIMARY_ARM_MODE_INVALID");
  }
  return armMode;
}

function canonicalTrajectoryFingerprints() {
  const ordered = [...GOVERNED].sort((left, right) => {
    const dt = Date.parse(left.observedAt) - Date.parse(right.observedAt);
    return dt === 0 ? left.entryId.localeCompare(right.entryId) : dt;
  });
  if (ordered.map((entry) => entry.entryId).join("|") !== GOVERNED_IDS.join("|")) {
    throw new Error("G5_R3_PRIMARY_CANONICAL_HISTORY_INVALID");
  }
  if (G5_R3_OWNER_LEDGER_STATE.entryCount !== 3 || G5_R3_OWNER_LEDGER_STATE.appendOnly !== true) {
    throw new Error("G5_R3_PRIMARY_LEDGER_NOT_FROZEN_THREE_ENTRY_APPEND_ONLY");
  }
  return ordered.map((entry) => entry.entryFingerprint);
}

function oracleTrajectoryDigest() {
  const fingerprints = canonicalTrajectoryFingerprints();
  let accumulator = sha(`${ORACLE_TAGS.trajectory}|ROOT|${fingerprints.length}`);
  for (let index = 0; index < fingerprints.length; index += 1) {
    accumulator = sha(`${ORACLE_TAGS.trajectory}|${index}|${accumulator}|${fingerprints[index]}`);
  }
  return accumulator;
}

function oracleAction(challenge) {
  const trajectoryDigest = oracleTrajectoryDigest();
  const ranked = ACTIONS.map((action) => ({
    action,
    rank: sha(`${ORACLE_TAGS.permutation}|${trajectoryDigest}|${action}`),
  })).sort((left, right) => left.rank === right.rank
    ? left.action.localeCompare(right.action)
    : left.rank.localeCompare(right.rank));

  const offsetHex = sha(`${ORACLE_TAGS.offset}|${challenge.nonce}|${trajectoryDigest}`).slice(0, 8);
  const offset = Number.parseInt(offsetHex, 16) % ACTIONS.length;
  const position = (challenge.selector * 17 + offset) % ACTIONS.length;
  return ranked[position].action;
}

function armContract(armMode) {
  switch (armMode) {
    case "A_FULL_TRAJECTORY":
    case "H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED":
      return Object.freeze({ disposition: "PASS_ACTION", actionMode: "ORACLE", entryCountSeen: 3, historyDepthUsed: 3 });
    case "B_EARLY_HISTORY_ABLATION":
    case "C_MIDDLE_HISTORY_ABLATION":
    case "D_LATEST_HISTORY_ABLATION":
    case "E_PREFIX_ONLY_HISTORY":
    case "K_PAIR_ONLY":
      return Object.freeze({ disposition: "HOLD_HISTORY_INCOMPLETE", actionMode: "NONE", entryCountSeen: 2, historyDepthUsed: 0 });
    case "F_FORGED_CHRONOLOGY":
    case "G_FORGED_PROVENANCE":
      return Object.freeze({ disposition: "HOLD_UNGOVERNED_HISTORY", actionMode: "NONE", entryCountSeen: 3, historyDepthUsed: 0 });
    case "J_DIRECT_ENTRY_ONLY":
      return Object.freeze({ disposition: "HOLD_HISTORY_INCOMPLETE", actionMode: "NONE", entryCountSeen: 1, historyDepthUsed: 0 });
    case "I_WRITE_ONLY_HISTORY":
    case "L_MATCHED_PRESENT_SUMMARY_ONLY":
      return Object.freeze({ disposition: "HOLD_HISTORY_UNAVAILABLE", actionMode: "NONE", entryCountSeen: 0, historyDepthUsed: 0 });
    default:
      throw new Error("G5_R3_PRIMARY_ARM_MODE_UNREACHABLE");
  }
}

export function deriveG5R3PrimaryExpectation({ challenge, armMode } = {}) {
  const checkedChallenge = requireChallenge(challenge);
  const checkedArm = requireArmMode(armMode);
  const contract = armContract(checkedArm);
  return Object.freeze({
    evaluator: "PRIMARY",
    evaluatorVersion: DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION,
    protocol: DOMI_G5_R3_PRIMARY_PROTOCOL,
    challengeId: checkedChallenge.challengeId,
    armMode: checkedArm,
    expectedDisposition: contract.disposition,
    expectedAction: contract.actionMode === "ORACLE" ? oracleAction(checkedChallenge) : null,
    expectedMemoryReadCount: 1,
    expectedMemoryEntryCountSeen: contract.entryCountSeen,
    expectedHistoryDepthUsed: contract.historyDepthUsed,
    expectedContentEchoed: false,
    expectedProduction: false,
    expectedScientificRootsMinted: 0,
  });
}

export function describeG5R3PrimaryEvaluatorFreeze() {
  return Object.freeze({
    version: DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION,
    protocol: DOMI_G5_R3_PRIMARY_PROTOCOL,
    evaluator: "PRIMARY",
    armModes: DOMI_G5_R3_PRIMARY_ARM_MODES,
    governedEntryIds: GOVERNED_IDS,
    governedEntryFingerprints: Object.freeze(GOVERNED_IDS.map((id) => GOVERNED_BY_ID.get(id).entryFingerprint)),
    ledgerFingerprint: G5_R3_OWNER_LEDGER_STATE.ledgerFingerprint,
    ledgerHeadRecordFingerprint: G5_R3_OWNER_LEDGER_STATE.headRecordFingerprint,
    oracleActionCount: ACTIONS.length,
    subjectImported: false,
    subjectExecuted: false,
    secondaryEvaluatorImported: false,
    heldoutOutcomeInspected: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
