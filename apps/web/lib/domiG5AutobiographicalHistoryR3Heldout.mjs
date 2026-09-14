import crypto from "node:crypto";

export const DOMI_G5_R3_HELDOUT_VERSION = "DOMI_G5_R3_HELDOUT_V0_1";
export const DOMI_G5_R3_FROZEN_SEED = "d4a30c055eb17d348eab51b968885536c8917f2422f2dbd2b290b70a901e4d46";
export const DOMI_G5_R3_GROUP_COUNT = 16;
export const DOMI_G5_R3_ARMS = Object.freeze([
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

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function commitment(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function deriveHex(label, index, length) {
  let out = "";
  let counter = 0;
  while (out.length < length) {
    out += sha256(`${DOMI_G5_R3_FROZEN_SEED}|${label}|${index}|${counter}`);
    counter += 1;
  }
  return out.slice(0, length);
}

function makeChallenge(groupIndex) {
  const challengeId = `G5-R3-C-${deriveHex("challenge-id", groupIndex, 24)}`;
  const selector = Number.parseInt(deriveHex("selector", groupIndex, 8), 16) % 64;
  const nonce = deriveHex("nonce", groupIndex, 48);
  return Object.freeze({ challengeId, selector, nonce });
}

function makeGroup(groupIndex) {
  const challenge = makeChallenge(groupIndex);
  const groupId = `G5-R3-G-${groupIndex.toString(16).toUpperCase().padStart(2, "0")}`;
  const arms = DOMI_G5_R3_ARMS.map((armMode, armIndex) => Object.freeze({
    armId: `${groupId}-A${armIndex.toString(16).toUpperCase().padStart(2, "0")}`,
    armMode,
    challenge,
  }));
  return Object.freeze({ groupId, challenge, arms: Object.freeze(arms) });
}

export const DOMI_G5_R3_HELDOUT_PANEL = Object.freeze(
  Array.from({ length: DOMI_G5_R3_GROUP_COUNT }, (_, index) => makeGroup(index)),
);

export const DOMI_G5_R3_PANEL_COMMITMENT = commitment({
  version: DOMI_G5_R3_HELDOUT_VERSION,
  seed: DOMI_G5_R3_FROZEN_SEED,
  groups: DOMI_G5_R3_HELDOUT_PANEL,
});

export function getG5R3HeldoutFreezeDescriptor() {
  return Object.freeze({
    version: DOMI_G5_R3_HELDOUT_VERSION,
    seed: DOMI_G5_R3_FROZEN_SEED,
    groupCount: DOMI_G5_R3_GROUP_COUNT,
    armsPerGroup: DOMI_G5_R3_ARMS.length,
    plannedSubjectCalls: DOMI_G5_R3_GROUP_COUNT * DOMI_G5_R3_ARMS.length,
    armModes: DOMI_G5_R3_ARMS,
    panelCommitment: DOMI_G5_R3_PANEL_COMMITMENT,
    panelMaterialized: true,
    seedFrozen: true,
    subjectCalls: 0,
    subjectOutcomesGenerated: false,
    evaluatorExpectationsGenerated: false,
    scorerFrozen: false,
    oneShotHarnessFrozen: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
