import crypto from "node:crypto";

export const DOMI_G5_FUR1_HELDOUT_GENERATOR_VERSION = "DOMI_G5_FUR1_HELDOUT_GENERATOR_V0_1";
export const DOMI_G5_FUR1_HELDOUT_SEED = "G5-FUR1-2026-09-09-PREEXEC-V1";
export const DOMI_G5_FUR1_HELDOUT_PANEL_SIZE = 96;
export const DOMI_G5_FUR1_CHALLENGE_NAMESPACE = "G5-FUR1-C-";
export const DOMI_G5_FUR1_PRESENTATION_VARIANT_COUNT = 4;

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function requireIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= DOMI_G5_FUR1_HELDOUT_PANEL_SIZE) {
    throw new Error("G5_FUR1_HELDOUT_INDEX_INVALID");
  }
  return index;
}

function challengeIdFor(index) {
  const i = requireIndex(index);
  return `${DOMI_G5_FUR1_CHALLENGE_NAMESPACE}${sha256Hex(`${DOMI_G5_FUR1_HELDOUT_SEED}|id|${i}`).slice(0, 24)}`;
}

function selectorFor(index) {
  const i = requireIndex(index);
  const selectorRaw = sha256Hex(`${DOMI_G5_FUR1_HELDOUT_SEED}|selector|${i}`).slice(0, 8);
  return Number.parseInt(selectorRaw, 16) % 16;
}

function nonceFor(index) {
  const i = requireIndex(index);
  return sha256Hex(`${DOMI_G5_FUR1_HELDOUT_SEED}|nonce|${i}`).slice(0, 32);
}

function presentationVariantFor(index) {
  return requireIndex(index) % DOMI_G5_FUR1_PRESENTATION_VARIANT_COUNT;
}

function canonicalChallengeFor(index) {
  return Object.freeze({
    challengeId: challengeIdFor(index),
    selector: selectorFor(index),
    nonce: nonceFor(index),
  });
}

function presentationEnvelopeFor(canonicalChallenge, presentationVariant) {
  const { challengeId, selector, nonce } = canonicalChallenge;
  switch (presentationVariant) {
    case 0:
      return Object.freeze({
        schema: "domi.g5.fur1.challenge-envelope.v1",
        presentationVariant,
        fields: Object.freeze([
          Object.freeze(["challengeId", challengeId]),
          Object.freeze(["selector", selector]),
          Object.freeze(["nonce", nonce]),
        ]),
        renderingMetadata: Object.freeze({ density: "COMPACT", order: "ID_SELECTOR_NONCE" }),
      });
    case 1:
      return Object.freeze({
        schema: "domi.g5.fur1.challenge-envelope.v1",
        presentationVariant,
        fields: Object.freeze([
          Object.freeze(["nonce", nonce]),
          Object.freeze(["challengeId", challengeId]),
          Object.freeze(["selector", selector]),
        ]),
        renderingMetadata: Object.freeze({ density: "SPACED", order: "NONCE_ID_SELECTOR" }),
      });
    case 2:
      return Object.freeze({
        schema: "domi.g5.fur1.challenge-envelope.v1",
        presentationVariant,
        fields: Object.freeze([
          Object.freeze(["selector", selector]),
          Object.freeze(["nonce", nonce]),
          Object.freeze(["challengeId", challengeId]),
        ]),
        renderingMetadata: Object.freeze({ density: "COMPACT", order: "SELECTOR_NONCE_ID" }),
      });
    case 3:
      return Object.freeze({
        schema: "domi.g5.fur1.challenge-envelope.v1",
        presentationVariant,
        fields: Object.freeze([
          Object.freeze(["challengeId", challengeId]),
          Object.freeze(["nonce", nonce]),
          Object.freeze(["selector", selector]),
        ]),
        renderingMetadata: Object.freeze({ density: "SPACED", order: "ID_NONCE_SELECTOR" }),
      });
    default:
      throw new Error("G5_FUR1_PRESENTATION_VARIANT_INVALID");
  }
}

function materializeItem(index) {
  const canonicalChallenge = canonicalChallengeFor(index);
  const presentationVariant = presentationVariantFor(index);
  return Object.freeze({
    index,
    canonicalChallenge,
    presentationVariant,
    presentationEnvelope: presentationEnvelopeFor(canonicalChallenge, presentationVariant),
    scientificRootsMinted: 0,
    production: false,
  });
}

export function generateG5Fur1HeldoutPanel() {
  return Object.freeze(
    Array.from({ length: DOMI_G5_FUR1_HELDOUT_PANEL_SIZE }, (_, index) => materializeItem(index)),
  );
}

