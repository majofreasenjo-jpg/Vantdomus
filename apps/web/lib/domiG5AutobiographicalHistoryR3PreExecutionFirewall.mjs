import crypto from "node:crypto";
import {
  DOMI_G5_R3_FROZEN_SEED,
  DOMI_G5_R3_PANEL_COMMITMENT,
  getG5R3HeldoutFreezeDescriptor,
} from "./domiG5AutobiographicalHistoryR3Heldout.mjs";
import {
  getG5R3SubjectFreezeDescriptor,
} from "./domiG5AutobiographicalHistoryR3Subject.mjs";
import {
  DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
  getG5R3PrimaryExpectationFreezeDescriptor,
} from "./domiG5AutobiographicalHistoryR3PrimaryExpectationFreeze.mjs";
import {
  DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
  getG5R3SecondaryExpectationFreezeDescriptor,
} from "./domiG5AutobiographicalHistoryR3SecondaryExpectationFreeze.mjs";
import {
  DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
  getG5R3ExpectationAgreementFreezeDescriptor,
} from "./domiG5AutobiographicalHistoryR3ExpectationAgreement.mjs";
import {
  DOMI_G5_R3_SCORER_COMMITMENT,
  getG5R3ScorerFreezeDescriptor,
} from "./domiG5AutobiographicalHistoryR3Scorer.mjs";
import {
  DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT,
  getG5R3OneShotHarnessFreezeDescriptor,
} from "./domiG5AutobiographicalHistoryR3OneShotHarness.mjs";

export const DOMI_G5_R3_PREEXEC_FIREWALL_VERSION = "DOMI_G5_R3_PREEXEC_FIREWALL_V0_1";
export const DOMI_G5_R3_SUBJECT_FROZEN_HEAD = "12a59d82473e7b3586e2317f8d1098d58dc1e9ce";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function commitment(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export const DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST = Object.freeze({
  version: DOMI_G5_R3_PREEXEC_FIREWALL_VERSION,
  subjectFrozenHead: DOMI_G5_R3_SUBJECT_FROZEN_HEAD,
  frozenSeed: DOMI_G5_R3_FROZEN_SEED,
  panelCommitment: DOMI_G5_R3_PANEL_COMMITMENT,
  primaryExpectationCommitment: DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
  secondaryExpectationCommitment: DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
  expectationAgreementCommitment: DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
  scorerCommitment: DOMI_G5_R3_SCORER_COMMITMENT,
  oneShotPlanCommitment: DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT,
  plannedCalls: 192,
  authorizationGate: "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED",
  executionGate: "G11_EXECUTE_EXACTLY_ONCE",
  postExecutionGate: "G12_FREEZE_AND_ADJUDICATE",
});

export const DOMI_G5_R3_PREEXEC_PROVENANCE_COMMITMENT = commitment(DOMI_G5_R3_PREEXEC_PROVENANCE_MANIFEST);

export function evaluateG5R3PreExecutionFirewall() {
  const heldout = getG5R3HeldoutFreezeDescriptor();
  const subject = getG5R3SubjectFreezeDescriptor();
  const primary = getG5R3PrimaryExpectationFreezeDescriptor();
  const secondary = getG5R3SecondaryExpectationFreezeDescriptor();
  const agreement = getG5R3ExpectationAgreementFreezeDescriptor();
  const scorer = getG5R3ScorerFreezeDescriptor();
  const harness = getG5R3OneShotHarnessFreezeDescriptor();

  const checks = Object.freeze({
    subjectVersionFrozen: subject.version === "DOMI_G5_R3_SUBJECT_V0_1",
    subjectHeadFrozen: DOMI_G5_R3_SUBJECT_FROZEN_HEAD === "12a59d82473e7b3586e2317f8d1098d58dc1e9ce",
    heldoutSeedFrozen: heldout.seedFrozen === true && heldout.seed === DOMI_G5_R3_FROZEN_SEED,
    panelFrozen: heldout.panelMaterialized === true && heldout.panelCommitment === DOMI_G5_R3_PANEL_COMMITMENT,
    primaryFrozen: primary.expectationCount === 192 && primary.expectationCommitment === DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
    secondaryFrozen: secondary.expectationCount === 192 && secondary.expectationCommitment === DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
    evaluatorAgreementFrozen: agreement.agreementCount === 192 && agreement.disagreementCount === 0 && agreement.agreementCommitment === DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
    scorerFrozen: scorer.requiredExactMatchCount === 192 && scorer.scorerCommitment === DOMI_G5_R3_SCORER_COMMITMENT,
    harnessFrozen: harness.plannedCalls === 192 && harness.planCommitment === DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT,
    oneShotUnattempted: harness.executionAttempted === false && harness.executionConsumed === false,
    noSubjectCalls: heldout.subjectCalls === 0 && primary.subjectCalls === 0 && secondary.subjectCalls === 0 && agreement.subjectCalls === 0 && scorer.subjectCalls === 0 && harness.subjectCalls === 0,
    noOutcomesSeen: heldout.subjectOutcomesGenerated === false && primary.subjectOutcomesInspected === false && secondary.subjectOutcomesInspected === false && agreement.subjectOutcomesInspected === false && scorer.subjectOutcomesInspected === false && harness.subjectOutcomesGenerated === false,
    authorizationStillClosed: scorer.executionAuthorized === false && harness.authorizationGate === "G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED",
    noProductionMutation: heldout.production === false && primary.production === false && secondary.production === false && agreement.production === false && scorer.production === false && harness.production === false,
    noScientificRootsMinted: heldout.scientificRootsMinted === 0 && primary.scientificRootsMinted === 0 && secondary.scientificRootsMinted === 0 && agreement.scientificRootsMinted === 0 && scorer.scientificRootsMinted === 0 && harness.scientificRootsMinted === 0,
  });

  const failedChecks = Object.entries(checks).filter(([, pass]) => pass !== true).map(([name]) => name);
  return Object.freeze({
    version: DOMI_G5_R3_PREEXEC_FIREWALL_VERSION,
    provenanceCommitment: DOMI_G5_R3_PREEXEC_PROVENANCE_COMMITMENT,
    checks,
    pass: failedChecks.length === 0,
    failedChecks: Object.freeze(failedChecks),
    status: failedChecks.length === 0 ? "PASS_PREEXEC_FIREWALL_G9" : "HOLD_PREEXEC_FIREWALL_G9",
    subjectCalls: 0,
    outcomesSeen: false,
    executionAuthorized: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
