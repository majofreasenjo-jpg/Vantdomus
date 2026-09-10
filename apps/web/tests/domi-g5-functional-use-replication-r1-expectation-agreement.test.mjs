import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DOMI_G5_FUR1_EXPECTATION_AGREEMENT_VERSION,
  runG5Fur1ExpectationAgreementHarness,
  describeG5Fur1ExpectationAgreementFreeze,
} from "../lib/domiG5FunctionalUseReplicationR1ExpectationAgreement.mjs";

test("R1 expectation agreement freeze descriptor is exact and non-executing", () => {
  const freeze = describeG5Fur1ExpectationAgreementFreeze();
  assert.equal(freeze.version, "DOMI_G5_FUR1_EXPECTATION_AGREEMENT_V0_1");
  assert.equal(freeze.purpose, "PRIMARY_SECONDARY_EXPECTATION_AGREEMENT_PRE_SUBJECT_EXECUTION");
  assert.equal(freeze.panelSize, 96);
  assert.deepEqual(freeze.arms, [
    "A_MEMORY_AVAILABLE",
    "B_MEMORY_ABLATED",
    "C_UNGOVERNED_MATCHED_CONTROL",
    "D_RENDERING_PERTURBATION",
  ]);
  assert.equal(freeze.aggregateOnly, true);
  assert.equal(freeze.primaryEvaluatorImported, true);
  assert.equal(freeze.secondaryEvaluatorImported, true);
  assert.equal(freeze.heldoutGeneratorImported, true);
  assert.equal(freeze.subjectImported, false);
  assert.equal(freeze.governedMemoryReaderImported, false);
  assert.equal(freeze.parentScorerImported, false);
  assert.equal(freeze.canonicalMemoryReadPerformedByDescriptor, false);
  assert.equal(freeze.subjectExecuted, false);
  assert.equal(freeze.subjectOutcomeInspected, false);
  assert.equal(freeze.outcomeProduced, false);
  assert.equal(freeze.scientificRootsMinted, 0);
  assert.equal(freeze.production, false);
});

test("R1 expectation agreement harness closes 96/96 challenge-level evaluator agreement", () => {
  const result = runG5Fur1ExpectationAgreementHarness();
  assert.equal(result.version, DOMI_G5_FUR1_EXPECTATION_AGREEMENT_VERSION);
  assert.equal(result.pass, true);
  assert.equal(result.panelIntegrityPass, true);
  assert.equal(result.panelSize, 96);
  assert.equal(result.uniqueChallengeIds, 96);
  assert.equal(result.challengeAgreementCount, 96);
  assert.equal(result.challengeAgreementRequired, 96);
});

test("R1 expectation agreement harness closes all 384 arm-pair comparisons", () => {
  const result = runG5Fur1ExpectationAgreementHarness();
  assert.equal(result.armPairAgreementCount, 384);
  assert.equal(result.armPairAgreementRequired, 384);
});

test("R1 expectation agreement harness preserves frozen A/D rendering invariance in both evaluators", () => {
  const result = runG5Fur1ExpectationAgreementHarness();
  assert.equal(result.aDExactWithinPrimaryCount, 96);
  assert.equal(result.aDExactWithinSecondaryCount, 96);
});

test("R1 expectation agreement harness freezes all B/C fail-closed expectations", () => {
  const result = runG5Fur1ExpectationAgreementHarness();
  assert.equal(result.bHoldExpectationCount, 96);
  assert.equal(result.cHoldExpectationCount, 96);
});

test("R1 expectation agreement harness spans the full frozen 16-action alphabet", () => {
  const result = runG5Fur1ExpectationAgreementHarness();
  assert.equal(result.distinctActionsInA, 16);
});

test("R1 expectation agreement harness returns only aggregate commitment metadata", () => {
  const first = runG5Fur1ExpectationAgreementHarness();
  const second = runG5Fur1ExpectationAgreementHarness();
  assert.equal(first.aggregateOnly, true);
  assert.equal(first.perCaseExpectationsReturned, false);
  assert.equal(typeof first.expectationAgreementDigest, "string");
  assert.match(first.expectationAgreementDigest, /^[0-9a-f]{64}$/);
  assert.equal(first.expectationAgreementDigest, second.expectationAgreementDigest);
  assert.equal(Object.hasOwn(first, "transcript"), false);
  assert.equal(Object.hasOwn(first, "cases"), false);
  assert.equal(Object.hasOwn(first, "memoryContent"), false);
  assert.equal(first.canonicalMemoryReadPerformedByHarness, false);
  assert.equal(first.subjectImported, false);
  assert.equal(first.subjectExecuted, false);
  assert.equal(first.subjectOutcomeInspected, false);
  assert.equal(first.outcomeProduced, false);
  assert.equal(first.realOwnerMemoryEntryCount, 1);
  assert.equal(first.scientificRootsMinted, 0);
  assert.equal(first.production, false);
});

test("R1 expectation agreement source cannot import subject, governed reader, or parent scorer", () => {
  const sourceUrl = new URL("../lib/domiG5FunctionalUseReplicationR1ExpectationAgreement.mjs", import.meta.url);
  const source = readFileSync(fileURLToPath(sourceUrl), "utf8");
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1Subject"), false);
  assert.equal(source.includes("readG5FirstOwnerMemory"), false);
  assert.equal(source.includes("domiG5OwnerLongitudinalSeed"), false);
  assert.equal(source.includes("MemoryFunctionalUseHeldout"), false);
  assert.equal(source.includes("execute"), false);
});
