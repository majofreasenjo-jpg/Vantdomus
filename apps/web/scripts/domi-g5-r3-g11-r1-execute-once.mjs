import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER,
  DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT,
  executeG5R3OneShot,
} from "../lib/domiG5AutobiographicalHistoryR3OneShotHarness.mjs";
import { DOMI_G5_R3_SCORER_COMMITMENT } from "../lib/domiG5AutobiographicalHistoryR3Scorer.mjs";
import {
  DOMI_G5_R3_PREEXEC_PROVENANCE_COMMITMENT,
  evaluateG5R3PreExecutionFirewall,
} from "../lib/domiG5AutobiographicalHistoryR3PreExecutionFirewall.mjs";

const ORIGINAL_ABORT_RUN_ID = 34853159719;
const ORIGINAL_ABORT_JOB_ID = 104005905809;
const ORIGINAL_ABORT_HEAD_SHA = "915572e16aa7644eb713a50f867b4d11db0ca8f3";
const SUPERSESSION_OWNER_STATEMENT = "AUTORIZO LA SUPERSESIÓN G11-R1: EJECUTAR EL HARNESS R3 CONGELADO DE 192 LLAMADAS EXACTAMENTE UNA VEZ, RECONOCIENDO QUE EL RUN 34853159719 ABORTÓ ANTES DE TODA LLAMADA AL SUJETO Y NO DEBE SER REEJECUTADO.";
const SUPERSESSION_MARKER = "G11_R1_OWNER_EXPLICIT_SUPERSESSION_AUTHORIZATION_R3";

const OUT_PATH = path.resolve(process.cwd(), "scientific/r3/G11_R1_ONE_SHOT_OUTCOME_FREEZE_2026_09_14.json");
const AUTH_RECEIPT_PATH = path.resolve(process.cwd(), "scientific/r3/G11_R1_OWNER_EXPLICIT_SUPERSESSION_AUTHORIZATION_R3_2026_09_14.txt");
const ABORT_RECEIPT_PATH = path.resolve(process.cwd(), "scientific/r3/G11_ATTEMPT1_PRE_SUBJECT_ABORT_RECEIPT_2026_09_14.txt");

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

if (fs.existsSync(OUT_PATH)) throw new Error("G11_R1_OUTCOME_FREEZE_ALREADY_EXISTS_REFUSE_REEXECUTION");
if (!fs.existsSync(AUTH_RECEIPT_PATH)) throw new Error("G11_R1_AUTHORIZATION_RECEIPT_MISSING");
if (!fs.existsSync(ABORT_RECEIPT_PATH)) throw new Error("G11_ATTEMPT1_ABORT_RECEIPT_MISSING");

const authReceipt = fs.readFileSync(AUTH_RECEIPT_PATH, "utf8");
const abortReceipt = fs.readFileSync(ABORT_RECEIPT_PATH, "utf8");
if (!authReceipt.includes(`OWNER_STATEMENT=${SUPERSESSION_OWNER_STATEMENT}`)) throw new Error("G11_R1_AUTHORIZATION_TEXT_MISMATCH");
if (!authReceipt.includes(`AUTHORIZATION_MARKER=${SUPERSESSION_MARKER}`)) throw new Error("G11_R1_AUTHORIZATION_MARKER_MISSING");
if (!abortReceipt.includes(`ORIGINAL_RUN_ID=${ORIGINAL_ABORT_RUN_ID}`)) throw new Error("G11_ATTEMPT1_ABORT_RUN_MISMATCH");
if (!abortReceipt.includes(`ORIGINAL_JOB_ID=${ORIGINAL_ABORT_JOB_ID}`)) throw new Error("G11_ATTEMPT1_ABORT_JOB_MISMATCH");
if (!abortReceipt.includes(`ORIGINAL_HEAD_SHA=${ORIGINAL_ABORT_HEAD_SHA}`)) throw new Error("G11_ATTEMPT1_ABORT_HEAD_MISMATCH");
if (!abortReceipt.includes("SUBJECT_CALLS=0")) throw new Error("G11_ATTEMPT1_ZERO_CALLS_NOT_CERTIFIED");
if (!abortReceipt.includes("HARNESS_FUNCTION_ENTERED=FALSE")) throw new Error("G11_ATTEMPT1_PRE_HARNESS_ABORT_NOT_CERTIFIED");

