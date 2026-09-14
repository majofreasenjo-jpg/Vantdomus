import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_HELDOUT_PANEL,
  DOMI_G5_R3_PANEL_COMMITMENT,
} from "../lib/domiG5AutobiographicalHistoryR3Heldout.mjs";
import {
  DOMI_G5_R3_PRIMARY_ARM_MODES,
  DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION,
  deriveG5R3PrimaryExpectation,
  describeG5R3PrimaryEvaluatorFreeze,
} from "../lib/domiG5AutobiographicalHistoryR3PrimaryEvaluator.mjs";
import {
  DOMI_G5_R3_PRIMARY_EXPECTATIONS,
  DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
  getG5R3PrimaryExpectationFreezeDescriptor,
} from "../lib/domiG5AutobiographicalHistoryR3PrimaryExpectationFreeze.mjs";

test("primary evaluator freezes independently with no subject execution", () => {
  const descriptor = describeG5R3PrimaryEvaluatorFreeze();
  assert.equal(descriptor.version, DOMI_G5_R3_PRIMARY_EVALUATOR_VERSION);
  assert.deepEqual(descriptor.armModes, DOMI_G5_R3_PRIMARY_ARM_MODES);
  assert.equal(descriptor.subjectImported, false);
  assert.equal(descriptor.subjectExecuted, false);
  assert.equal(descriptor.secondaryEvaluatorImported, false);
  assert.equal(descriptor.heldoutOutcomeInspected, false);
  assert.equal(descriptor.production, false);
  assert.equal(descriptor.scientificRootsMinted, 0);
});

test("primary expectation freeze covers exactly all 192 heldout arms", () => {
  const descriptor = getG5R3PrimaryExpectationFreezeDescriptor();
  assert.equal(descriptor.panelCommitment, DOMI_G5_R3_PANEL_COMMITMENT);
  assert.equal(descriptor.expectationCount, 192);
  assert.match(descriptor.expectationCommitment, /^[0-9a-f]{64}$/);
  assert.equal(descriptor.subjectCalls, 0);
  assert.equal(descriptor.subjectOutcomesGenerated, false);
  assert.equal(descriptor.subjectOutcomesInspected, false);
  assert.equal(descriptor.secondaryEvaluatorGenerated, false);
  assert.equal(descriptor.scorerFrozen, false);
  assert.equal(descriptor.oneShotHarnessFrozen, false);
  assert.equal(DOMI_G5_R3_PRIMARY_EXPECTATIONS.length, 192);
});

test("one and only one primary expectation exists for every arm id", () => {
  const expectedArmIds = DOMI_G5_R3_HELDOUT_PANEL.flatMap((group) => group.arms.map((arm) => arm.armId));
  const actualArmIds = DOMI_G5_R3_PRIMARY_EXPECTATIONS.map((row) => row.armId);
  assert.equal(new Set(actualArmIds).size, 192);
  assert.deepEqual([...actualArmIds].sort(), [...expectedArmIds].sort());
});

test("arm semantics are frozen without observed outcomes", () => {
  const byMode = new Map();
  for (const row of DOMI_G5_R3_PRIMARY_EXPECTATIONS) {
    if (!byMode.has(row.armMode)) byMode.set(row.armMode, []);
    byMode.get(row.armMode).push(row);
    assert.equal(row.evaluator, "PRIMARY");
    assert.equal(row.expectedMemoryReadCount, 1);
    assert.equal(row.expectedContentEchoed, false);
    assert.equal(row.expectedProduction, false);
    assert.equal(row.expectedScientificRootsMinted, 0);
  }
  for (const mode of DOMI_G5_R3_PRIMARY_ARM_MODES) assert.equal(byMode.get(mode)?.length, 16);
  for (const row of byMode.get("A_FULL_TRAJECTORY")) {
    assert.equal(row.expectedDisposition, "PASS_ACTION");
    assert.match(row.expectedAction, /^R3_ACTION_[0-9A-F]{2}$/);
    assert.equal(row.expectedMemoryEntryCountSeen, 3);
    assert.equal(row.expectedHistoryDepthUsed, 3);
  }
  for (const row of byMode.get("H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED")) {
    assert.equal(row.expectedDisposition, "PASS_ACTION");
    assert.match(row.expectedAction, /^R3_ACTION_[0-9A-F]{2}$/);
  }
  for (const mode of ["B_EARLY_HISTORY_ABLATION","C_MIDDLE_HISTORY_ABLATION","D_LATEST_HISTORY_ABLATION","E_PREFIX_ONLY_HISTORY","K_PAIR_ONLY"]) {
    for (const row of byMode.get(mode)) {
      assert.equal(row.expectedDisposition, "HOLD_HISTORY_INCOMPLETE");
      assert.equal(row.expectedAction, null);
    }
  }
  for (const mode of ["F_FORGED_CHRONOLOGY","G_FORGED_PROVENANCE"]) {
    for (const row of byMode.get(mode)) {
      assert.equal(row.expectedDisposition, "HOLD_UNGOVERNED_HISTORY");
      assert.equal(row.expectedAction, null);
    }
  }
  for (const row of byMode.get("J_DIRECT_ENTRY_ONLY")) {
    assert.equal(row.expectedDisposition, "HOLD_HISTORY_INCOMPLETE");
    assert.equal(row.expectedMemoryEntryCountSeen, 1);
    assert.equal(row.expectedAction, null);
  }
  for (const mode of ["I_WRITE_ONLY_HISTORY","L_MATCHED_PRESENT_SUMMARY_ONLY"]) {
    for (const row of byMode.get(mode)) {
      assert.equal(row.expectedDisposition, "HOLD_HISTORY_UNAVAILABLE");
      assert.equal(row.expectedMemoryEntryCountSeen, 0);
      assert.equal(row.expectedAction, null);
    }
  }
});

test("enumeration reversal shares the same oracle action as full trajectory within each group", () => {
  for (const group of DOMI_G5_R3_HELDOUT_PANEL) {
    const full = deriveG5R3PrimaryExpectation({ challenge: group.challenge, armMode: "A_FULL_TRAJECTORY" });
    const reversed = deriveG5R3PrimaryExpectation({ challenge: group.challenge, armMode: "H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED" });
    assert.equal(full.expectedAction, reversed.expectedAction);
    assert.equal(full.expectedDisposition, "PASS_ACTION");
    assert.equal(reversed.expectedDisposition, "PASS_ACTION");
  }
});

test("expectation commitment is frozen and no raw owner datum is serialized", () => {
  assert.match(DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT, /^[0-9a-f]{64}$/);
  const serialized = JSON.stringify(DOMI_G5_R3_PRIMARY_EXPECTATIONS);
  assert.equal(serialized.includes("La felicidad antes de todo"), false);
  assert.equal(serialized.includes("ownerDatum"), false);
  assert.equal(serialized.includes("subjectOutput"), false);
  assert.equal(serialized.includes("observedOutcome"), false);
});
