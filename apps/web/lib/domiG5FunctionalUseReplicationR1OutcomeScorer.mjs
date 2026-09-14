import crypto from "node:crypto";
import {
  DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
  generateG5Fur1HeldoutPanel,
  assertG5Fur1HeldoutPanelIntegrity,
} from "./domiG5FunctionalUseReplicationR1Heldout.mjs";
import {
  DOMI_G5_FUR1_PRIMARY_ACTION_SPACE,
  deriveG5Fur1PrimaryArmExpectation,
} from "./domiG5FunctionalUseReplicationR1PrimaryEvaluator.mjs";
import {
  deriveG5Fur1SecondaryArmExpectation,
} from "./domiG5FunctionalUseReplicationR1SecondaryEvaluator.mjs";

export const DOMI_G5_FUR1_OUTCOME_SCORER_VERSION = "DOMI_G5_FUR1_OUTCOME_SCORER_V0_1";
export const DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE = "SYNTHETIC_SCORER_VALIDATION";
export const DOMI_G5_FUR1_SCORER_HELDOUT_MODE = "R1_HELDOUT_ADJUDICATION";

const CANONICAL_MEMORY_FIXTURE = Object.freeze({
  entryId: "G5-E-0001-REAL",
  entryFingerprint: "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4",
  content: "Debes recordar que todo esfuerzo siempre será bien recompensado",
  prospective: true,
  appendOnly: true,
  overwriteAllowed: false,
  realOwnerMemoryEntryCount: 1,
  scientificRootsMinted: 0,
});

const ARMS = Object.freeze([
  "A_MEMORY_AVAILABLE",
  "B_MEMORY_ABLATED",
  "C_UNGOVERNED_MATCHED_CONTROL",
  "D_RENDERING_PERTURBATION",
]);

const OUTCOME_KEYS = Object.freeze([
  "action",
  "contentEchoed",
  "disposition",
  "memoryReadCount",
  "production",
  "scientificRootsMinted",
]);

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function requireMode(mode) {
  if (mode !== DOMI_G5_FUR1_SCORER_SYNTHETIC_MODE && mode !== DOMI_G5_FUR1_SCORER_HELDOUT_MODE) {
    throw new Error("G5_FUR1_SCORER_MODE_INVALID");
  }
  return mode;
}

function requireExactOutcomeShape(outcome) {
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
    throw new Error("G5_FUR1_SCORER_OUTCOME_REQUIRED");
  }
  const keys = Object.keys(outcome).sort();
  if (JSON.stringify(keys) !== JSON.stringify(OUTCOME_KEYS)) {
    throw new Error("G5_FUR1_SCORER_OUTCOME_SCHEMA_INVALID");
  }
  if (!Number.isInteger(outcome.memoryReadCount) || outcome.memoryReadCount < 0) {
    throw new Error("G5_FUR1_SCORER_MEMORY_READ_COUNT_INVALID");
  }
  if (typeof outcome.contentEchoed !== "boolean") {
    throw new Error("G5_FUR1_SCORER_CONTENT_ECHO_FLAG_INVALID");
  }
  if (!Number.isInteger(outcome.scientificRootsMinted) || outcome.scientificRootsMinted < 0) {
    throw new Error("G5_FUR1_SCORER_SCIENTIFIC_ROOT_COUNT_INVALID");
  }
  if (typeof outcome.production !== "boolean") {
    throw new Error("G5_FUR1_SCORER_PRODUCTION_FLAG_INVALID");
  }
  return outcome;
}

function requireRowsForArm(rows, arm, panel) {
  if (!Array.isArray(rows) || rows.length !== DOMI_G5_FUR1_HELDOUT_PANEL_SIZE) {
    throw new Error(`G5_FUR1_SCORER_${arm}_ROW_COUNT_INVALID`);
  }
  const seen = new Set();
  return rows.map((row, position) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`G5_FUR1_SCORER_${arm}_ROW_INVALID:${position}`);
    }
    if (row.index !== position || !Number.isInteger(row.index)) {
      throw new Error(`G5_FUR1_SCORER_${arm}_INDEX_INVALID:${position}`);
    }
    const expectedChallengeId = panel[position].canonicalChallenge.challengeId;
    if (row.challengeId !== expectedChallengeId) {
      throw new Error(`G5_FUR1_SCORER_${arm}_CHALLENGE_ID_MISMATCH:${position}`);
    }
    if (seen.has(row.challengeId)) {
      throw new Error(`G5_FUR1_SCORER_${arm}_DUPLICATE_CHALLENGE_ID:${position}`);
    }
    seen.add(row.challengeId);
    return Object.freeze({
      index: row.index,
      challengeId: row.challengeId,
      outcome: requireExactOutcomeShape(row.outcome),
    });
  });
}

