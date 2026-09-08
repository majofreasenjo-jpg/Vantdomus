import crypto from "node:crypto";

export const G5_FUNCTIONAL_USE_HELDOUT_VERSION = "DOMI_G5_FUNCTIONAL_USE_HELDOUT_V0_1";
export const G5_FUNCTIONAL_USE_HELDOUT_SEED = "G5-FU-2026-09-08-PRE-EXEC-18uBkycAaYYUvuYUem";
export const G5_FUNCTIONAL_USE_HELDOUT_PANEL_SIZE = 64;

function challengeIdFor(index) {
  const hex = crypto
    .createHash("sha256")
    .update(`${G5_FUNCTIONAL_USE_HELDOUT_SEED}|${index}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  return `G5-FU-C-${hex}`;
}

export const G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES = Object.freeze(
  Array.from({ length: G5_FUNCTIONAL_USE_HELDOUT_PANEL_SIZE }, (_, index) => challengeIdFor(index)),
);

export function assertHeldoutPanelIntegrity() {
  const unique = new Set(G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES);
  return Object.freeze({
    pass:
      G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES.length === G5_FUNCTIONAL_USE_HELDOUT_PANEL_SIZE &&
      unique.size === G5_FUNCTIONAL_USE_HELDOUT_PANEL_SIZE &&
      G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES.every((id) => /^G5-FU-C-[0-9a-f]{24}$/.test(id)),
    panelSize: G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES.length,
    uniqueCount: unique.size,
    scientificRootsMinted: 0,
    production: false,
  });
}
