import crypto from "node:crypto";
import {
  DOMI_G5_R3_PRIMARY_EXPECTATIONS,
  DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
} from "./domiG5AutobiographicalHistoryR3PrimaryExpectationFreeze.mjs";
import {
  DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
} from "./domiG5AutobiographicalHistoryR3SecondaryExpectationFreeze.mjs";
import {
  DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
  DOMI_G5_R3_EXPECTATION_AGREEMENT_COUNT,
  DOMI_G5_R3_EXPECTATION_DISAGREEMENT_COUNT,
} from "./domiG5AutobiographicalHistoryR3ExpectationAgreement.mjs";

export const DOMI_G5_R3_SCORER_VERSION = "DOMI_G5_R3_SCORER_V0_1";
export const DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT = 192;
export const DOMI_G5_R3_SCORE_FIELDS = Object.freeze([
  "challengeId",
  "armMode",
  "disposition",
  "action",
  "memoryReadCount",
  "memoryEntryCountSeen",
  "historyDepthUsed",
  "contentEchoed",
  "production",
  "scientificRootsMinted",
]);

const EXPECTED_TO_OBSERVED = Object.freeze({
  challengeId: "challengeId",
  armMode: "armMode",
  expectedDisposition: "disposition",
  expectedAction: "action",
  expectedMemoryReadCount: "memoryReadCount",
  expectedMemoryEntryCountSeen: "memoryEntryCountSeen",
  expectedHistoryDepthUsed: "historyDepthUsed",
  expectedContentEchoed: "contentEchoed",
  expectedProduction: "production",
  expectedScientificRootsMinted: "scientificRootsMinted",
});

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

const SCORER_POLICY = Object.freeze({
  rowCount: DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT,
  aggregation: "ALL_OR_NOTHING_EXACT_192_OF_192",
  rowWeights: "FIXED_UNIFORM_NO_REWEIGHTING",
  exclusions: "NONE_POST_FREEZE",
  missingRows: "FAIL_CLOSED",
  unknownRows: "FAIL_CLOSED",
  duplicateRows: "FAIL_CLOSED",
  malformedRows: "FAIL_CLOSED",
  mismatch: "ZERO_GATE_CREDIT",
  rescue: "FORBIDDEN",
  retries: "FORBIDDEN_AT_SCORER_LAYER",
  thresholdAdjustment: "FORBIDDEN",
  postOutcomeRuleChange: "FORBIDDEN",
});

export const DOMI_G5_R3_SCORER_COMMITMENT = commitment({
  version: DOMI_G5_R3_SCORER_VERSION,
  primaryExpectationCommitment: DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
  secondaryExpectationCommitment: DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
  agreementCommitment: DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
  fields: DOMI_G5_R3_SCORE_FIELDS,
  mapping: EXPECTED_TO_OBSERVED,
  policy: SCORER_POLICY,
});

function failClosed(reason, details = Object.freeze({})) {
  return Object.freeze({
    scorerVersion: DOMI_G5_R3_SCORER_VERSION,
    scorerCommitment: DOMI_G5_R3_SCORER_COMMITMENT,
    scoreStatus: "FAIL_CLOSED",
    gateDecision: "FAIL_R3",
    claimCandidate: null,
    scientificGateCredit: "ZERO",
    exactMatchCount: 0,
    requiredExactMatchCount: DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT,
    mismatchCount: DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT,
    reason,
    details,
    rescueAllowed: false,
    reweightingAllowed: false,
    retryAllowedByScorer: false,
    production: false,
    scientificRootsMinted: 0,
  });
}

function rowMismatches(expected, observed) {
  const mismatches = [];
  for (const [expectedField, observedField] of Object.entries(EXPECTED_TO_OBSERVED)) {
    if (!Object.is(expected[expectedField], observed[observedField])) {
      mismatches.push(Object.freeze({
        field: observedField,
        expected: expected[expectedField],
        observed: observed[observedField],
      }));
    }
  }
  return Object.freeze(mismatches);
}

