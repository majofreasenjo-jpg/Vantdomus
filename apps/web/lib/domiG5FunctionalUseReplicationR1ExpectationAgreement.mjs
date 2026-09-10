import crypto from "node:crypto";
import {
  DOMI_G5_FUR1_HELDOUT_GENERATOR_VERSION,
  DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
  generateG5Fur1HeldoutPanel,
  assertG5Fur1HeldoutPanelIntegrity,
} from "./domiG5FunctionalUseReplicationR1Heldout.mjs";
import {
  DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION,
  deriveG5Fur1PrimaryArmExpectation,
} from "./domiG5FunctionalUseReplicationR1PrimaryEvaluator.mjs";
import {
  DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION,
  deriveG5Fur1SecondaryArmExpectation,
} from "./domiG5FunctionalUseReplicationR1SecondaryEvaluator.mjs";

export const DOMI_G5_FUR1_EXPECTATION_AGREEMENT_VERSION = "DOMI_G5_FUR1_EXPECTATION_AGREEMENT_V0_1";

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

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function publicExpectation(expectation) {
  return Object.freeze({
    expectedDisposition: expectation.expectedDisposition,
    expectedAction: expectation.expectedAction,
    expectedMemoryReadCount: expectation.expectedMemoryReadCount,
    expectedContentEchoed: expectation.expectedContentEchoed,
    scientificRootsMinted: expectation.scientificRootsMinted,
    production: expectation.production,
  });
}

function sameExpectation(left, right) {
  return JSON.stringify(publicExpectation(left)) === JSON.stringify(publicExpectation(right));
}

function requireSafeExpectation(expectation) {
  if (expectation.expectedContentEchoed !== false) {
    throw new Error("G5_FUR1_EXPECTATION_CONTENT_ECHO_INVALID");
  }
  if (expectation.scientificRootsMinted !== 0) {
    throw new Error("G5_FUR1_EXPECTATION_SCIENTIFIC_ROOT_INVALID");
  }
  if (expectation.production !== false) {
    throw new Error("G5_FUR1_EXPECTATION_PRODUCTION_SCOPE_INVALID");
  }
}

