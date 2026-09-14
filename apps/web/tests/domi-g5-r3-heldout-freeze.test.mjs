import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_ARMS,
  DOMI_G5_R3_FROZEN_SEED,
  DOMI_G5_R3_GROUP_COUNT,
  DOMI_G5_R3_HELDOUT_PANEL,
  DOMI_G5_R3_PANEL_COMMITMENT,
  getG5R3HeldoutFreezeDescriptor,
} from "../lib/domiG5AutobiographicalHistoryR3Heldout.mjs";

test("R3 heldout freeze has the preregistered 16x12 geometry and zero outcomes", () => {
  const descriptor = getG5R3HeldoutFreezeDescriptor();
  assert.equal(descriptor.groupCount, 16);
  assert.equal(descriptor.armsPerGroup, 12);
  assert.equal(descriptor.plannedSubjectCalls, 192);
  assert.equal(descriptor.panelMaterialized, true);
  assert.equal(descriptor.seedFrozen, true);
  assert.equal(descriptor.subjectCalls, 0);
  assert.equal(descriptor.subjectOutcomesGenerated, false);
  assert.equal(descriptor.evaluatorExpectationsGenerated, false);
  assert.equal(descriptor.production, false);
  assert.equal(descriptor.scientificRootsMinted, 0);
});

test("seed and panel commitment are frozen and well formed", () => {
  assert.match(DOMI_G5_R3_FROZEN_SEED, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PANEL_COMMITMENT, /^[0-9a-f]{64}$/);
  assert.equal(DOMI_G5_R3_HELDOUT_PANEL.length, DOMI_G5_R3_GROUP_COUNT);
});

test("every group has exactly the twelve preregistered intervention arms", () => {
  for (const group of DOMI_G5_R3_HELDOUT_PANEL) {
    assert.equal(group.arms.length, 12);
    assert.deepEqual(group.arms.map((arm) => arm.armMode), DOMI_G5_R3_ARMS);
    for (const arm of group.arms) assert.deepEqual(arm.challenge, group.challenge);
  }
});

test("all 16 challenges and all 192 arm ids are unique", () => {
  const challengeIds = DOMI_G5_R3_HELDOUT_PANEL.map((group) => group.challenge.challengeId);
  const armIds = DOMI_G5_R3_HELDOUT_PANEL.flatMap((group) => group.arms.map((arm) => arm.armId));
  assert.equal(new Set(challengeIds).size, 16);
  assert.equal(new Set(armIds).size, 192);
});

test("challenge schema is compatible with frozen R3 subject and carries no history channel", () => {
  for (const group of DOMI_G5_R3_HELDOUT_PANEL) {
    const challenge = group.challenge;
    assert.match(challenge.challengeId, /^G5-R3-C-[0-9a-f]{24}$/);
    assert.ok(Number.isInteger(challenge.selector));
    assert.ok(challenge.selector >= 0 && challenge.selector <= 63);
    assert.match(challenge.nonce, /^[0-9a-f]{48}$/);
    for (const forbidden of ["text", "prompt", "content", "memoryHint", "historySummary", "targetAction", "trajectoryDigest"]) {
      assert.equal(Object.hasOwn(challenge, forbidden), false);
    }
  }
});

test("heldout panel serializes no raw E3 datum and does not mint outcomes", () => {
  const serialized = JSON.stringify(DOMI_G5_R3_HELDOUT_PANEL);
  assert.equal(serialized.includes("La felicidad antes de todo"), false);
  assert.equal(serialized.includes("PASS_ACTION"), false);
  assert.equal(serialized.includes("R3_ACTION_"), false);
});