const preexec = evaluateG5R3PreExecutionFirewall();
if (preexec.status !== "PASS_PREEXEC_FIREWALL_G9" || preexec.pass !== true) {
  throw new Error(`G9_PREEXEC_FIREWALL_NOT_PASS:${preexec.status}`);
}
if (preexec.subjectCalls !== 0 || preexec.outcomesSeen !== false || preexec.executionAuthorized !== false) {
  throw new Error("PREEXEC_STATE_NOT_CLEAN");
}
if (preexec.production !== false || preexec.scientificRootsMinted !== 0) {
  throw new Error("PREEXEC_GOVERNANCE_BREACH");
}

const authorization = Object.freeze({
  ownerExplicit: true,
  marker: DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER,
  gate: "G10",
  r3: true,
});

const executedAt = new Date().toISOString();
const result = executeG5R3OneShot({ authorization });
if (result.executed !== true) throw new Error("G11_R1_DID_NOT_EXECUTE");
if (result.subjectCalls !== 192) throw new Error(`G11_R1_SUBJECT_CALL_COUNT_INVALID:${result.subjectCalls}`);
if (!Array.isArray(result.outcomes) || result.outcomes.length !== 192) throw new Error("G11_R1_OUTCOME_COUNT_INVALID");
if (!result.score || typeof result.score !== "object") throw new Error("G11_R1_SCORE_MISSING");

const outcomeCommitment = sha(result.outcomes);
const scoreCommitment = sha(result.score);
const freeze = Object.freeze({
  project: "VANTDOMUS_DOMI",
  gate: "G5_AUTOBIOGRAPHICAL_HISTORY_DEPENDENCE_R3",
  supersession: Object.freeze({
    version: "G11_R1",
    authorizationMarker: SUPERSESSION_MARKER,
    exactOwnerStatement: SUPERSESSION_OWNER_STATEMENT,
    originalRunId: ORIGINAL_ABORT_RUN_ID,
    originalJobId: ORIGINAL_ABORT_JOB_ID,
    originalHeadSha: ORIGINAL_ABORT_HEAD_SHA,
    originalFailureClass: "PRE_SUBJECT_STATIC_IMPORT_RESOLUTION_ABORT",
    originalSubjectCalls: 0,
    originalHarnessFunctionEntered: false,
    originalRunRerunForbidden: true,
  }),
  g11r1: Object.freeze({
    executionPolicy: "ONE_SHOT_NO_RETRY_NO_RESCUE",
    executedAt,
    executed: result.executed,
    subjectCalls: result.subjectCalls,
    outcomesGenerated: result.outcomesGenerated,
    executionConsumed: result.executionConsumed,
    production: result.production,
    scientificRootsMinted: result.scientificRootsMinted,
  }),
  provenance: Object.freeze({
    preexecProvenanceCommitment: DOMI_G5_R3_PREEXEC_PROVENANCE_COMMITMENT,
    oneShotPlanCommitment: DOMI_G5_R3_ONE_SHOT_PLAN_COMMITMENT,
    scorerCommitment: DOMI_G5_R3_SCORER_COMMITMENT,
  }),
  outcomes: result.outcomes,
  score: result.score,
  outcomeCommitment,
  scoreCommitment,
});
const freezeCommitment = sha(freeze);
const persisted = Object.freeze({ ...freeze, freezeCommitment });

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(persisted, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

console.log("G11_R1_SUPERSESSION_AUTHORIZATION=ACCEPTED");
console.log(`G11_R1_EXECUTED=${result.executed}`);
console.log(`G11_R1_SUBJECT_CALLS=${result.subjectCalls}`);
console.log(`G11_R1_OUTCOME_COUNT=${result.outcomes.length}`);
console.log(`G11_R1_SCORE_STATUS=${result.score.scoreStatus}`);
console.log(`G11_R1_GATE_DECISION=${result.score.gateDecision}`);
console.log(`G11_R1_EXACT_MATCH_COUNT=${result.score.exactMatchCount}`);
console.log(`G11_R1_MISMATCH_COUNT=${result.score.mismatchCount}`);
console.log(`G11_R1_PRODUCTION=${result.production}`);
console.log(`G11_R1_SCIENTIFIC_ROOTS_MINTED=${result.scientificRootsMinted}`);
console.log(`G11_R1_OUTCOME_COMMITMENT=${outcomeCommitment}`);
console.log(`G11_R1_SCORE_COMMITMENT=${scoreCommitment}`);
console.log(`G11_R1_FREEZE_COMMITMENT=${freezeCommitment}`);
