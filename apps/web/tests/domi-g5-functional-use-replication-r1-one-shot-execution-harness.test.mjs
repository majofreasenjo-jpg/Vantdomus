import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOMI_G5_FUR1_ONE_SHOT_HARNESS_VERSION,
  DOMI_G5_FUR1_ONE_SHOT_AUTHORIZATION_PHRASE,
  prepareG5Fur1OneShotExecutionPlan,
  executeG5Fur1OneShot,
  describeG5Fur1OneShotExecutionHarnessFreeze,
} from "../lib/domiG5FunctionalUseReplicationR1OneShotExecutionHarness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, "../lib/domiG5FunctionalUseReplicationR1OneShotExecutionHarness.mjs");
const source = fs.readFileSync(sourcePath, "utf8");

test("R1 one-shot harness freeze descriptor is exact and non-executing", () => {
  const descriptor = describeG5Fur1OneShotExecutionHarnessFreeze();
  assert.equal(descriptor.version, DOMI_G5_FUR1_ONE_SHOT_HARNESS_VERSION);
  assert.equal(descriptor.purpose, "ONE_SHOT_HELDOUT_EXECUTION_HARNESS_FROZEN_PRE_EXECUTION");
  assert.equal(descriptor.panelSize, 96);
  assert.deepEqual(descriptor.arms, [
    "A_MEMORY_AVAILABLE",
    "B_MEMORY_ABLATED",
    "C_UNGOVERNED_MATCHED_CONTROL",
    "D_RENDERING_PERTURBATION",
  ]);
  assert.equal(descriptor.subjectCallsPerChallenge, 4);
  assert.equal(descriptor.totalSubjectCalls, 384);
  assert.equal(descriptor.executionCount, 1);
  assert.equal(descriptor.explicitAuthorizationRequired, true);
  assert.equal(descriptor.authorizationPhraseFrozen, true);
  assert.equal(descriptor.executionStarted, false);
  assert.equal(descriptor.heldoutSubjectExecutedByDescriptor, false);
  assert.equal(descriptor.subjectOutcomeInspectedByDescriptor, false);
  assert.equal(descriptor.outcomeProducedByDescriptor, false);
  assert.equal(descriptor.production, false);
  assert.equal(descriptor.scientificRootsMinted, 0);
});

test("R1 one-shot plan is deterministic, aggregate, and does not execute the subject", () => {
  const first = prepareG5Fur1OneShotExecutionPlan();
  const second = prepareG5Fur1OneShotExecutionPlan();
  assert.deepEqual(first, second);
  assert.equal(first.state, "PREPARED_NOT_EXECUTED");
  assert.equal(first.panelIntegrityPass, true);
  assert.equal(first.panelSize, 96);
  assert.equal(first.totalSubjectCalls, 384);
  assert.equal(first.executionCountIfAuthorized, 1);
  assert.match(first.planCommitmentDigest, /^[0-9a-f]{64}$/);
  assert.equal(first.explicitAuthorizationRequired, true);
  assert.equal(first.subjectExecuted, false);
  assert.equal(first.subjectOutcomeInspected, false);
  assert.equal(first.outcomeProduced, false);
  assert.equal(first.production, false);
  assert.equal(first.scientificRootsMinted, 0);
});

test("R1 one-shot harness fails closed without explicit heldout authorization", () => {
  assert.throws(() => executeG5Fur1OneShot(), /G5_FUR1_ONE_SHOT_EXPLICIT_AUTHORIZATION_REQUIRED/);
  assert.throws(
    () => executeG5Fur1OneShot({ authorization: { authorizationPhrase: DOMI_G5_FUR1_ONE_SHOT_AUTHORIZATION_PHRASE } }),
    /G5_FUR1_ONE_SHOT_EXPLICIT_AUTHORIZATION_INVALID/,
  );
  assert.equal(describeG5Fur1OneShotExecutionHarnessFreeze().executionStarted, false);
});

