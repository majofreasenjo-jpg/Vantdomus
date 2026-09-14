import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  DOMI_G5_R3_SCORER_COMMITMENT,
  scoreG5R3Outcomes,
} from "../lib/domiG5AutobiographicalHistoryR3Scorer.mjs";

const FREEZE_PATH = path.resolve(process.cwd(), "scientific/r3/G11_R1_ONE_SHOT_OUTCOME_FREEZE_2026_09_14.json");
const OUT_PATH = path.resolve(process.cwd(), "scientific/r3/G12_FINAL_ADJUDICATION_R3_2026_09_14.json");

const EXPECTED = Object.freeze({
  outcomeFreezeCommit: "347a9984c9947a1c8a247e64e29f6d0e1abd9f66",
  authorizationReceiptCommit: "6c972dc1e38f3df1db23141000e69f0c418cd47a",
  originalAbortRunId: 34853159719,
  originalAbortJobId: 104005905809,
  originalAbortHeadSha: "915572e16aa7644eb713a50f867b4d11db0ca8f3",
  originalAbortSubjectCalls: 0,
  requiredSubjectCalls: 192,
  requiredOutcomeCount: 192,
  requiredExactMatchCount: 192,
  requiredMismatchCount: 0,
  preexecProvenanceCommitment: "e4752c11b85364dae455d88e5cfe1c7d5b32d8271d8a0dbaebe3a16cee079fa8",
  oneShotPlanCommitment: "ba16329579e32ba21820790457df76064a3f66ea55cb2ffaa47c26fd8d420348",
  scorerCommitment: "59f3ef650acf4bd3dde78afc79605f7bd470a15927d07ffabffa2dd745649711",
  scoreStatus: "PASS_ALL_192_EXACT",
  gateDecision: "PASS_R3_SCORER",
  claimCandidate: "PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3",
  scientificGateCredit: "ELIGIBLE_FOR_G12_ADJUDICATION",
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function eq(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

if (fs.existsSync(OUT_PATH)) throw new Error("G12_FINAL_ADJUDICATION_ALREADY_EXISTS_REFUSE_OVERWRITE");
if (!fs.existsSync(FREEZE_PATH)) throw new Error("G11_R1_OUTCOME_FREEZE_MISSING");

const freeze = JSON.parse(fs.readFileSync(FREEZE_PATH, "utf8"));
const recomputedScore = scoreG5R3Outcomes(freeze.outcomes);
const allOutcomeRowsGoverned = Array.isArray(freeze.outcomes) && freeze.outcomes.every((row) =>
  row && row.production === false && row.scientificRootsMinted === 0 && row.contentEchoed === false,
);

const freezeWithoutFreezeCommitment = { ...freeze };
delete freezeWithoutFreezeCommitment.freezeCommitment;

const checks = Object.freeze({
  supersessionVersion: freeze.supersession?.version === "G11_R1",
  originalAbortRunBound: freeze.supersession?.originalRunId === EXPECTED.originalAbortRunId,
  originalAbortJobBound: freeze.supersession?.originalJobId === EXPECTED.originalAbortJobId,
  originalAbortHeadBound: freeze.supersession?.originalHeadSha === EXPECTED.originalAbortHeadSha,
  originalAbortZeroCalls: freeze.supersession?.originalSubjectCalls === EXPECTED.originalAbortSubjectCalls,
  originalHarnessNotEntered: freeze.supersession?.originalHarnessFunctionEntered === false,
  originalRerunForbidden: freeze.supersession?.originalRunRerunForbidden === true,
  oneShotPolicyPreserved: freeze.g11r1?.executionPolicy === "ONE_SHOT_NO_RETRY_NO_RESCUE",
  executedExactlyOneHarnessPass: freeze.g11r1?.executed === true && freeze.g11r1?.executionConsumed === true,
  subjectCallsExact: freeze.g11r1?.subjectCalls === EXPECTED.requiredSubjectCalls,
  outcomesGenerated: freeze.g11r1?.outcomesGenerated === true,
  outcomeCountExact: Array.isArray(freeze.outcomes) && freeze.outcomes.length === EXPECTED.requiredOutcomeCount,
  productionDisabled: freeze.g11r1?.production === false,
  noScientificRoots: freeze.g11r1?.scientificRootsMinted === 0,
  allOutcomeRowsGoverned,
  preexecCommitmentBound: freeze.provenance?.preexecProvenanceCommitment === EXPECTED.preexecProvenanceCommitment,
  oneShotPlanCommitmentBound: freeze.provenance?.oneShotPlanCommitment === EXPECTED.oneShotPlanCommitment,
  scorerCommitmentBound: freeze.provenance?.scorerCommitment === EXPECTED.scorerCommitment,
  scorerSourceCommitmentMatchesFrozen: DOMI_G5_R3_SCORER_COMMITMENT === EXPECTED.scorerCommitment,
  outcomeCommitmentValid: freeze.outcomeCommitment === sha(freeze.outcomes),
  storedScoreCommitmentValid: freeze.scoreCommitment === sha(freeze.score),
  freezeCommitmentValid: freeze.freezeCommitment === sha(freezeWithoutFreezeCommitment),
  recomputedScoreEqualsStored: eq(recomputedScore, freeze.score),
  recomputedScoreStatusExact: recomputedScore.scoreStatus === EXPECTED.scoreStatus,
  recomputedGateDecisionExact: recomputedScore.gateDecision === EXPECTED.gateDecision,
  recomputedClaimCandidateExact: recomputedScore.claimCandidate === EXPECTED.claimCandidate,
  recomputedScientificGateCreditExact: recomputedScore.scientificGateCredit === EXPECTED.scientificGateCredit,
  exactMatchCountExact: recomputedScore.exactMatchCount === EXPECTED.requiredExactMatchCount,
  mismatchCountZero: recomputedScore.mismatchCount === EXPECTED.requiredMismatchCount,
  recomputedScoreProductionFalse: recomputedScore.production === false,
  recomputedScoreRootsZero: recomputedScore.scientificRootsMinted === 0,
  noRescue: recomputedScore.rescueAllowed === false,
  noReweighting: recomputedScore.reweightingAllowed === false,
  noScorerRetry: recomputedScore.retryAllowedByScorer === false,
});

const failedChecks = Object.entries(checks).filter(([, pass]) => pass !== true).map(([name]) => name);
const pass = failedChecks.length === 0;

const adjudication = Object.freeze({
  project: "VANTDOMUS_DOMI",
  gate: "G12_FINAL_ADJUDICATION_R3",
  mode: "STATIC_READ_ONLY_NO_SUBJECT_EXECUTION",
  source: Object.freeze({
    outcomeFreezeCommit: EXPECTED.outcomeFreezeCommit,
    authorizationReceiptCommit: EXPECTED.authorizationReceiptCommit,
    outcomeFreezePath: "apps/web/scientific/r3/G11_R1_ONE_SHOT_OUTCOME_FREEZE_2026_09_14.json",
    originalAbortRunId: EXPECTED.originalAbortRunId,
    originalAbortJobId: EXPECTED.originalAbortJobId,
  }),
  checks,
  failedChecks: Object.freeze(failedChecks),
  observed: Object.freeze({
    originalAbortSubjectCalls: freeze.supersession?.originalSubjectCalls ?? null,
    g11r1SubjectCalls: freeze.g11r1?.subjectCalls ?? null,
    outcomeCount: Array.isArray(freeze.outcomes) ? freeze.outcomes.length : null,
    exactMatchCount: recomputedScore.exactMatchCount ?? null,
    mismatchCount: recomputedScore.mismatchCount ?? null,
    scoreStatus: recomputedScore.scoreStatus ?? null,
    gateDecision: recomputedScore.gateDecision ?? null,
    claimCandidate: recomputedScore.claimCandidate ?? null,
    production: freeze.g11r1?.production ?? null,
    scientificRootsMinted: freeze.g11r1?.scientificRootsMinted ?? null,
  }),
  result: Object.freeze({
    g12FinalAdjudication: pass ? "PASS" : "FAIL",
    r3ScientificStatus: pass ? "PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3" : "FAIL_R3",
    scientificCredit: pass ? "BOUNDED_R3_ONLY" : "ZERO",
  }),
  claimCeiling: "This establishes only bounded software causal dependency under the frozen R3 protocol: governed future software output causally depended on ordered retained three-entry history and discriminated the preregistered ablations, chronology/provenance forgeries, summary-only, direct-entry, pair-only, write-only and enumeration controls. It does not establish human autobiography, selfhood, identity, consciousness, subjective experience, human understanding, human memory, motivation, or general long-term agency.",
  immutableInputs: Object.freeze({
    preexecProvenanceCommitment: EXPECTED.preexecProvenanceCommitment,
    oneShotPlanCommitment: EXPECTED.oneShotPlanCommitment,
    scorerCommitment: EXPECTED.scorerCommitment,
    outcomeCommitment: freeze.outcomeCommitment,
    scoreCommitment: freeze.scoreCommitment,
    freezeCommitment: freeze.freezeCommitment,
  }),
  subjectImported: false,
  subjectExecuted: false,
  subjectCallsDuringG12: 0,
  production: false,
  scientificRootsMinted: 0,
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(adjudication, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

console.log(`G12_FINAL_ADJUDICATION=${adjudication.result.g12FinalAdjudication}`);
console.log(`R3_SCIENTIFIC_STATUS=${adjudication.result.r3ScientificStatus}`);
console.log(`G12_FAILED_CHECKS=${failedChecks.length}`);
console.log(`G12_OUTCOME_COUNT=${adjudication.observed.outcomeCount}`);
console.log(`G12_EXACT_MATCH_COUNT=${adjudication.observed.exactMatchCount}`);
console.log(`G12_MISMATCH_COUNT=${adjudication.observed.mismatchCount}`);
console.log(`G12_PRODUCTION=${adjudication.production}`);
console.log(`G12_SCIENTIFIC_ROOTS_MINTED=${adjudication.scientificRootsMinted}`);

if (!pass) process.exitCode = 1;