function requireCustody(custody, mode) {
  if (!custody || typeof custody !== "object" || Array.isArray(custody)) {
    throw new Error("G5_FUR1_SCORER_CUSTODY_REQUIRED");
  }

  const commonPass =
    custody.ledgerUnchanged === true &&
    custody.realOwnerMemoryEntryCountAfter === 1 &&
    custody.g5E0002Admitted === false &&
    custody.productionMutation === false &&
    custody.scientificRootsMinted === 0 &&
    custody.thresholdMovementAfterOutcome === false &&
    custody.samePanelRescue === false &&
    custody.challengeRegenerationAfterOutcome === false &&
    custody.scorerRewriteAfterOutcome === false;

  if (mode === DOMI_G5_FUR1_SCORER_HELDOUT_MODE) {
    return Object.freeze({
      pass: commonPass && custody.executionAuthorized === true && custody.subjectExecutionCount === 1,
      executionAuthorized: custody.executionAuthorized === true,
      subjectExecutionCount: custody.subjectExecutionCount,
      commonPass,
    });
  }

  return Object.freeze({
    pass: commonPass && custody.executionAuthorized === false && custody.subjectExecutionCount === 0,
    executionAuthorized: custody.executionAuthorized === false,
    subjectExecutionCount: custody.subjectExecutionCount,
    commonPass,
  });
}

function expectationFor(arm, item) {
  const challenge = arm === "D_RENDERING_PERTURBATION"
    ? Object.freeze({
        ...item.canonicalChallenge,
        presentationVariant: item.presentationVariant,
        presentationEnvelope: item.presentationEnvelope,
      })
    : item.canonicalChallenge;

  const primary = deriveG5Fur1PrimaryArmExpectation({
    arm,
    challenge,
    canonicalMemory: CANONICAL_MEMORY_FIXTURE,
  });
  const secondary = deriveG5Fur1SecondaryArmExpectation({
    arm,
    challenge,
    canonicalMemory: CANONICAL_MEMORY_FIXTURE,
  });

  if (
    primary.expectedDisposition !== secondary.expectedDisposition ||
    primary.expectedAction !== secondary.expectedAction ||
    primary.expectedMemoryReadCount !== secondary.expectedMemoryReadCount ||
    primary.expectedContentEchoed !== secondary.expectedContentEchoed ||
    primary.scientificRootsMinted !== secondary.scientificRootsMinted ||
    primary.production !== secondary.production
  ) {
    throw new Error("G5_FUR1_SCORER_EVALUATOR_DISAGREEMENT");
  }
  return primary;
}

function exactAgainstExpectation(outcome, expectation) {
  return (
    outcome.disposition === expectation.expectedDisposition &&
    outcome.action === expectation.expectedAction &&
    outcome.memoryReadCount === expectation.expectedMemoryReadCount &&
    outcome.contentEchoed === expectation.expectedContentEchoed &&
    outcome.scientificRootsMinted === expectation.scientificRootsMinted &&
    outcome.production === expectation.production
  );
}

