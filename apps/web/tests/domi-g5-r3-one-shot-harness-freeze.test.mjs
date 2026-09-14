import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_ONE_SHOT_HARNESS_VERSION,
  DOMI_G5_R3_ONE_SHOT_PLAN,
  DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT,
  executeG5R3OneShot,
  getG5R3OneShotHarnessFreezeDescriptor,
} from "../lib/domiG5AutobiographicalHistoryR3OneShotHarness.mjs";

test("one-shot harness freezes 192 planned calls with no execution", () => {
  const d = getG5R3OneShotHarnessFreezeDescriptor();
  assert.equal(d.version, DOMI_G5_R3_ONE_SHOT_HARNESS_VERSION);
  assert.equal(d.plannedCalls, 192);
  assert.equal(DOMI_G5_R3_ONE_SHOT_PLAN.length, 192);
  assert.match(DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT, /^[0-9a-f]{64}$/);
  assert.equal(d.executionAttempted, false);
  assert.equal(d.executionConsumed, false);
  assert.equal(d.subjectCalls, 0);
  assert.equal(d.subjectOutcomesGenerated, false);
});

test("every group contains exactly all 12 frozen intervention modes", () => {
  const byGroup = new Map();
  for (const row of DOMI_G5_R3_ONE_SHOT_PLAN) {
    const list = byGroup.get(row.groupId) ?? [];
    list.push(row.armMode);
    byGroup.set(row.groupId, list);
  }
  assert.equal(byGroup.size, 16);
  for (const modes of byGroup.values()) {
    assert.equal(modes.length, 12);
    assert.equal(new Set(modes).size, 12);
  }
});

test("intervention plans encode expected memory availability geometry", () => {
  const firstGroup = DOMI_G5_R3_ONE_SHOT_PLAN.slice(0, 12);
  const byMode = new Map(firstGroup.map((row) => [row.armMode, row.providerPlan]));
  assert.equal(byMode.get("A_FULL_TRAJECTORY").entryIds.length, 3);
  assert.equal(byMode.get("B_EARLY_HISTORY_ABLATION").entryIds.length, 2);
  assert.equal(byMode.get("C_MIDDLE_HISTORY_ABLATION").entryIds.length, 2);
  assert.equal(byMode.get("D_LATEST_HISTORY_ABLATION").entryIds.length, 2);
  assert.equal(byMode.get("E_PREFIX_ONLY_HISTORY").entryIds.length, 2);
  assert.equal(byMode.get("F_FORGED_CHRONOLOGY").mutation, "E2_OBSERVED_AT_FORGED");
  assert.equal(byMode.get("G_FORGED_PROVENANCE").mutation, "E2_FINGERPRINT_FORGED");
  assert.equal(byMode.get("H_ENUMERATION_REVERSED_CANONICAL_HISTORY_PRESERVED").entryIds.length, 3);
  assert.equal(byMode.get("I_WRITE_ONLY_HISTORY").entryIds.length, 0);
  assert.equal(byMode.get("J_DIRECT_ENTRY_ONLY").entryIds.length, 1);
  assert.equal(byMode.get("K_PAIR_ONLY").entryIds.length, 2);
  assert.equal(byMode.get("L_MATCHED_PRESENT_SUMMARY_ONLY").entryIds.length, 0);
});

test("missing G10 authorization blocks before any subject call", () => {
  const blocked = executeG5R3OneShot();
  assert.equal(blocked.executed, false);
  assert.equal(blocked.subjectCalls, 0);
  assert.equal(blocked.outcomesGenerated, false);
  assert.equal(blocked.blockedAt, "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED");
  const d = getG5R3OneShotHarnessFreezeDescriptor();
  assert.equal(d.executionAttempted, false);
  assert.equal(d.executionConsumed, false);
});

test("malformed or near-miss authorization cannot execute", () => {
  const attempts = [
    {},
    { ownerExplicit: true },
    { ownerExplicit: true, marker: "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_R3", gate: "G9", r3: true },
    { ownerExplicit: true, marker: "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_R3", gate: "G10", r3: false },
  ];
  for (const authorization of attempts) {
    const blocked = executeG5R3OneShot({ authorization });
    assert.equal(blocked.executed, false);
    assert.equal(blocked.subjectCalls, 0);
  }
  const d = getG5R3OneShotHarnessFreezeDescriptor();
  assert.equal(d.executionAttempted, false);
  assert.equal(d.executionConsumed, false);
});

test("freeze descriptor exposes no raw owner datum or outcomes", () => {
  const serialized = JSON.stringify(getG5R3OneShotHarnessFreezeDescriptor());
  assert.equal(serialized.includes("La felicidad antes de todo"), false);
  assert.equal(serialized.includes("subjectOutput"), false);
  assert.equal(serialized.includes("observedOutcome"), false);
});