export function assertG5Fur1HeldoutPanelIntegrity(panel) {
  if (!Array.isArray(panel)) {
    return Object.freeze({
      pass: false,
      reasons: Object.freeze(["G5_FUR1_PANEL_REQUIRED"]),
      panelSize: 0,
      uniqueChallengeIds: 0,
      scientificRootsMinted: 0,
      production: false,
    });
  }

  const reasons = [];
  if (panel.length !== DOMI_G5_FUR1_HELDOUT_PANEL_SIZE) {
    reasons.push("G5_FUR1_PANEL_SIZE_INVALID");
  }

  const ids = [];
  for (let index = 0; index < panel.length; index += 1) {
    const item = panel[index];
    const expected = index < DOMI_G5_FUR1_HELDOUT_PANEL_SIZE ? materializeItem(index) : null;
    if (!item || typeof item !== "object") {
      reasons.push(`G5_FUR1_ITEM_INVALID:${index}`);
      continue;
    }
    if (item.index !== index) reasons.push(`G5_FUR1_INDEX_MISMATCH:${index}`);
    if (!expected) {
      reasons.push(`G5_FUR1_EXTRA_ITEM:${index}`);
      continue;
    }

    const actualCanonical = item.canonicalChallenge;
    const expectedCanonical = expected.canonicalChallenge;
    if (!actualCanonical || typeof actualCanonical !== "object") {
      reasons.push(`G5_FUR1_CANONICAL_CHALLENGE_MISSING:${index}`);
      continue;
    }

    ids.push(actualCanonical.challengeId);
    if (actualCanonical.challengeId !== expectedCanonical.challengeId) {
      reasons.push(`G5_FUR1_CHALLENGE_ID_MISMATCH:${index}`);
    }
    if (actualCanonical.selector !== expectedCanonical.selector) {
      reasons.push(`G5_FUR1_SELECTOR_MISMATCH:${index}`);
    }
    if (actualCanonical.nonce !== expectedCanonical.nonce) {
      reasons.push(`G5_FUR1_NONCE_MISMATCH:${index}`);
    }
    if (item.presentationVariant !== expected.presentationVariant) {
      reasons.push(`G5_FUR1_PRESENTATION_VARIANT_MISMATCH:${index}`);
    }
    if (JSON.stringify(item.presentationEnvelope) !== JSON.stringify(expected.presentationEnvelope)) {
      reasons.push(`G5_FUR1_PRESENTATION_ENVELOPE_MISMATCH:${index}`);
    }
    if (!/^G5-FUR1-C-[0-9a-f]{24}$/.test(actualCanonical.challengeId)) {
      reasons.push(`G5_FUR1_CHALLENGE_ID_FORMAT_INVALID:${index}`);
    }
    if (!Number.isInteger(actualCanonical.selector) || actualCanonical.selector < 0 || actualCanonical.selector > 15) {
      reasons.push(`G5_FUR1_SELECTOR_RANGE_INVALID:${index}`);
    }
    if (!/^[0-9a-f]{32}$/.test(actualCanonical.nonce)) {
      reasons.push(`G5_FUR1_NONCE_FORMAT_INVALID:${index}`);
    }
    if (item.scientificRootsMinted !== 0) reasons.push(`G5_FUR1_SCIENTIFIC_ROOT_INVALID:${index}`);
    if (item.production !== false) reasons.push(`G5_FUR1_PRODUCTION_SCOPE_INVALID:${index}`);
  }

  const uniqueChallengeIds = new Set(ids).size;
  if (uniqueChallengeIds !== DOMI_G5_FUR1_HELDOUT_PANEL_SIZE) {
    reasons.push("G5_FUR1_CHALLENGE_IDS_NOT_UNIQUE");
  }

  return Object.freeze({
    pass: reasons.length === 0,
    reasons: Object.freeze(reasons),
    panelSize: panel.length,
    uniqueChallengeIds,
    seed: DOMI_G5_FUR1_HELDOUT_SEED,
    namespace: DOMI_G5_FUR1_CHALLENGE_NAMESPACE,
    scientificRootsMinted: 0,
    production: false,
  });
}

export function describeG5Fur1HeldoutGeneratorFreeze() {
  return Object.freeze({
    version: DOMI_G5_FUR1_HELDOUT_GENERATOR_VERSION,
    seed: DOMI_G5_FUR1_HELDOUT_SEED,
    panelSize: DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
    namespace: DOMI_G5_FUR1_CHALLENGE_NAMESPACE,
    presentationVariantCount: DOMI_G5_FUR1_PRESENTATION_VARIANT_COUNT,
    panelMaterializedByThisCall: false,
    scorerImported: false,
    memoryReadPerformed: false,
    outcomeProduced: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
