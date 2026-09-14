import crypto from "node:crypto";
import {
  DOMI_G5_R3_HELDOUT_PANEL,
  DOMI_G5_R3_PANEL_COMMITMENT,
  DOMI_G5_R3_HELDOUT_VERSION,
} from "./domiG5AutobiographicalHistoryR3Heldout.mjs";
import {
  DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION,
  deriveG5R3PrimaryExpectation,
  describeG5R3PrimaryEvaluatorFreeze,
} from "./domiG5AutobiographicalHistoryR3PrimaryEvaluator.mjs";

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

export const DOMI_G5_R3_PRIMARY_EXPECTATIONS = Object.freeze(
  DOMI_G5_R3_HELDOUT_PANEL.flatMap((group) =>
    group.arms.map((arm) => Object.freeze({
      groupId: group.groupId,
      armId: arm.armId,
      ...deriveG5R3PrimaryExpectation({ challenge: group.challenge, armMode: arm.armMode }),
    })),
  ),
);

export const DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT = commitment({
  heldoutVersion: DOMI_G5_R3_HELDOUT_VERSION,
  panelCommitment: DOMI_G5_R3_PANEL_COMMITMENT,
  evaluatorVersion: DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION,
  expectations: DOMI_G5_R3_PRIMARY_EXPECTATIONS,
});

export function getG5R3PrimaryExpectationFreezeDescriptor() {
  const evaluator = describeG5R3PrimaryEvaluatorFreeze();
  return Object.freeze({
    heldoutVersion: DOMI_G5_R3_HELDOUT_VERSION,
    panelCommitment: DOMI_G5_R3_PANEL_COMMITMENT,
    evaluatorVersion: DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION,
    expectationCount: DOMI_G5_R3_PRIMARY_EXPECTATIONS.length,
    expectationCommitment: DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
    subjectImportedByEvaluator: evaluator.subjectImported,
    subjectExecuted: false,
    subjectCalls: 0,
    subjectOutcomesGenerated: false,
    subjectOutcomesInspected: false,
    secondaryEvaluatorGenerated: false,
    scorerFrozen: false,
    oneShotHarnessFrozen: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