export function scoreG5R3Outcomes(outcomes, options = undefined) {
  if (options !== undefined) {
    return failClosed("SCORER_OPTIONS_FORBIDDEN_NO_REWEIGHTING_OR_RESCUE");
  }
  if (!Array.isArray(outcomes)) return failClosed("OUTCOMES_ARRAY_REQUIRED");
  if (outcomes.length !== DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT) {
    return failClosed("OUTCOME_ROW_COUNT_MUST_EQUAL_192", Object.freeze({ observedRowCount: outcomes.length }));
  }

  const observedByArm = new Map();
  for (const row of outcomes) {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.armId !== "string") {
      return failClosed("MALFORMED_OUTCOME_ROW");
    }
    if (observedByArm.has(row.armId)) {
      return failClosed("DUPLICATE_OUTCOME_ARM_ID", Object.freeze({ armId: row.armId }));
    }
    observedByArm.set(row.armId, row);
  }

  const expectedArmIds = new Set(DOMI_G5_R3_PRIMARY_EXPECTATIONS.map((row) => row.armId));
  for (const armId of observedByArm.keys()) {
    if (!expectedArmIds.has(armId)) {
      return failClosed("UNKNOWN_OUTCOME_ARM_ID", Object.freeze({ armId }));
    }
  }

  const scoredRows = [];
  for (const expected of DOMI_G5_R3_PRIMARY_EXPECTATIONS) {
    const observed = observedByArm.get(expected.armId);
    if (!observed) return failClosed("MISSING_OUTCOME_ARM_ID", Object.freeze({ armId: expected.armId }));
    if (observed.groupId !== expected.groupId) {
      return failClosed("GROUP_ID_MISMATCH", Object.freeze({
        armId: expected.armId,
        expectedGroupId: expected.groupId,
        observedGroupId: observed.groupId ?? null,
      }));
    }
    const mismatches = rowMismatches(expected, observed);
    scoredRows.push(Object.freeze({
      groupId: expected.groupId,
      armId: expected.armId,
      exactMatch: mismatches.length === 0,
      mismatches,
    }));
  }

  const exactMatchCount = scoredRows.filter((row) => row.exactMatch).length;
  const mismatchCount = DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT - exactMatchCount;
  const pass = exactMatchCount === DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT && mismatchCount === 0;

  return Object.freeze({
    scorerVersion: DOMI_G5_R3_SCORER_VERSION,
    scorerCommitment: DOMI_G5_R3_SCORER_COMMITMENT,
    scoreStatus: pass ? "PASS_ALL_192_EXACT" : "FAIL_CLOSED_EXPECTATION_MISMATCH",
    gateDecision: pass ? "PASS_R3_SCORER" : "FAIL_R3",
    claimCandidate: pass ? "PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3" : null,
    scientificGateCredit: pass ? "ELIGIBLE_FOR_G12_ADJUDICATION" : "ZERO",
    exactMatchCount,
    requiredExactMatchCount: DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT,
    mismatchCount,
    scoredRows: Object.freeze(scoredRows),
    rescueAllowed: false,
    reweightingAllowed: false,
    retryAllowedByScorer: false,
    production: false,
    scientificRootsMinted: 0,
  });
}

export function getG5R3ScorerFreezeDescriptor() {
  return Object.freeze({
    version: DOMI_G5_R3_SCORER_VERSION,
    scorerCommitment: DOMI_G5_R3_SCORER_COMMITMENT,
    primaryExpectationCommitment: DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
    secondaryExpectationCommitment: DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
    agreementCommitment: DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
    preconditionAgreementCount: DOMI_G5_R3_EXPECTATION_AGREEMENT_COUNT,
    preconditionDisagreementCount: DOMI_G5_R3_EXPECTATION_DISAGREEMENT_COUNT,
    requiredExactMatchCount: DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT,
    scoreFields: DOMI_G5_R3_SCORE_FIELDS,
    policy: SCORER_POLICY,
    subjectImported: false,
    subjectExecuted: false,
    subjectCalls: 0,
    subjectOutcomesGenerated: false,
    subjectOutcomesInspected: false,
    oneShotHarnessFrozen: false,
    executionAuthorized: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
