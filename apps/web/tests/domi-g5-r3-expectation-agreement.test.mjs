import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS,
  DOMI_G5_R3_EXPECTATION_AGREEMENT_COUNT,
  DOMI_G5_R3_EXPECTATION_DISAGREEMENT_COUNT,
  DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
  getG5R3ExpectationAgreementFreezeDescriptor,
} from "../lib/domiG5AutobiographicalHistoryR3ExpectationAgreement.mjs";

test("R3 primary-secondary agreement covers exactly 192 rows", () => {
  const descriptor = getG5R3ExpectationAgreementFreezeDescriptor();
  assert.equal(descriptor.rowCount, 192);
  assert.equal(DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS.length, 192);
  assert.match(descriptor.primaryExpectationCommitment, /^[0-9a-f]{64}$/);
  assert.match(descriptor.secondaryExpectationCommitment, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT, /^[0-9a-f]{64}$/);
});

test("primary and secondary evaluators agree 192 of 192 with zero missing rows", () => {
  assert.equal(DOMI_G5_R3_EXPECTATION_AGREEMENT_COUNT, 192);
  assert.equal(DOMI_G5_R3_EXPECTATION_DISAGREEMENT_COUNT, 0);
  for (const row of DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS) {
    assert.equal(row.missingPrimary, false);
    assert.equal(row.missingSecondary, false);
    assert.equal(row.agree, true);
  }
});

test("agreement covers causal action and all frozen guardrail fields", () => {
  const descriptor = getG5R3ExpectationAgreementFreezeDescriptor();
  assert.deepEqual(descriptor.comparisonFields, [
    "challengeId",
    "armMode",
    "expectedDisposition",
    "expectedAction",
    "expectedMemoryReadCount",
    "expectedMemoryEntryCountSeen",
    "expectedHistoryDepthUsed",
    "expectedContentEchoed",
    "expectedProduction",
    "expectedScientificRootsMinted",
  ]);
});

test("agreement freeze does not execute or inspect subject outcomes", () => {
  const descriptor = getG5R3ExpectationAgreementFreezeDescriptor();
  assert.equal(descriptor.subjectImported, false);
  assert.equal(descriptor.subjectExecuted, false);
  assert.equal(descriptor.subjectCalls, 0);
  assert.equal(descriptor.subjectOutcomesGenerated, false);
  assert.equal(descriptor.subjectOutcomesInspected, false);
  assert.equal(descriptor.scorerFrozen, false);
  assert.equal(descriptor.oneShotHarnessFrozen, false);
  assert.equal(descriptor.production, false);
  assert.equal(descriptor.scientificRootsMinted, 0);
});

test("agreement artifact contains no raw owner datum", () => {
  const serialized = JSON.stringify(DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS);
  assert.equal(serialized.includes("La felicidad antes de todo"), false);
});
