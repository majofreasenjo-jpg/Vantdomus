import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_PRIMARY_EXPECTATIONS,
} from "../lib/domiG5AutobiographicalHistoryR3PrimaryExpectationFreeze.mjs";
import {
  DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT,
  DOMI_G5_R3_SCORER_COMMITMENT,
  scoreG5R3Outcomes,
  getG5R3ScorerFreezeDescriptor,
} from "../lib/domiG5AutobiographicalHistoryR3Scorer.mjs";

function perfectOutcomes() {
  return DOMI_G5_R3_PRIMARY_EXPECTATIONS.map((row) => ({
    groupId: row.groupId,
    armId: row.armId,
    challengeId: row.challengeId,
    armMode: row.armMode,
    disposition: row.expectedDisposition,
    action: row.expectedAction,
    memoryReadCount: row.expectedMemoryReadCount,
    memoryEntryCountSeen: row.expectedMemoryEntryCountSeen,
    historyDepthUsed: row.expectedHistoryDepthUsed,
    contentEchoed: row.expectedContentEchoed,
    production: row.expectedProduction,
    scientificRootsMinted: row.expectedScientificRootsMinted,
  }));
}

test("scorer freeze is pre-outcome, fixed, and requires 192 exact matches", () => {
  const d = getG5R3ScorerFreezeDescriptor();
  assert.equal(d.requiredExactMatchCount, 192);
  assert.equal(d.preconditionAgreementCount, 192);
  assert.equal(d.preconditionDisagreementCount, 0);
  assert.equal(d.subjectImported, false);
  assert.equal(d.subjectExecuted, false);
  assert.equal(d.subjectCalls, 0);
  assert.equal(d.subjectOutcomesGenerated, false);
  assert.equal(d.subjectOutcomesInspected, false);
  assert.equal(d.executionAuthorized, false);
  assert.match(DOMI_G5_R3_SCORER_COMMITMENT, /^[0-9a-f]{64}$/);
});

test("perfect synthetic fixture passes all 192 exact rows", () => {
  const score = scoreG5R3Outcomes(perfectOutcomes());
  assert.equal(score.exactMatchCount, DOMI_G5_R3_REQUIRED_EXACT_MATCH_COUNT);
  assert.equal(score.mismatchCount, 0);
  assert.equal(score.scoreStatus, "PASS_ALL_192_EXACT");
  assert.equal(score.gateDecision, "PASS_R3_SCORER");
  assert.equal(score.claimCandidate, "PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3");
});

test("one mismatch fails closed with zero scientific gate credit", () => {
  const rows = perfectOutcomes();
  rows[0] = { ...rows[0], action: rows[0].action === null ? "R3_ACTION_00" : "R3_ACTION_3F" };
  const score = scoreG5R3Outcomes(rows);
  assert.equal(score.gateDecision, "FAIL_R3");
  assert.equal(score.scientificGateCredit, "ZERO");
  assert.equal(score.claimCandidate, null);
  assert.equal(score.mismatchCount >= 1, true);
});

test("missing, duplicate, extra, malformed, and options all fail closed", () => {
  const base = perfectOutcomes();
  assert.equal(scoreG5R3Outcomes(base.slice(0, 191)).gateDecision, "FAIL_R3");
  const duplicate = [...base.slice(0, 191), base[0]];
  assert.equal(scoreG5R3Outcomes(duplicate).reason, "DUPLICATE_OUTCOME_ARM_ID");
  const extra = base.map((row) => ({ ...row }));
  extra[0].armId = "UNKNOWN-ARM";
  assert.equal(scoreG5R3Outcomes(extra).reason, "UNKNOWN_OUTCOME_ARM_ID");
  const malformed = base.map((row) => ({ ...row }));
  malformed[0] = null;
  assert.equal(scoreG5R3Outcomes(malformed).reason, "MALFORMED_OUTCOME_ROW");
  assert.equal(scoreG5R3Outcomes(base, { weights: [1] }).reason, "SCORER_OPTIONS_FORBIDDEN_NO_REWEIGHTING_OR_RESCUE");
});

test("scorer has no rescue, reweighting, retry, or post-hoc threshold path", () => {
  const d = getG5R3ScorerFreezeDescriptor();
  assert.equal(d.policy.rowWeights, "FIXED_UNIFORM_NO_REWEIGHTING");
  assert.equal(d.policy.exclusions, "NONE_POST_FREEZE");
  assert.equal(d.policy.rescue, "FORBIDDEN");
  assert.equal(d.policy.retries, "FORBIDDEN_AT_SCORER_LAYER");
  assert.equal(d.policy.thresholdAdjustment, "FORBIDDEN");
  assert.equal(d.policy.postOutcomeRuleChange, "FORBIDDEN");
});

test("scorer serialization contains no raw owner datum or subject output", () => {
  const serialized = JSON.stringify(getG5R3ScorerFreezeDescriptor());
  assert.equal(serialized.includes("La felicidad antes de todo"), false);
  assert.equal(serialized.includes("subjectOutput"), false);
  assert.equal(serialized.includes("observedOutcome"), false);
});
