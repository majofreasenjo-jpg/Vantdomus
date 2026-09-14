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
  DOMI_G5_R3_PREEXEC_MANIFEST_COMMITMENT,
  evaluateG5R3PreexecFirewall,
} from "../lib/domiG5AutobiographicalHistoryR3PreexecFirewall.mjs";

const OUT_PATH = path.resolve(process.cwd(), "scientific/r3/G11_ONE_SHOT_OUTCOME_FREEZE_2026_09_14.json");
const AUTH_RECEIPT_PATH = path.resolve(process.cwd(), "scientific/r3/G10_OWNER_EXPLICIT_EXECUTION_AUTHORIZATION_R3_2026_09_14.txt");

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

if (fs.existsSync(OUT_PATH)) throw new Error("G11_OUTCOME_FREEZE_ALREADY_EXISTS_REFUSE_REEXECUTION");
if (!fs.existsSync(AUTH_RECEIPT_PATH)) throw new Error("G10_AUTHORIZATION_RECEIPT_MISSING");
const authReceipt = fs.readFileSync(AUTH_RECEIPT_PATH, "utf8");
if (!authReceipt.includes("AUTORIZO G10: EJECUTAR G11 R3 EXACTAMENTE UNA VEZ CON EL HARNESS CONGELADO DE 192 LLAMADAS.")) {
  throw new Error("G10_AUTHORIZATION_TEXT_MISMATCH");
}
if (!authReceipt.includes(`AUTHORIZATION_MARKER=${DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER}`)) {
  throw new Error("G10_AUTHORIZATION_MARKER_MISSING");
}

const preexec = evaluateG5R3PreexecFirewall();
if (preexec.gateDecision !== "PASS_G9_PREEXEC_FIREWALL") {
  throw new Error(`G9_PREEXEC_FIREWALL_NOT_PASS:${preexec.gateDecision}`);
}
if (preexec.subjectCalls !== 0 || preexec.outcomesSeen !== false || preexec.executionAuthorized !== false) {
  throw new Error("PREEXEC_STATE_NOT_CLEAN");
}

const authorization = Object.freeze({
  ownerExplicit: true,
  marker: DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER,
  gate: "G10",
  r3: true,
});

const executedAt = new Date().toISOString();
const result = executeG5R3OneShot({ authorization });
if (result.executed !== true) throw new Error("G11_DID_NOT_EXECUTE");
if (result.subjectCalls !== 192) throw new Error(`G11_SUBJECT_CALL_COUNT_INVALID:${result.subjectCalls}`);
if (!Array.isArray(result.outcomes) || result.outcomes.length !== 192) throw new Error("G11_OUTCOME_COUNT_INVALID");
if (!result.score || typeof result.score !== "object") throw new Error("G11_SCORE_MISSING");

const outcomeCommitment = sha(result.outcomes);
const scoreCommitment = sha(result.score);
const freeze = Object.freeze({
  project: "VANTDOMUS_DOMI",
  gate: "G5_AUTOBIOGRAPHICAL_HISTORY_DEPENDENCE_R3",
  g10: Object.freeze({
    authorized: true,
    marker: DOMI_G5_R3_EXECUTION_AUTHORIZATION_MARKER,
    exactOwnerStatement: "AUTORIZO G10: EJECUTAR G11 R3 EXACTAMENTE UNA VEZ CON EL HARNESS CONGELADO DE 192 LLAMADAS.",
  }),
  g11: Object.freeze({
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
    preexecManifestCommitment: DOMI_G5_R3_PREEXEC_MANIFEST_COMMITMENT,
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

console.log(`G10_AUTHORIZATION=ACCEPTED`);
console.log(`G11_EXECUTED=${result.executed}`);
console.log(`G11_SUBJECT_CALLS=${result.subjectCalls}`);
console.log(`G11_OUTCOME_COUNT=${result.outcomes.length}`);
console.log(`G11_SCORE_STATUS=${result.score.scoreStatus}`);
console.log(`G11_GATE_DECISION=${result.score.gateDecision}`);
console.log(`G11_EXACT_MATCH_COUNT=${result.score.exactMatchCount}`);
console.log(`G11_MISMATCH_COUNT=${result.score.mismatchCount}`);
console.log(`G11_OUTCOME_COMMITMENT=${outcomeCommitment}`);
console.log(`G11_SCORE_COMMITMENT=${scoreCommitment}`);
console.log(`G11_FREEZE_COMMITMENT=${freezeCommitment}`);
