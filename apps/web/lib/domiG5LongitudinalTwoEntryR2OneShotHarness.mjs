import crypto from "node:crypto";
import { generateG5Fur2HeldoutPanel, DOMI_G5_FUR2_PANEL_COMMITMENT } from "./domiG5LongitudinalTwoEntryR2Heldout.mjs";
import { DOMI_G5_FUR2_EXPECTATION_MANIFEST } from "./domiG5LongitudinalTwoEntryR2Scorer.mjs";
import { solveG5LongitudinalTwoEntryR2 } from "./domiG5LongitudinalTwoEntryR2Subject.mjs";
import {
  G5_R2_OWNER_APPEND_ONLY_LEDGER,
  G5_R2_OWNER_LEDGER_STATE,
  G5_R2_OWNER_LONGITUDINAL_STATE,
  readG5R2FirstOwnerMemory,
  readG5SecondOwnerMemory,
} from "./domiG5OwnerLongitudinalStateR2.mjs";

export const DOMI_G5_FUR2_ONE_SHOT_HARNESS_VERSION = "DOMI_G5_FUR2_ONE_SHOT_HARNESS_V0_1";
export const DOMI_G5_FUR2_AUTHORIZATION_PHRASE = "AUTHORIZE_G5_FUR2_R2_HELDOUT_ONE_SHOT";
let executionStarted=false;

function h(v){return crypto.createHash("sha256").update(v,"utf8").digest("hex");}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map((k)=>[k,canonical(v[k])]));return v;}
function digest(v){return h(JSON.stringify(canonical(v)));}
function requireAuthorization(a){
  if(!a||typeof a!=="object"||Array.isArray(a))throw new Error("G5_FUR2_EXPLICIT_AUTHORIZATION_REQUIRED");
  if(a.authorizationPhrase!==DOMI_G5_FUR2_AUTHORIZATION_PHRASE||a.authorizeHeldoutExecution!==true||a.gate!=="G5_LONGITUDINAL_TWO_ENTRY_CAUSAL_DISCRIMINATION_R2"||a.production!==false||a.scientificNetworkProbes!==false)throw new Error("G5_FUR2_EXPLICIT_AUTHORIZATION_INVALID");
}
function first(){return readG5R2FirstOwnerMemory();}
function second(){return readG5SecondOwnerMemory();}
function both(){return [first(),second()];}
function reverse(){return [second(),first()];}
function forged(memory){return Object.freeze({...memory,entryFingerprint:"0".repeat(64)});}
function providerFor(row,challenge){
  if(row.control==="ENUM_REVERSED")return reverse;
  if(row.control==="ABLATE_REQUIRED"){
    if(challenge.targetClass==="OLDER_ONLY"||challenge.targetClass==="NEWER_ONLY")return ()=>[];
    if(row.ablationTarget==="OLDER")return ()=>[second()];
    return ()=>[first()];
  }
  if(challenge.targetClass==="PROVENANCE_CONTROL"){
    if(challenge.provenanceTarget==="OLDER")return ()=>[forged(first())];
    if(challenge.provenanceTarget==="NEWER")return ()=>[forged(second())];
    return ()=>[forged(first()),second()];
  }
  if(challenge.targetClass==="OLDER_ONLY")return ()=>[first()];
  if(challenge.targetClass==="NEWER_ONLY")return ()=>[second()];
  return both;
}
function custody(){
  return Object.freeze({entryCount:G5_R2_OWNER_APPEND_ONLY_LEDGER.entryCount,ledgerFingerprint:G5_R2_OWNER_LEDGER_STATE.ledgerFingerprint,headRecordFingerprint:G5_R2_OWNER_LEDGER_STATE.headRecordFingerprint,appendOnly:G5_R2_OWNER_LEDGER_STATE.appendOnly,overwriteAllowed:G5_R2_OWNER_LEDGER_STATE.overwriteAllowed,realOwnerMemoryEntryCount:G5_R2_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,scientificRootsMinted:G5_R2_OWNER_LONGITUDINAL_STATE.scientificRootsMinted,production:false,g5E0003Present:G5_R2_OWNER_APPEND_ONLY_LEDGER.records.some((r)=>r?.entry?.entryId==="G5-E-0003-REAL")});
}
function requireCustody(){const c=custody();if(c.entryCount!==2||c.realOwnerMemoryEntryCount!==2||c.appendOnly!==true||c.overwriteAllowed!==false||c.scientificRootsMinted!==0||c.production!==false||c.g5E0003Present!==false)throw new Error("G5_FUR2_PRE_EXECUTION_CUSTODY_HOLD");return c;}
function exact(o,e){return o.disposition===e.disposition&&o.action===e.action&&o.memoryReadCount===e.memoryReadCount&&o.memoryEntryCountSeen===e.memoryEntryCountSeen&&o.contentEchoed===e.contentEchoed&&o.scientificRootsMinted===e.scientificRootsMinted&&o.production===e.production;}

