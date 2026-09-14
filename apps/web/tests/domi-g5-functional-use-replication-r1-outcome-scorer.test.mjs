import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  generateG5Fur1HeldoutPanel,
} from "../lib/domiG5FunctionalUseReplicationR1Heldout.mjs";
import {
  deriveG5Fur1PrimaryArmExpectation,
} from "../lib/domiG5FunctionalUseReplicationR1PrimaryEvaluator.mjs";
import {
  DOMI_G5_FUR1_OUTCOME_SCORER_VERSION,
  DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
  scoreG5Fur1OutcomeMatrix,
  describeG5Fur1OutcomeScorerFreeze,
} from "../lib/domiG5FunctionalUseReplicationR1OutcomeScorer.mjs";

const canonicalMemoryFixture = Object.freeze({
  entryId: "G5-E-0001-REAL",
  entryFingerprint: "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4",
  content: "Debes recordar que todo esfuerzo siempre será bien recompensado",
  prospective: true,
  appendOnly: true,
  overwriteAllowed: false,
  realOwnerMemoryEntryCount: 1,
  scientificRootsMinted: 0,
});

const arms = Object.freeze([
  "A_MEMORY_AVAILABLE",
  "B_MEMORY_ABLATED",
  "C_UNGOVERNED_MATCHED_CONTROL",
  "D_RENDERING_PERTURBATION",
]);

function perfectSyntheticMatrix() {
  const panel = generateG5Fur1HeldoutPanel();
  return Object.fromEntries(arms.map((arm) => [
    arm,
    panel.map((item) => {
      const challenge = arm === "D_RENDERING_PERTURBATION"
        ? {
            ...item.canonicalChallenge,
            presentationVariant: item.presentationVariant,
            presentationEnvelope: item.presentationEnvelope,
          }
        : item.canonicalChallenge;
      const expectation = deriveG5Fur1PrimaryArmExpectation({
        arm,
        challenge,
        canonicalMemory: canonicalMemoryFixture,
      });
      return Object.freeze({
        index: item.index,
        challengeId: item.canonicalChallenge.challengeId,
        outcome: Object.freeze({
          disposition: expectation.expectedDisposition,
          action: expectation.expectedAction,
          memoryReadCount: expectation.expectedMemoryReadCount,
          contentEchoed: expectation.expectedContentEchoed,
          scientificRootsMinted: expectation.scientificRootsMinted,
          production: expectation.production,
        }),
      });
    }),
  ]));
}

function syntheticCustody(overrides = {}) {
  return Object.freeze({
    executionAuthorized: false,
    subjectExecutionCount: 0,
    ledgerUnchanged: true,
    realOwnerMemoryEntryCountAfter: 1,
    g5E0002Admitted: false,
    productionMutation: false,
    scientificRootsMinted: 0,
    thresholdMovementAfterOutcome: false,
    samePanelRescue: false,
    challengeRegenerationAfterOutcome: false,
    scorerRewriteAfterOutcome: false,
    ...overrides,
  });
}

test("R1 outcome scorer freeze descriptor is exact and non-executing", () => {
  const freeze = describeG5Fur1OutcomeScorerFreeze();
  assert.equal(freeze.version, DOMI_G5_FUR1_OUTCOME_SCORER_VERSION);
  assert.equal(freeze.purpose, "FROZEN_OUTCOME_ADJUDICATION_PRE_R1_SUBJECT_EXECUTION");
  assert.equal(freeze.panelSize, 96);
  assert.equal(freeze.arms.length, 4);
  assert.equal(freeze.success.aExact, 96);
  assert.equal(freeze.success.dExactMatchToA, 96);
  assert.equal(freeze.success.distinctActionsInA, 16);
  assert.equal(freeze.parentScorerImported, false);
  assert.equal(freeze.subjectImported, false);
  assert.equal(freeze.governedMemoryReaderImported, false);
  assert.equal(freeze.heldoutSubjectExecutedByDescriptor, false);
  assert.equal(freeze.subjectOutcomeInspectedByDescriptor, false);
  assert.equal(freeze.scientificRootsMinted, 0);
  assert.equal(freeze.production, false);
});

test("perfect synthetic matrix validates scorer mechanics but cannot establish R1", () => {
  const score = scoreG5Fur1OutcomeMatrix({
    mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
    outcomesByArm: perfectSyntheticMatrix(),
    custody: syntheticCustody(),
  });
  assert.equal(score.scorerPass, true);
  assert.equal(score.criteriaPass, true);
  assert.equal(score.custodyPass, true);
  assert.equal(score.aExact, 96);
  assert.equal(score.bHold, 96);
  assert.equal(score.cHold, 96);
  assert.equal(score.dExactExpectation, 96);
  assert.equal(score.dExactMatchToA, 96);
  assert.equal(score.distinctActionsInA, 16);
  assert.equal(score.zeroRootOutcomeCount, 384);
  assert.equal(score.nonProductionOutcomeCount, 384);
  assert.equal(score.heldoutAdjudicationEligible, false);
  assert.equal(score.r1Pass, false);
  assert.equal(score.r1Result, "NOT_ESTABLISHED");
  assert.equal(score.perCaseScoresReturned, false);
});

