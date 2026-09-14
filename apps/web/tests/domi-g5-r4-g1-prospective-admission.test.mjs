import test from "node:test";
import assert from "node:assert/strict";
import {
  R4_G1_ADMISSION_CHECKS,
  R4_G1_ADMISSION_PASS,
  R4_G1_ENTRIES,
  R4_G1_LONGITUDINAL_STATE,
} from "../lib/domiG5R4ProspectiveLongitudinalState.mjs";

test("R4 G1 admits one remote anchor, four distractors, then one activation cue", () => {
  assert.equal(R4_G1_ADMISSION_PASS, true);
  assert.equal(R4_G1_ENTRIES.length, 6);
  assert.equal(R4_G1_ENTRIES[0].role, "REMOTE_ANCHOR");
  assert.equal(R4_G1_ENTRIES.at(-1).role, "ACTIVATION_CUE");
  assert.equal(R4_G1_ENTRIES.filter((entry) => entry.role === "DISTRACTOR").length, 4);
  assert.equal(R4_G1_LONGITUDINAL_STATE.interveningEntryCount, 4);
});

test("R4 G1 is a fresh nonpersonal namespace with no R3 panel reuse", () => {
  assert.equal(R4_G1_ADMISSION_CHECKS.namespaceIsolated, true);
  assert.equal(R4_G1_ADMISSION_CHECKS.nonPersonalControlledStimuli, true);
  assert.equal(R4_G1_ADMISSION_CHECKS.noRetroactiveImport, true);
  assert.equal(R4_G1_ADMISSION_CHECKS.noHoldoutReuse, true);
  for (const entry of R4_G1_ENTRIES) {
    assert.match(entry.entryId, /^R4-G1-/);
    assert.equal(entry.holdout, false);
    assert.equal(entry.rawOwnerMemory, false);
    assert.equal(entry.personalData, false);
  }
});

test("R4 G1 chronology is strict and the remote relation is separated", () => {
  assert.equal(R4_G1_ADMISSION_CHECKS.chronological, true);
  assert.equal(R4_G1_ADMISSION_CHECKS.anchorBeforeCue, true);
  assert.equal(R4_G1_ADMISSION_CHECKS.minimumFourInterveningEntries, true);
  assert.notEqual(R4_G1_ENTRIES[0].contentToken, R4_G1_ENTRIES.at(-1).contentToken);
});

test("R4 G1 remains pre-outcome and scientifically zero-credit", () => {
  assert.equal(R4_G1_ADMISSION_CHECKS.productionFalse, true);
  assert.equal(R4_G1_ADMISSION_CHECKS.scientificEvidenceCreditZero, true);
  assert.equal(R4_G1_ADMISSION_CHECKS.scientificRootsMintedZero, true);
  assert.equal(R4_G1_LONGITUDINAL_STATE.r4ScientificEvidence, "ZERO_PRE_OUTCOME");
  assert.equal(R4_G1_LONGITUDINAL_STATE.executionAuthorized, false);
  assert.equal(R4_G1_LONGITUDINAL_STATE.subjectCalls, 0);
  assert.equal(R4_G1_LONGITUDINAL_STATE.outcomesSeen, false);
  assert.equal(R4_G1_LONGITUDINAL_STATE.production, false);
  assert.equal(R4_G1_LONGITUDINAL_STATE.scientificRootsMinted, 0);
});
