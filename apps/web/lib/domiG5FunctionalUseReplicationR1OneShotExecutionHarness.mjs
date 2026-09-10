import crypto from "node:crypto";
import {
  DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
  generateG5Fur1HeldoutPanel,
  assertG5Fur1HeldoutPanelIntegrity,
} from "./domiG5FunctionalUseReplicationR1Heldout.mjs";
import {
  solveG5FunctionalUseReplicationR1,
} from "./domiG5FunctionalUseReplicationR1Subject.mjs";
import {
  G5_FIRST_REAL_OWNER_DATUM,
  G5_FIRST_REAL_OWNER_OBSERVED_AT,
  G5_FIRST_REAL_OWNER_SURFACE,
  G5_OWNER_ACTIVATION_RECEIPT,
  G5_OWNER_APPEND_ONLY_LEDGER,
  G5_OWNER_LEDGER_STATE,
  G5_OWNER_LONGITUDINAL_STATE,
  readG5FirstOwnerMemory,
} from "./domiG5OwnerLongitudinalSeed.mjs";
import {
  projectG5OwnerLedgerState,
} from "./domiG5OwnerAppendOnlyLedger.mjs";
import {
  DOMI_G5_FUR1_SCORER_HELDOUT_MODE,
  scoreG5Fur1OutcomeMatrix,
} from "./domiG5FunctionalUseReplicationR1OutcomeScorer.mjs";

export const DOMI_G5_FUR1_ONE_SHOT_HARNESS_VERSION = "DOMI_G5_FUR1_ONE_SHOT_HARNESS_V0_1";
export const DOMI_G5_FUR1_ONE_SHOT_AUTHORIZATION_PHRASE = "AUTHORIZE_G5_FUR1_R1_HELDOUT_ONE_SHOT";

const ARMS = Object.freeze([
  "A_MEMORY_AVAILABLE",
  "B_MEMORY_ABLATED",
  "C_UNGOVERNED_MATCHED_CONTROL",
  "D_RENDERING_PERTURBATION",
]);
const SUBJECT_CALLS_PER_CHALLENGE = ARMS.length;
const TOTAL_SUBJECT_CALLS = DOMI_G5_FUR1_HELDOUT_PANEL_SIZE * SUBJECT_CALLS_PER_CHALLENGE;

let executionStarted = false;

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalDigest(value) {
  return sha256Hex(JSON.stringify(canonical(value)));
}

function requireExplicitAuthorization(authorization) {
  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) {
    throw new Error("G5_FUR1_ONE_SHOT_EXPLICIT_AUTHORIZATION_REQUIRED");
  }
  if (
    authorization.authorizationPhrase !== DOMI_G5_FUR1_ONE_SHOT_AUTHORIZATION_PHRASE ||
    authorization.authorizeHeldoutExecution !== true ||
    authorization.gate !== "G5_FUNCTIONAL_USE_INDEPENDENT_REPLICATION_R1" ||
    authorization.production !== false ||
    authorization.scientificNetworkProbes !== false
  ) {
    throw new Error("G5_FUR1_ONE_SHOT_EXPLICIT_AUTHORIZATION_INVALID");
  }
}

function buildNonGovernedMatchedControl() {
  return Object.freeze({
    entryId: "G5-FUR1-CONTROL-NON_GOVERNED",
    entryFingerprint: "0".repeat(64),
    content: G5_FIRST_REAL_OWNER_DATUM,
    observedAt: G5_FIRST_REAL_OWNER_OBSERVED_AT,
    surfaceClass: G5_FIRST_REAL_OWNER_SURFACE,
    prospective: true,
    appendOnly: false,
    overwriteAllowed: false,
    realOwnerMemoryEntryCount: 0,
    scientificRootsMinted: 0,
  });
}

function wrapRow(item, outcome) {
  return Object.freeze({
    index: item.index,
    challengeId: item.canonicalChallenge.challengeId,
    outcome,
  });
}

function captureLedgerState() {
  const projected = projectG5OwnerLedgerState(
    G5_OWNER_APPEND_ONLY_LEDGER,
    G5_OWNER_ACTIVATION_RECEIPT,
  );
  return Object.freeze({
    ledgerFingerprint: projected.ledgerFingerprint,
    headRecordFingerprint: projected.headRecordFingerprint,
    entryCount: projected.entryCount,
    appendOnly: projected.appendOnly,
    overwriteAllowed: projected.overwriteAllowed,
    scientificRootsMinted: projected.scientificRootsMinted,
    production: projected.production,
    g5E0002Admitted: G5_OWNER_APPEND_ONLY_LEDGER.records.some(
      (record) => record?.entry?.entryId === "G5-E-0002-REAL",
    ),
  });
}