export function prepareG5Fur2OneShotExecutionPlan(){
  const panel=generateG5Fur2HeldoutPanel();
  const manifest=DOMI_G5_FUR2_EXPECTATION_MANIFEST;
  if(panel.length!==128||manifest.totalExpectedSubjectCalls!==240)throw new Error("G5_FUR2_PLAN_GEOMETRY_HOLD");
  const rows=manifest.rows.map((row)=>Object.freeze({index:row.index,challengeId:row.challengeId,targetClass:row.targetClass,control:row.control,ablationTarget:row.ablationTarget}));
  return Object.freeze({harnessVersion:DOMI_G5_FUR2_ONE_SHOT_HARNESS_VERSION,state:"PREPARED_NOT_EXECUTED",panelSize:128,panelCommitment:DOMI_G5_FUR2_PANEL_COMMITMENT,totalSubjectCalls:240,principalCalls:128,ablationCalls:96,enumerationReverseCalls:16,expectationManifestDigest:manifest.expectationManifestDigest,planCommitmentDigest:digest(rows),executionCountIfAuthorized:1,explicitAuthorizationRequired:true,subjectExecuted:false,heldoutOutcomeInspected:false,outcomeProduced:false,production:false,scientificRootsMinted:0});
}

export function executeG5Fur2OneShot({authorization}={}){
  requireAuthorization(authorization);
  if(executionStarted)throw new Error("G5_FUR2_ONE_SHOT_ALREADY_STARTED_NO_RETRY");
  const plan=prepareG5Fur2OneShotExecutionPlan();
  const pre=requireCustody();
  executionStarted=true;
  const panel=generateG5Fur2HeldoutPanel();
  const outcomes=[];
  let passCount=0;
  for(const row of DOMI_G5_FUR2_EXPECTATION_MANIFEST.rows){
    const challenge=panel[row.index];
    const outcome=solveG5LongitudinalTwoEntryR2({challenge,memoryProvider:providerFor(row,challenge)});
    const pass=exact(outcome,row.expectation);
    if(pass)passCount+=1;
    outcomes.push(Object.freeze({index:row.index,challengeId:row.challengeId,control:row.control,pass,outcome}));
  }
  const post=requireCustody();
  const ledgerUnchanged=pre.ledgerFingerprint===post.ledgerFingerprint&&pre.headRecordFingerprint===post.headRecordFingerprint&&pre.entryCount===post.entryCount;
  return Object.freeze({harnessVersion:DOMI_G5_FUR2_ONE_SHOT_HARNESS_VERSION,executionState:"CONSUMED_ONE_SHOT",planCommitmentDigest:plan.planCommitmentDigest,outcomeMatrixDigest:digest(outcomes),totalSubjectCalls:240,passCount,allExpectedOutcomesPass:passCount===240,ledgerUnchanged,realOwnerMemoryEntryCountAfter:post.realOwnerMemoryEntryCount,g5E0003Absent:post.g5E0003Present===false,productionMutation:false,scientificRootsMinted:0,aggregateOnly:true,perCaseOutcomesReturned:false,ownerMemoryContentReturned:false});
}

export function describeG5Fur2OneShotHarnessFreeze(){return Object.freeze({version:DOMI_G5_FUR2_ONE_SHOT_HARNESS_VERSION,purpose:"ONE_SHOT_R2_HELDOUT_EXECUTION_HARNESS_FROZEN_PRE_EXECUTION",panelSize:128,totalSubjectCalls:240,executionCount:1,authorizationPhraseFrozen:true,explicitAuthorizationRequired:true,oneShotLatch:"PROCESS_LOCAL_SET_BEFORE_FIRST_SUBJECT_CALL",samePanelRetry:"FORBIDDEN_AFTER_START",challengeRegenerationAfterOutcome:"FORBIDDEN",scorerRewriteAfterOutcome:"FORBIDDEN",entryAdmissionForRescue:"FORBIDDEN",aggregateReturnOnly:true,executionStarted,heldoutSubjectExecutedByDescriptor:false,subjectOutcomeInspectedByDescriptor:false,outcomeProducedByDescriptor:false,production:false,scientificRootsMinted:0});}
