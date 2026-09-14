import crypto from "node:crypto";
import {
  DOMI_G5_R3_HELDOUT_PANEL,
  DOMI_G5_R3_PANEL_COMMITMENT,
} from "./domiG5AutobiographicalHistoryR3Heldout.mjs";
import {
  readG5R3FirstOwnerMemory,
  readG5R3SecondOwnerMemory,
  readG5ThirdOwnerMemory,
} from "./domiG5OwnerLongitudinalStateR3.mjs";
import {
  solveG5AutobiographicalHistoryR3,
} from "./domiG5AutobiographicalHistoryR3Subject.mjs";
import {
  DOMI_G5_R3_SCORER_COMMITMENT,
  scoreG5R3Outcomes,
} from "./domiG5AutobiographicalHistoryR3Scorer.mjs";

export const DOMI_G5_R3_ONE_SHOT_HARNESS_VERSION = "DOMI_G5_R3_ONE_SHOT_HARNESS_V0_1";
export const DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER = "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_R3";

const E1 = readG5R3FirstOwnerMemory();
const E2 = readG5R3SecondOwnerMemory();
const E3 = readG5ThirdOwnerMemory();

const ARM_PLAN = Object.freeze({
  A_FULL_TRAJECTORY: Object.freeze({ providerMode: "CANONICAL_FULL", entryIds: [E1.entryId, E2.entryId, E3.entryId], mutation: null }),
  B_EARLY_HISTORY_ABLATION: Object.freeze({ providerMode: "ABLATE_EARLY", entryIds: [E2.entryId, E3.entryId], mutation: null }),
  C_MIDDLE_HISTORY_ABLATION: Object.freeze({ providerMode: "ABLATE_MIDDLE", entryIds: [E1.entryId, E3.entryId], mutation: null }),
  D_LATEST_HISTORY_ABLATION: Object.freeze({ providerMode: "ABLATE_LATEST", entryIds: [E1.entryId, E2.entryId], mutation: null }),
  E_PREFIX_ONLY_HISTORY: Object.freeze({ providerMode: "PREFIX_ONLY", entryIds: [E1.entryId, E2.entryId], mutation: null }),
  F_FORGED_CHRONOLOGY: Object.freeze({ providerMode: "FORGED_CHRONOLOGY", entryIds: [E1.entryId, E2.entryId, E3.entryId], mutation: "E2_OBSERVED_AT_FORGED" }),
  G_FORGED_PROVENANCE: Object.freeze({ providerMode: "FORGED_PROVENANCE", entryIds: [E1.entryId, E2.entryId, E3.entryId], mutation: "E2_FINGERPRINT_FORGED" }),
  H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED: Object.freeze({ providerMode: "REVERSED_ENUMERATION", entryIds: [E3.entryId, E2.entryId, E1.entryId], mutation: null }),
  I_WRITE_ONLY_HISTORY: Object.freeze({ providerMode: "NO_READ_HISTORY", entryIds: [], mutation: null }),
  J_DIRECT_ENTRY_ONLY: Object.freeze({ providerMode: "LATEST_DIRECT_ONLY", entryIds: [E3.entryId], mutation: null }),
  K_PAIR_ONLY: Object.freeze({ providerMode: "NON_PREFIX_PAIR_ONLY", entryIds: [E1.entryId, E3.entryId], mutation: null }),
  L_MATCHED_PRESENT_SUMMARY_ONLY: Object.freeze({ providerMode: "SUMMARY_NOT_MEMORY_PROVIDER", entryIds: [], mutation: null }),
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function commitment(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export const DOMI_G5_R3_ONE_SHOT_PLAN = Object.freeze(
  DOMI_G5_R3_HELDOUT_PANEL.flatMap((group) => group.arms.map((arm) => Object.freeze({
    groupId: group.groupId,
    armId: arm.armId,
    armMode: arm.armMode,
    challenge: group.challenge,
    providerPlan: ARM_PLAN[arm.armMode],
  }))),
);

export const DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT = commitment({
  version: DOMI_G5_R3_ONE_SHOT_HARNESS_VERSION,
  panelCommitment: DOMI_G5_R3_PANEL_COMMITMENT,
  scorerCommitment: DOMI_G5_R3_SCORER_COMMITMENT,
  plan: DOMI_G5_R3_ONE_SHOT_PLAN,
});

let executionConsumed = false;
let executionAttempted = false;

function providerForMode(armMode) {
  switch (armMode) {
    case "A_FULL_TRAJECTORY": return () => [E1, E2, E3];
    case "B_EARLY_HISTORY_ABLATION": return () => [E2, E3];
    case "C_MIDDLE_HISTORY_ABLATION": return () => [E1, E3];
    case "D_LATEST_HISTORY_ABLATION": return () => [E1, E2];
    case "E_PREFIX_ONLY_HISTORY": return () => [E1, E2];
    case "F_FORGED_CHRONOLOGY": return () => [E1, { ...E2, observedAt: "2099-01-01T00:00:00Z" }, E3];
    case "G_FORGED_PROVENANCE": return () => [E1, { ...E2, entryFingerprint: "0".repeat(64) }, E3];
    case "H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED": return () => [E3, E2, E1];
    case "I_WRITE_ONLY_HISTORY": return () => [];
    case "J_DIRECT_ENTRY_ONLY": return () => [E3];
    case "K_PAIR_ONLY": return () => [E1, E3];
    case "L_MATCHED_PRESENT_SUMMARY_ONLY": return () => [];
    default: throw new Error("G5_R3_UNKNOWN_ARM_MODE");
  }
}

function requireAuthorization(authorization) {
  return Boolean(
    authorization &&
    authorization.ownerExplicit === true &&
    authorization.marker === DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER &&
    authorization.gate === "G10" &&
    authorization.r3 === true,
  );
}

export function executeG5R3OneShot({ authorization } = {}) {
  if (!requireAuthorization(authorization)) {
    return Object.freeze({
      executed: false,
      blockedAt: "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED",
      subjectCalls: 0,
      outcomesGenerated: false,
      executionConsumed,
      production: false,
      scientificRootsMinted: 0,
    });
  }
  if (executionAttempted || executionConsumed) {
    throw new Error("G5_R3_ONE_SHOT_ALREADY_ATTEMPTED_OR_CONSUMED");
  }

  executionAttempted = true;
  const outcomes = [];
  try {
    for (const spec of DOMI_G5_R3_ONE_SHOT_PLAN) {
      const output = solveG5AutobiographicalHistoryR3({
        challenge: spec.challenge,
        memoryProvider: providerForMode(spec.armMode),
      });
      outcomes.push(Object.freeze({
        groupId: spec.groupId,
        armId: spec.armId,
        challengeId: spec.challenge.challengeId,
        armMode: spec.armMode,
        disposition: output.disposition,
        action: output.action,
        memoryReadCount: output.memoryReadCount,
        memoryEntryCountSeen: output.memoryEntryCountSeen,
        historyDepthUsed: output.historyDepthUsed,
        contentEchoed: output.contentEchoed,
        production: output.production,
        scientificRootsMinted: output.scientificRootsMinted,
      }));
    }
    executionConsumed = true;
    const frozenOutcomes = Object.freeze(outcomes);
    return Object.freeze({
      executed: true,
      subjectCalls: frozenOutcomes.length,
      outcomesGenerated: true,
      executionConsumed: true,
      outcomes: frozenOutcomes,
      score: scoreG5R3Outcomes(frozenOutcomes),
      production: false,
      scientificRootsMinted: 0,
    });
  } catch (error) {
    executionConsumed = true;
    throw error;
  }
}

export function getG5R3OneShotHarnessFreezeDescriptor() {
  return Object.freeze({
    version: DOMI_G5_R3_ONE_SHOT_HARNESS_VERSION,
    panelCommitment: DOMI_G5_R3_PANEL_COMMITMENT,
    scorerCommitment: DOMI_G5_R3_SCORER_COMMITMENT,
    planCommitment: DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT,
    plannedCalls: DOMI_G5_R3_ONE_SHOT_PLAN.length,
    armModes: Object.freeze(Object.keys(ARM_PLAN)),
    executionPolicy: "ONE_SHOT_NO_RETRY_NO_RESCUE",
    authorizationGate: "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED",
    authorizationMarker: DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER,
    executionAttempted,
    executionConsumed,
    subjectCalls: 0,
    subjectOutcomesGenerated: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