function requirePreExecutionCustody() {
  const state = captureLedgerState();
  if (
    state.ledgerFingerprint !== G5_OWNER_LEDGER_STATE.ledgerFingerprint ||
    state.headRecordFingerprint !== G5_OWNER_LEDGER_STATE.headRecordFingerprint ||
    state.entryCount !== 1 ||
    G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount !== 1 ||
    state.appendOnly !== true ||
    state.overwriteAllowed !== false ||
    state.scientificRootsMinted !== 0 ||
    state.production !== false ||
    state.g5E0002Admitted !== false
  ) {
    throw new Error("G5_FUR1_ONE_SHOT_PRE_EXECUTION_CUSTODY_HOLD");
  }
  return state;
}

function presentationChallenge(item) {
  return Object.freeze({
    ...item.canonicalChallenge,
    presentationVariant: item.presentationVariant,
    presentationEnvelope: item.presentationEnvelope,
  });
}

function runSubjectArm(arm, item) {
  switch (arm) {
    case "A_MEMORY_AVAILABLE":
      return solveG5FunctionalUseReplicationR1({
        challenge: item.canonicalChallenge,
        memoryProvider: () => readG5FirstOwnerMemory(),
      });
    case "B_MEMORY_ABLATED":
      return solveG5FunctionalUseReplicationR1({
        challenge: item.canonicalChallenge,
        memoryProvider: () => {
          throw new Error("G5_FUR1_INTENTIONAL_MEMORY_ABLATION");
        },
      });
    case "C_UNGOVERNED_MATCHED_CONTROL":
      return solveG5FunctionalUseReplicationR1({
        challenge: item.canonicalChallenge,
        memoryProvider: () => buildNonGovernedMatchedControl(),
      });
    case "D_RENDERING_PERTURBATION":
      return solveG5FunctionalUseReplicationR1({
        challenge: presentationChallenge(item),
        memoryProvider: () => readG5FirstOwnerMemory(),
      });
    default:
      throw new Error("G5_FUR1_ONE_SHOT_ARM_INVALID");
  }
}

function summarizeOutcomeMatrix(outcomesByArm) {
  return Object.freeze({
    matrixDigest: canonicalDigest(outcomesByArm),
    armRowCounts: Object.freeze(Object.fromEntries(
      ARMS.map((arm) => [arm, outcomesByArm[arm].length]),
    )),
    totalRows: ARMS.reduce((sum, arm) => sum + outcomesByArm[arm].length, 0),
    contentReturned: false,
    perCaseOutcomesReturned: false,
  });
}

export function prepareG5Fur1OneShotExecutionPlan() {
  const panel = generateG5Fur1HeldoutPanel();
  const integrity = assertG5Fur1HeldoutPanelIntegrity(panel);
  if (!integrity.pass) throw new Error("G5_FUR1_ONE_SHOT_PANEL_INTEGRITY_HOLD");

  const planCommitment = panel.map((item) => Object.freeze({
    index: item.index,
    challengeId: item.canonicalChallenge.challengeId,
    selector: item.canonicalChallenge.selector,
    nonce: item.canonicalChallenge.nonce,
    presentationVariant: item.presentationVariant,
  }));

  return Object.freeze({
    harnessVersion: DOMI_G5_FUR1_ONE_SHOT_HARNESS_VERSION,
    state: "PREPARED_NOT_EXECUTED",
    panelIntegrityPass: true,
    panelSize: panel.length,
    arms: ARMS,
    subjectCallsPerChallenge: SUBJECT_CALLS_PER_CHALLENGE,
    totalSubjectCalls: TOTAL_SUBJECT_CALLS,
    executionCountIfAuthorized: 1,
    planCommitmentDigest: canonicalDigest(planCommitment),
    explicitAuthorizationRequired: true,
    subjectExecuted: false,
    subjectOutcomeInspected: false,
    outcomeProduced: false,
    production: false,
    scientificRootsMinted: 0,
  });
}

