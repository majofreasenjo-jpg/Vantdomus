import crypto from "node:crypto";

export const DOMI_G5_FUR2_HELDOUT_GENERATOR_VERSION = "DOMI_G5_FUR2_HELDOUT_V0_1";
export const DOMI_G5_FUR2_FRESH_SEED = "5c50b1b64785fe0218e73ceaa4228b09af53d22b293f324f4dee0b73d305806f";
export const DOMI_G5_FUR2_NAMESPACE = "G5-FUR2-C-";
export const DOMI_G5_FUR2_PANEL_SIZE = 128;
export const DOMI_G5_FUR2_STRATIFICATION = Object.freeze({
  OLDER_ONLY: 32,
  NEWER_ONLY: 32,
  ORDERED_PAIR: 32,
  PROVENANCE_CONTROL: 16,
  ENUMERATION_ORDER_INVARIANCE: 16,
});
export const DOMI_G5_FUR2_PROVENANCE_ALLOCATION = Object.freeze({ OLDER: 6, NEWER: 5, PAIR: 5 });
export const DOMI_G5_FUR2_ENTRY_COUNT_REQUIRED = 2;

function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function deriveHex(label, targetClass, ordinal) {
  return sha256Text(`${DOMI_G5_FUR2_FRESH_SEED}|${DOMI_G5_FUR2_HELDOUT_GENERATOR_VERSION}|${label}|${targetClass}|${ordinal}`);
}

function provenanceTargetForOrdinal(ordinal) {
  if (ordinal < 6) return "OLDER";
  if (ordinal < 11) return "NEWER";
  return "PAIR";
}

function createChallenge(targetClass, ordinal) {
  const idDigest = deriveHex("ID", targetClass, ordinal);
  const selectorDigest = deriveHex("SELECTOR", targetClass, ordinal);
  const nonceA = deriveHex("NONCE_A", targetClass, ordinal);
  const nonceB = deriveHex("NONCE_B", targetClass, ordinal);
  const challenge = {
    challengeId: `${DOMI_G5_FUR2_NAMESPACE}${idDigest.slice(0, 24)}`,
    targetClass,
    selector: Number.parseInt(selectorDigest.slice(0, 8), 16) % 32,
    nonce: `${nonceA}${nonceB}`.slice(0, 40),
  };
  if (targetClass === "PROVENANCE_CONTROL") {
    challenge.provenanceTarget = provenanceTargetForOrdinal(ordinal);
  }
  return Object.freeze(challenge);
}

export function generateG5Fur2HeldoutPanel() {
  const panel = [];
  for (const [targetClass, count] of Object.entries(DOMI_G5_FUR2_STRATIFICATION)) {
    for (let ordinal = 0; ordinal < count; ordinal += 1) {
      panel.push(createChallenge(targetClass, ordinal));
    }
  }
  return Object.freeze(panel);
}

export function computeG5Fur2PanelCommitment(panel = generateG5Fur2HeldoutPanel()) {
  return sha256Text(JSON.stringify(panel));
}

export const DOMI_G5_FUR2_PANEL_COMMITMENT = computeG5Fur2PanelCommitment();

export function getG5Fur2HeldoutFreezeDescriptor() {
  return Object.freeze({
    version: DOMI_G5_FUR2_HELDOUT_GENERATOR_VERSION,
    seed: DOMI_G5_FUR2_FRESH_SEED,
    seedDigest: sha256Text(DOMI_G5_FUR2_FRESH_SEED),
    namespace: DOMI_G5_FUR2_NAMESPACE,
    panelSize: DOMI_G5_FUR2_PANEL_SIZE,
    stratification: DOMI_G5_FUR2_STRATIFICATION,
    provenanceAllocation: DOMI_G5_FUR2_PROVENANCE_ALLOCATION,
    panelCommitment: DOMI_G5_FUR2_PANEL_COMMITMENT,
    entryCountRequired: DOMI_G5_FUR2_ENTRY_COUNT_REQUIRED,
    r1PanelReuse: false,
    r1SeedReuse: false,
    r1ScorerReuse: false,
    r1ChallengeIdReuse: false,
    challengeContentChannel: "FORBIDDEN",
    subjectImported: false,
    subjectCalls: 0,
    heldoutOutcomesSeen: false,
    production: false,
    scientificRootsMinted: 0,
    thirdEntryAdmissionAllowed: false,
  });
}