export function runG5Fur1ExpectationAgreementHarness() {
  const panel = generateG5Fur1HeldoutPanel();
  const integrity = assertG5Fur1HeldoutPanelIntegrity(panel);
  if (!integrity.pass || panel.length !== DOMI_G5_FUR1_HELDOUT_PANEL_SIZE) {
    throw new Error("G5_FUR1_EXPECTATION_PANEL_INTEGRITY_FAILED");
  }

  let challengeAgreementCount = 0;
  let armPairAgreementCount = 0;
  let aDExactWithinPrimaryCount = 0;
  let aDExactWithinSecondaryCount = 0;
  let bHoldExpectationCount = 0;
  let cHoldExpectationCount = 0;
  const distinctActionsInA = new Set();
  const commitmentTranscript = [];

  for (const item of panel) {
    const canonicalChallenge = item.canonicalChallenge;
    const renderingChallenge = Object.freeze({
      ...canonicalChallenge,
      presentationVariant: item.presentationVariant,
      presentationEnvelope: item.presentationEnvelope,
    });

    const primaryByArm = new Map();
    const secondaryByArm = new Map();
    let allArmsAgreeForChallenge = true;

    for (const arm of ARMS) {
      const challenge = arm === "D_RENDERING_PERTURBATION" ? renderingChallenge : canonicalChallenge;
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

      requireSafeExpectation(primary);
      requireSafeExpectation(secondary);
      primaryByArm.set(arm, primary);
      secondaryByArm.set(arm, secondary);

      if (sameExpectation(primary, secondary)) {
        armPairAgreementCount += 1;
      } else {
        allArmsAgreeForChallenge = false;
      }
    }

    const primaryA = primaryByArm.get("A_MEMORY_AVAILABLE");
    const primaryB = primaryByArm.get("B_MEMORY_ABLATED");
    const primaryC = primaryByArm.get("C_UNGOVERNED_MATCHED_CONTROL");
    const primaryD = primaryByArm.get("D_RENDERING_PERTURBATION");
    const secondaryA = secondaryByArm.get("A_MEMORY_AVAILABLE");
    const secondaryD = secondaryByArm.get("D_RENDERING_PERTURBATION");

    if (primaryA.expectedAction === primaryD.expectedAction) aDExactWithinPrimaryCount += 1;
    if (secondaryA.expectedAction === secondaryD.expectedAction) aDExactWithinSecondaryCount += 1;
    if (primaryB.expectedDisposition === "HOLD_MEMORY_UNAVAILABLE" && primaryB.expectedAction === null) {
      bHoldExpectationCount += 1;
    }
    if (primaryC.expectedDisposition === "HOLD_UNGOVERNED_MEMORY" && primaryC.expectedAction === null) {
      cHoldExpectationCount += 1;
    }

    distinctActionsInA.add(primaryA.expectedAction);
    if (allArmsAgreeForChallenge) challengeAgreementCount += 1;

    commitmentTranscript.push(Object.freeze({
      index: item.index,
      challengeId: canonicalChallenge.challengeId,
      selector: canonicalChallenge.selector,
      nonce: canonicalChallenge.nonce,
      primaryA: primaryA.expectedAction,
      secondaryA: secondaryA.expectedAction,
      primaryB: primaryB.expectedDisposition,
      primaryC: primaryC.expectedDisposition,
      primaryD: primaryD.expectedAction,
      secondaryD: secondaryD.expectedAction,
    }));
  }

  const expectationAgreementDigest = sha256Hex(JSON.stringify(commitmentTranscript));
  const pass =
    challengeAgreementCount === DOMI_G5_FUR1_HELDOUT_PANEL_SIZE &&
    armPairAgreementCount === DOMI_G5_FUR1_HELDOUT_PANEL_SIZE * ARMS.length &&
    aDExactWithinPrimaryCount === DOMI_G5_FUR1_HELDOUT_PANEL_SIZE &&
    aDExactWithinSecondaryCount === DOMI_G5_FUR1_HELDOUT_PANEL_SIZE &&
    bHoldExpectationCount === DOMI_G5_FUR1_HELDOUT_PANEL_SIZE &&
    cHoldExpectationCount === DOMI_G5_FUR1_HELDOUT_PANEL_SIZE &&
    distinctActionsInA.size === 16;

  return Object.freeze({
    version: DOMI_G5_FUR1_EXPECTATION_AGREEMENT_VERSION,
    pass,
    generatorVersion: DOMI_G5_FUR1_HELDOUT_GENERATOR_VERSION,
    primaryEvaluatorVersion: DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION,
    secondaryEvaluatorVersion: DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION,
    panelIntegrityPass: integrity.pass,
    panelSize: panel.length,
    uniqueChallengeIds: integrity.uniqueChallengeIds,
    challengeAgreementCount,
    challengeAgreementRequired: DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
    armPairAgreementCount,
    armPairAgreementRequired: DOMI_G5_FUR1_HELDOUT_PANEL_SIZE * ARMS.length,
    aDExactWithinPrimaryCount,
    aDExactWithinSecondaryCount,
    bHoldExpectationCount,
    cHoldExpectationCount,
    distinctActionsInA: distinctActionsInA.size,
    expectationAgreementDigest,
    aggregateOnly: true,
    perCaseExpectationsReturned: false,
    canonicalMemoryReadPerformedByHarness: false,
    subjectImported: false,
    subjectExecuted: false,
    subjectOutcomeInspected: false,
    outcomeProduced: false,
    realOwnerMemoryEntryCount: 1,
    scientificRootsMinted: 0,
    production: false,
  });
}

export function describeG5Fur1ExpectationAgreementFreeze() {
  return Object.freeze({
    version: DOMI_G5_FUR1_EXPECTATION_AGREEMENT_VERSION,
    purpose: "PRIMARY_SECONDARY_EXPECTATION_AGREEMENT_PRE_SUBJECT_EXECUTION",
    panelSize: DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
    arms: ARMS,
    aggregateOnly: true,
    primaryEvaluatorImported: true,
    secondaryEvaluatorImported: true,
    heldoutGeneratorImported: true,
    subjectImported: false,
    governedMemoryReaderImported: false,
    parentScorerImported: false,
    canonicalMemoryReadPerformedByDescriptor: false,
    subjectExecuted: false,
    subjectOutcomeInspected: false,
    outcomeProduced: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