export function executeG5Fur1OneShot({ authorization } = {}) {
  requireExplicitAuthorization(authorization);
  if (executionStarted) {
    throw new Error("G5_FUR1_ONE_SHOT_ALREADY_STARTED_NO_SAME_PANEL_RETRY");
  }

  const plan = prepareG5Fur1OneShotExecutionPlan();
  const preLedger = requirePreExecutionCustody();

  executionStarted = true;

  const panel = generateG5Fur1HeldoutPanel();
  const outcomesByArm = Object.fromEntries(ARMS.map((arm) => [arm, []]));

  for (const item of panel) {
    for (const arm of ARMS) {
      outcomesByArm[arm].push(wrapRow(item, runSubjectArm(arm, item)));
    }
  }

  for (const arm of ARMS) Object.freeze(outcomesByArm[arm]);
  Object.freeze(outcomesByArm);

  const postLedger = captureLedgerState();
  const ledgerUnchanged =
    preLedger.ledgerFingerprint === postLedger.ledgerFingerprint &&
    preLedger.headRecordFingerprint === postLedger.headRecordFingerprint &&
    preLedger.entryCount === postLedger.entryCount;

  const custody = Object.freeze({
    executionAuthorized: true,
    subjectExecutionCount: 1,
    subjectCallCount: TOTAL_SUBJECT_CALLS,
    ledgerUnchanged,
    realOwnerMemoryEntryCountAfter: postLedger.entryCount,
    g5E0002Admitted: postLedger.g5E0002Admitted,
    productionMutation: false,
    scientificRootsMinted: postLedger.scientificRootsMinted,
    thresholdMovementAfterOutcome: false,
    samePanelRescue: false,
    challengeRegenerationAfterOutcome: false,
    scorerRewriteAfterOutcome: false,
  });

  const matrixSummary = summarizeOutcomeMatrix(outcomesByArm);
  const score = scoreG5Fur1OutcomeMatrix({
    mode: DOMI_G5_FUR1_SCORER_HELDOUT_MODE,
    outcomesByArm,
    custody,
  });

  return Object.freeze({
    harnessVersion: DOMI_G5_FUR1_ONE_SHOT_HARNESS_VERSION,
    executionState: "CONSUMED_ONE_SHOT",
    planCommitmentDigest: plan.planCommitmentDigest,
    outcomeMatrixDigest: matrixSummary.matrixDigest,
    panelSize: plan.panelSize,
    totalSubjectCalls: TOTAL_SUBJECT_CALLS,
    experimentExecutionCount: 1,
    matrixRows: matrixSummary.totalRows,
    armRowCounts: matrixSummary.armRowCounts,
    custodyPass: score.custodyPass,
    criteriaPass: score.criteriaPass,
    scorerPass: score.scorerPass,
    r1Pass: score.r1Pass,
    r1Result: score.r1Result,
    scoreCommitmentDigest: score.scoreCommitmentDigest,
    aggregateOnly: true,
    perCaseOutcomesReturned: false,
    ownerMemoryContentReturned: false,
    productionMutation: false,
    scientificRootsMinted: 0,
  });
}

export function describeG5Fur1OneShotExecutionHarnessFreeze() {
  return Object.freeze({
    version: DOMI_G5_FUR1_ONE_SHOT_HARNESS_VERSION,
    purpose: "ONE_SHOT_HELDOUT_EXECUTION_HARNESS_FROZEN_PRE_EXECUTION",
    panelSize: DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
    arms: ARMS,
    subjectCallsPerChallenge: SUBJECT_CALLS_PER_CHALLENGE,
    totalSubjectCalls: TOTAL_SUBJECT_CALLS,
    executionCount: 1,
    explicitAuthorizationRequired: true,
    authorizationPhraseFrozen: true,
    oneShotLatch: "PROCESS_LOCAL_SET_BEFORE_FIRST_SUBJECT_CALL",
    samePanelRetry: "FORBIDDEN_AFTER_START",
    armOrder: "A_THEN_B_THEN_C_THEN_D_PER_CHALLENGE",
    realGovernedMemoryArms: Object.freeze(["A_MEMORY_AVAILABLE", "D_RENDERING_PERTURBATION"]),
    memoryAblationArm: "B_MEMORY_ABLATED",
    nonGovernedMatchedControlArm: "C_UNGOVERNED_MATCHED_CONTROL",
    scorerMode: DOMI_G5_FUR1_SCORER_HELDOUT_MODE,
    aggregateReturnOnly: true,
    perCaseOutcomesReturned: false,
    ownerMemoryContentReturned: false,
    executionStarted,
    heldoutSubjectExecutedByDescriptor: false,
    subjectOutcomeInspectedByDescriptor: false,
    outcomeProducedByDescriptor: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
