import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_HELDOUT_PANEL,
  DOMI_G5_R3_PANEL_COMMITMENT,
} from "../lib/domiG5AutobiographicalHistoryR3Heldout.mjs";
import {
  DOMI_G5_R3_SECONDARY_ARM_MODES,
  DOMI_G5_R3_SECONDARY_EVALUATOR_VERSION,
  deriveG5R3SecondaryExpectation,
  describeG5R3SecondaryEvaluatorFreeze,
} from "../lib/domiG5AutobiographicalHistoryR3SecondaryEvaluator.mjs";
import {
  DOMI_G5_R3_SECONDARY_EXPECTATIONS,
  DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
  getG5R3SecondaryExpectationFreezeDescriptor,
} from "../lib/domiG5AutobiographicalHistoryR3SecondaryExpectationFreeze.mjs";

test("secondary evaluator freezes independently from subject and primary", () => {
  const descriptor = describeG5R3SecondaryEvaluatorFreeze();
  assert.equal(descriptor.version, DOMI_G5_R3_SECONDARY_EVALUATOR_VERSION);
  assert.deepEqual(descriptor.armModes, DOMI_G5_R3_SECONDARY_ARM_MODES);
  assert.equal(descriptor.subjectImported, false);
  assert.equal(descriptor.subjectExecuted, false);
  assert.equal(descriptor.primaryEvaluatorImported, false);
  assert.equal(descriptor.primaryExpectationsImported, false);
  assert.equal(descriptor.heldoutOutcomeInspected, false);
  assert.equal(descriptor.production, false);
  assert.equal(descriptor.scientificRootsMinted, 0);
});

test("secondary expectation matrix covers all 192 arms before outcomes", () => {
  const descriptor = getG5R3SecondaryExpectationFreezeDescriptor();
  assert.equal(descriptor.panelCommitment, DOMI_G5_R3_PANEL_COMMITMENT);
  assert.equal(descriptor.expectationCount, 192);
  assert.match(descriptor.expectationCommitment, /^[0-9a-f]{64}$/);
  assert.equal(descriptor.subjectCalls, 0);
  assert.equal(descriptor.subjectOutcomesGenerated, false);
  assert.equal(descriptor.subjectOutcomesInspected, false);
  assert.equal(descriptor.primaryEvaluatorImported, false);
  assert.equal(descriptor.primaryExpectationsImported, false);
  assert.equal(DOMI_G5_R3_SECONDARY_EXPECTATIONS.length, 192);
});

test("secondary matrix contains exactly one expectation per heldout arm", () => {
  const expected = DOMI_G5_R3_HELDOUT_PANEL.flatMap((group) => group.arms.map((arm) => arm.armId)).sort();
  const actual = DOMI_G5_R3_SECONDARY_EXPECTATIONS.map((row) => row.armId).sort();
  assert.equal(new Set(actual).size, 192);
  assert.deepEqual(actual, expected);
});

test("secondary arm contracts match frozen R3 causal semantics", () => {
  const grouped = Object.groupBy(DOMI_G5_R3_SECONDARY_EXPECTATIONS, (row) => row.armMode);
  for (const mode of DOMI_G5_R3_SECONDARY_ARM_MODES) assert.equal(grouped[mode].length, 16);
  for (const row of grouped.A_FULL_TRAJECTORY) {
    assert.equal(row.expectedDisposition, "PASS_ACTION");
    assert.match(row.expectedAction, /^R3_ACTION_[0-9A-F]{2}$/);
    assert.equal(row.expectedMemoryEntryCountSeen, 3);
    assert.equal(row.expectedHistoryDepthUsed, 3);
  }
  for (const row of grouped.H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED) {
    assert.equal(row.expectedDisposition, "PASS_ACTION");
    assert.match(row.expectedAction, /^R3_ACTION_[0-9A-F]{2}$/);
  }
  for (const mode of ["B_EARLY_HISTORY_ABLATION","C_MIDDLE_HISTORY_ABLATION","D_LATEST_HISTORY_ABLATION","E_PREFIX_ONLY_HISTORY","K_PAIR_ONLY"]) {
    for (const row of grouped[mode]) assert.equal(row.expectedDisposition, "HOLD_HISTORY_INCOMPLETE");
  }
  for (const mode of ["F_FORGED_CHRONOLOGY","G_FORGED_PROVENANCE"]) {
    for (const row of grouped[mode]) assert.equal(row.expectedDisposition, "HOLD_UNGOVERNED_HISTORY");
  }
  for (const mode of ["I_WRITE_ONLY_HISTORY","L_MATCHED_PRESENT_SUMMARY_ONLY"]) {
    for (const row of grouped[mode]) assert.equal(row.expectedDisposition, "HOLD_HISTORY_UNAVAILABLE");
  }
});

test("secondary reversal action equals secondary full-trajectory action per group", () => {
  for (const group of DOMI_G5_R3_HELDOUT_PANEL) {
    const a = deriveG5R3SecondaryExpectation({ challenge: group.challenge, armMode: "A_FULL_TRAJECTORY" });
    const h = deriveG5R3SecondaryExpectation({ challenge: group.challenge, armMode: "H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED" });
    assert.equal(a.expectedAction, h.expectedAction);
  }
});

test("secondary expectation freeze serializes no raw owner datum or observed outcomes", () => {
  assert.match(DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT, /^[0-9a-f]{64}$/);
  const serialized = JSON.stringify(DOMI_G5_R3_SECONDARY_EXPECTATIONS);
  assert.equal(serialized.includes("La felicidad antes de todo"), false);
  assert.equal(serialized.includes("subjectOutput"), false);
  assert.equal(serialized.includes("observedOutcome"), false);
});
