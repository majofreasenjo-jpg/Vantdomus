import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_PREEXEC_PROVENANCE_COMMITMENT,
  DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST,
  DOMI_G5_R3_SUBJECT_FROZEN_HEAD,
  evaluateG5R3PreExecutionFirewall,
} from "../lib/domiG5AutobiographicalHistoryR3PreExecutionFirewall.mjs";

test("pre-execution provenance manifest commits all frozen R3 components", () => {
  assert.equal(DOMI_G5_R3_SUBJECT_FROZEN_HEAD, "12a59d82473e7b3586e2317f8d1098d58dc1e9ce");
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.frozenSeed, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.panelCommitment, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.primaryExpectationCommitment, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.secondaryExpectationCommitment, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.expectationAgreementCommitment, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.scorerCommitment, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.oneShotPlanCommitment, /^[0-9a-f]{64}$/);
  assert.match(DOMI_G5_R3_PREEXEC_PROVENANCE_COMMITMENT, /^[0-9a-f]{64}$/);
  assert.equal(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.plannedCalls, 192);
});

test("G9 firewall passes only while all frozen pre-outcome invariants remain intact", () => {
  const result = evaluateG5R3PreExecutionFirewall();
  assert.equal(result.pass, true);
  assert.equal(result.status, "PASS_PREEXEC_FIREWALL_G9");
  assert.deepEqual(result.failedChecks, []);
  assert.equal(Object.values(result.checks).every((value) => value === true), true);
});

test("G9 proves no subject calls, no outcomes, no authorization, no production, no roots", () => {
  const result = evaluateG5R3PreExecutionFirewall();
  assert.equal(result.subjectCalls, 0);
  assert.equal(result.outcomesSeen, false);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.production, false);
  assert.equal(result.scientificRootsMinted, 0);
});

test("G9 preserves the exact gate order G10 then G11 then G12", () => {
  assert.equal(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.authorizationGate, "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED");
  assert.equal(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.executionGate, "G11_EXECUTE_EXACTLY_ONCE");
  assert.equal(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST.postExecutionGate, "G12_FREEZE_AND_ADJUDICATE");
});

test("preexec manifest contains no raw E3 datum or observed outcomes", () => {
  const serialized = JSON.stringify(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST);
  assert.equal(serialized.includes("La felicidad antes de todo"), false);
  assert.equal(serialized.includes("subjectOutput"), false);
  assert.equal(serialized.includes("observedOutcome"), false);
});