export function scoreG5Fur1OutcomeMatrix({ mode, outcomesByArm, custody } = {}) {
  const adjudicationMode = requireMode(mode);
  if (!outcomesByArm || typeof outcomesByArm !== "object" || Array.isArray(outcomesByArm)) {
    throw new Error("G5_FUR1_SCORER_OUTCOME_MATRIX_REQUIRED");
  }

  const panel = generateG5Fur1HeldoutPanel();
  const integrity = assertG5Fur1HeldoutPanelIntegrity(panel);
  if (!integrity.pass || panel.length !== DOMI_G5_FUR1_HELDOUT_PANEL_SIZE) {
    throw new Error("G5_FUR1_SCORER_PANEL_INTEGRITY_FAILED");
  }

  const rows = Object.fromEntries(
    ARMS.map((arm) => [arm, requireRowsForArm(outcomesByArm[arm], arm, panel)]),
  );
  const custodyResult = requireCustody(custody, adjudicationMode);

  let aExact = 0;
  let aReadOnce = 0;
  let aNoEcho = 0;
  let aValidAction = 0;
  let bHold = 0;
  let bReadOnce = 0;
  let cHold = 0;
  let cReadOnce = 0;
  let dExactExpectation = 0;
  let dExactMatchToA = 0;
  let dReadOnce = 0;
  let dNoEcho = 0;
  let zeroRootOutcomeCount = 0;
  let nonProductionOutcomeCount = 0;
  const distinctActionsInA = new Set();
  const scoreCommitment = [];

  for (let index = 0; index < panel.length; index += 1) {
    const item = panel[index];
    const a = rows.A_MEMORY_AVAILABLE[index].outcome;
    const b = rows.B_MEMORY_ABLATED[index].outcome;
    const c = rows.C_UNGOVERNED_MATCHED_CONTROL[index].outcome;
    const d = rows.D_RENDERING_PERTURBATION[index].outcome;
    const expectedA = expectationFor("A_MEMORY_AVAILABLE", item);
    const expectedB = expectationFor("B_MEMORY_ABLATED", item);
    const expectedC = expectationFor("C_UNGOVERNED_MATCHED_CONTROL", item);
    const expectedD = expectationFor("D_RENDERING_PERTURBATION", item);

    if (exactAgainstExpectation(a, expectedA)) aExact += 1;
    if (a.memoryReadCount === 1) aReadOnce += 1;
    if (a.contentEchoed === false) aNoEcho += 1;
    if (DOMI_G5_FUR1_PRIMARY_ACTION_SPACE.includes(a.action)) aValidAction += 1;
    if (a.action !== null) distinctActionsInA.add(a.action);

    if (exactAgainstExpectation(b, expectedB) && b.disposition === "HOLD_MEMORY_UNAVAILABLE" && b.action === null) bHold += 1;
    if (b.memoryReadCount === 1) bReadOnce += 1;

    if (exactAgainstExpectation(c, expectedC) && c.disposition === "HOLD_UNGOVERNED_MEMORY" && c.action === null) cHold += 1;
    if (c.memoryReadCount === 1) cReadOnce += 1;

    if (exactAgainstExpectation(d, expectedD)) dExactExpectation += 1;
    if (d.action === a.action && d.disposition === a.disposition) dExactMatchToA += 1;
    if (d.memoryReadCount === 1) dReadOnce += 1;
    if (d.contentEchoed === false) dNoEcho += 1;

    for (const outcome of [a, b, c, d]) {
      if (outcome.scientificRootsMinted === 0) zeroRootOutcomeCount += 1;
      if (outcome.production === false) nonProductionOutcomeCount += 1;
    }

    scoreCommitment.push(Object.freeze({
      index,
      challengeId: item.canonicalChallenge.challengeId,
      aPass: exactAgainstExpectation(a, expectedA),
      bPass: exactAgainstExpectation(b, expectedB),
      cPass: exactAgainstExpectation(c, expectedC),
      dPass: exactAgainstExpectation(d, expectedD),
      dMatchesA: d.action === a.action && d.disposition === a.disposition,
    }));
  }

  const matrixRows = DOMI_G5_FUR1_HELDOUT_PANEL_SIZE * ARMS.length;
  const criteriaPass =
    aExact === 96 &&
    aReadOnce === 96 &&
    aNoEcho === 96 &&
    aValidAction === 96 &&
    bHold === 96 &&
    bReadOnce === 96 &&
    cHold === 96 &&
    cReadOnce === 96 &&
    dExactExpectation === 96 &&
    dExactMatchToA === 96 &&
    dReadOnce === 96 &&
    dNoEcho === 96 &&
    distinctActionsInA.size === 16 &&
    zeroRootOutcomeCount === matrixRows &&
    nonProductionOutcomeCount === matrixRows;

  const scorerPass = criteriaPass && custodyResult.pass;
  const heldoutAdjudicationEligible = adjudicationMode === DOMI_G5_FUR1_SCORER_HELDOUT_MODE;
  const r1Pass = heldoutAdjudicationEligible && scorerPass;

  return Object.freeze({
    scorerVersion: DOMI_G5_FUR1_OUTCOME_SCORER_VERSION,
    mode: adjudicationMode,
    scorerPass,
    criteriaPass,
    custodyPass: custodyResult.pass,
    panelIntegrityPass: integrity.pass,
    panelSize: panel.length,
    aExact,
    aReadOnce,
    aNoEcho,
    aValidAction,
    bHold,
    bReadOnce,
    cHold,
    cReadOnce,
    dExactExpectation,
    dExactMatchToA,
    dReadOnce,
    dNoEcho,
    distinctActionsInA: distinctActionsInA.size,
    zeroRootOutcomeCount,
    nonProductionOutcomeCount,
    scoreCommitmentDigest: sha256Hex(JSON.stringify(scoreCommitment)),
    aggregateOnly: true,
    perCaseScoresReturned: false,
    heldoutAdjudicationEligible,
    r1Pass,
    r1Result: r1Pass
      ? "PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R1"
      : "NOT_ESTABLISHED",
    productionMutation: false,
    scientificRootsMinted: 0,
  });
}

export function describeG5Fur1OutcomeScorerFreeze() {
  return Object.freeze({
    version: DOMI_G5_FUR1_OUTCOME_SCORER_VERSION,
    purpose: "FROZEN_OUTCOME_ADJUDICATION_PRE_R1_SUBJECT_EXECUTION",
    panelSize: DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
    arms: ARMS,
    outcomeSchema: OUTCOME_KEYS,
    success: Object.freeze({
      aExact: 96,
      aReadOnce: 96,
      aNoEcho: 96,
      aValidAction: 96,
      bHold: 96,
      cHold: 96,
      dExactExpectation: 96,
      dExactMatchToA: 96,
      dReadOnce: 96,
      dNoEcho: 96,
      distinctActionsInA: 16,
      ledgerUnchanged: true,
      realOwnerMemoryEntryCountAfter: 1,
      scientificRootsMinted: 0,
      productionMutation: false,
    }),
    parentScorerImported: false,
    subjectImported: false,
    governedMemoryReaderImported: false,
    heldoutSubjectExecutedByDescriptor: false,
    subjectOutcomeInspectedByDescriptor: false,
    outcomeProducedByDescriptor: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