test("single synthetic A-action tamper deterministically fails frozen exact criterion", () => {
  const matrix = perfectSyntheticMatrix();
  const rows = [...matrix.A_MEMORY_AVAILABLE];
  const original = rows[17];
  rows[17] = {
    ...original,
    outcome: { ...original.outcome, action: original.outcome.action === "ACTION_0" ? "ACTION_1" : "ACTION_0" },
  };
  const score = scoreG5Fur1OutcomeMatrix({
    mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
    outcomesByArm: { ...matrix, A_MEMORY_AVAILABLE: rows },
    custody: syntheticCustody(),
  });
  assert.equal(score.aExact, 95);
  assert.equal(score.criteriaPass, false);
  assert.equal(score.scorerPass, false);
  assert.equal(score.r1Pass, false);
});

test("scorer fails closed on truncated or challenge-misaligned matrices", () => {
  const matrix = perfectSyntheticMatrix();
  assert.throws(
    () => scoreG5Fur1OutcomeMatrix({
      mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
      outcomesByArm: { ...matrix, B_MEMORY_ABLATED: matrix.B_MEMORY_ABLATED.slice(0, 95) },
      custody: syntheticCustody(),
    }),
    /ROW_COUNT_INVALID/,
  );

  const cRows = [...matrix.C_UNGOVERNED_MATCHED_CONTROL];
  cRows[4] = { ...cRows[4], challengeId: cRows[5].challengeId };
  assert.throws(
    () => scoreG5Fur1OutcomeMatrix({
      mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
      outcomesByArm: { ...matrix, C_UNGOVERNED_MATCHED_CONTROL: cRows },
      custody: syntheticCustody(),
    }),
    /CHALLENGE_ID_MISMATCH/,
  );
});

test("scorer rejects outcome schema expansion or malformed counters", () => {
  const matrix = perfectSyntheticMatrix();
  const dRows = [...matrix.D_RENDERING_PERTURBATION];
  dRows[0] = { ...dRows[0], outcome: { ...dRows[0].outcome, debug: "forbidden" } };
  assert.throws(
    () => scoreG5Fur1OutcomeMatrix({
      mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
      outcomesByArm: { ...matrix, D_RENDERING_PERTURBATION: dRows },
      custody: syntheticCustody(),
    }),
    /OUTCOME_SCHEMA_INVALID/,
  );

  const aRows = [...matrix.A_MEMORY_AVAILABLE];
  aRows[0] = { ...aRows[0], outcome: { ...aRows[0].outcome, memoryReadCount: -1 } };
  assert.throws(
    () => scoreG5Fur1OutcomeMatrix({
      mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
      outcomesByArm: { ...matrix, A_MEMORY_AVAILABLE: aRows },
      custody: syntheticCustody(),
    }),
    /MEMORY_READ_COUNT_INVALID/,
  );
});

test("custody violation blocks scorer pass even when all synthetic outcomes match", () => {
  const score = scoreG5Fur1OutcomeMatrix({
    mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
    outcomesByArm: perfectSyntheticMatrix(),
    custody: syntheticCustody({ ledgerUnchanged: false }),
  });
  assert.equal(score.criteriaPass, true);
  assert.equal(score.custodyPass, false);
  assert.equal(score.scorerPass, false);
  assert.equal(score.r1Pass, false);
});

test("synthetic validation cannot be upgraded by execution-like custody flags", () => {
  const score = scoreG5Fur1OutcomeMatrix({
    mode: DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE,
    outcomesByArm: perfectSyntheticMatrix(),
    custody: syntheticCustody({ executionAuthorized: true, subjectExecutionCount: 1 }),
  });
  assert.equal(score.custodyPass, false);
  assert.equal(score.heldoutAdjudicationEligible, false);
  assert.equal(score.r1Pass, false);
  assert.equal(score.r1Result, "NOT_ESTABLISHED");
});

test("R1 outcome scorer source is isolated from subject, governed reader, execution harness, and parent scorer", () => {
  const scorerUrl = new URL("../lib/domiG5FunctionalUseReplicationR1OutcomeScorer.mjs", import.meta.url);
  const source = readFileSync(fileURLToPath(scorerUrl), "utf8");
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1Subject"), false);
  assert.equal(source.includes("solveG5FunctionalUseReplicationR1"), false);
  assert.equal(source.includes("readG5FirstOwnerMemory"), false);
  assert.equal(source.includes("domiG5OwnerLongitudinalSeed"), false);
  assert.equal(source.includes("MemoryFunctionalUseHeldoutScorer"), false);
  assert.equal(source.includes("HeldoutExecution"), false);
});