test("R1 one-shot authorization contract is frozen to non-production and no network probes", () => {
  assert.ok(source.includes('authorization.authorizationPhrase !== DOMI_G5_FUR1_ONE_SHOT_AUTHORIZATION_PHRASE'));
  assert.ok(source.includes('authorization.authorizeHeldoutExecution !== true'));
  assert.ok(source.includes('authorization.gate !== "G5_FUNCTIONAL_USE_INDEPENDENT_REPLICATION_R1"'));
  assert.ok(source.includes('authorization.production !== false'));
  assert.ok(source.includes('authorization.scientificNetworkProbes !== false'));
});

test("R1 one-shot latch is set before the first subject call and forbids same-panel retry", () => {
  const latchIndex = source.indexOf("executionStarted = true;");
  const subjectLoopIndex = source.indexOf("runSubjectArm(arm, item)");
  const retryGuardIndex = source.indexOf("G5_FUR1_ONE_SHOT_ALREADY_STARTED_NO_SAME_PANEL_RETRY");
  assert.ok(retryGuardIndex >= 0);
  assert.ok(latchIndex >= 0);
  assert.ok(subjectLoopIndex >= 0);
  assert.ok(latchIndex < subjectLoopIndex);
});

test("R1 one-shot harness freezes exact 96x4 execution geometry and arm semantics", () => {
  assert.ok(source.includes("const TOTAL_SUBJECT_CALLS = DOMI_G5_FUR1_HELDOUT_PANEL_SIZE * SUBJECT_CALLS_PER_CHALLENGE"));
  assert.ok(source.includes('case "A_MEMORY_AVAILABLE"'));
  assert.ok(source.includes('case "B_MEMORY_ABLATED"'));
  assert.ok(source.includes('case "C_UNGOVERNED_MATCHED_CONTROL"'));
  assert.ok(source.includes('case "D_RENDERING_PERTURBATION"'));
  assert.ok(source.includes("readG5FirstOwnerMemory()"));
  assert.ok(source.includes("buildNonGovernedMatchedControl()"));
  assert.ok(source.includes("G5_FUR1_INTENTIONAL_MEMORY_ABLATION"));
  assert.ok(source.includes("presentationChallenge(item)"));
});

test("R1 one-shot harness performs ledger custody checks before and after execution", () => {
  assert.ok(source.includes("requirePreExecutionCustody()"));
  assert.ok(source.includes("const preLedger = requirePreExecutionCustody();"));
  assert.ok(source.includes("const postLedger = captureLedgerState();"));
  assert.ok(source.includes("ledgerUnchanged"));
  assert.ok(source.includes('record?.entry?.entryId === "G5-E-0002-REAL"'));
  assert.ok(source.includes("realOwnerMemoryEntryCountAfter: postLedger.entryCount"));
});

test("R1 one-shot harness returns aggregate adjudication only and does not expose owner content", () => {
  assert.ok(source.includes("aggregateOnly: true"));
  assert.ok(source.includes("perCaseOutcomesReturned: false"));
  assert.ok(source.includes("ownerMemoryContentReturned: false"));
  assert.ok(source.includes("outcomeMatrixDigest"));
  assert.ok(source.includes("scoreCommitmentDigest"));
  assert.equal(source.includes("content: G5_FIRST_REAL_OWNER_DATUM"), true);
  assert.equal(source.includes("ownerMemoryContent:"), false);
});

test("R1 one-shot harness has no production, network, parent scorer, or mutation surface", () => {
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("https://"), false);
  assert.equal(source.includes("MemoryFunctionalUseHeldout"), false);
  assert.equal(source.includes("parent scorer"), false);
  assert.equal(source.includes("appendG5OwnerLedgerDatum"), false);
  assert.equal(source.includes("admitG5ProspectiveOwnerDatum"), false);
  assert.equal(source.includes("G5-E-0002-REAL\",\n    content"), false);
  assert.ok(source.includes("productionMutation: false"));
  assert.ok(source.includes("scientificRootsMinted: 0"));
});
