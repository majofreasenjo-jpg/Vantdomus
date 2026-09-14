import crypto from "node:crypto";
import {
  DOMI_G5_FUR2_PANEL_SIZE,
  DOMI_G5_FUR2_PANEL_COMMITMENT,
  generateG5Fur2HeldoutPanel,
} from "./domiG5LongitudinalTwoEntryR2Heldout.mjs";
import { deriveG5Fur2PrimaryExpectation } from "./domiG5LongitudinalTwoEntryR2PrimaryEvaluator.mjs";
import { deriveG5Fur2SecondaryExpectation } from "./domiG5LongitudinalTwoEntryR2SecondaryEvaluator.mjs";

export const DOMI_G5_FUR2_SCORER_VERSION = "DOMI_G5_FUR2_SCORER_V0_1";
export const DOMI_G5_FUR2_SCORER_MODE = "R2_HELDOUT_ADJUDICATION";

function sha256(value) { return crypto.createHash("sha256").update(value,"utf8").digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k)=>[k,canonical(value[k])]));
  return value;
}
function same(a,b) {
  return a.expectedDisposition===b.expectedDisposition && a.expectedAction===b.expectedAction && a.expectedMemoryReadCount===b.expectedMemoryReadCount && a.expectedMemoryEntryCountSeen===b.expectedMemoryEntryCountSeen && a.expectedContentEchoed===b.expectedContentEchoed && a.scientificRootsMinted===b.scientificRootsMinted && a.production===b.production;
}
function pairAblationTarget(challenge) {
  const nibble = Number.parseInt(sha256(`DOMI_G5_FUR2_PAIR_ABLATION_TARGET_V1|${challenge.challengeId}`).slice(0,2),16);
  return nibble % 2 === 0 ? "OLDER" : "NEWER";
}
function expectationPair(challenge, control="PRINCIPAL", ablationTarget=null) {
  const primary=deriveG5Fur2PrimaryExpectation({challenge,control,ablationTarget});
  const secondary=deriveG5Fur2SecondaryExpectation({challenge,control,ablationTarget});
  if (!same(primary,secondary)) throw new Error(`G5_FUR2_EVALUATOR_DISAGREEMENT:${challenge.challengeId}:${control}`);
  return Object.freeze({primary,secondary});
}
export function buildG5Fur2FrozenExpectationManifest() {
  const panel=generateG5Fur2HeldoutPanel();
  if (panel.length!==DOMI_G5_FUR2_PANEL_SIZE) throw new Error("G5_FUR2_SCORER_PANEL_SIZE_INVALID");
  const rows=[];
  let principal=0, ablation=0, reverse=0;
  for (let index=0;index<panel.length;index+=1) {
    const challenge=panel[index];
    const p=expectationPair(challenge);
    rows.push(Object.freeze({index,challengeId:challenge.challengeId,targetClass:challenge.targetClass,control:"PRINCIPAL",ablationTarget:null,expectation:Object.freeze({disposition:p.primary.expectedDisposition,action:p.primary.expectedAction,memoryReadCount:p.primary.expectedMemoryReadCount,memoryEntryCountSeen:p.primary.expectedMemoryEntryCountSeen,contentEchoed:p.primary.expectedContentEchoed,scientificRootsMinted:0,production:false})}));
    principal+=1;
    if (["OLDER_ONLY","NEWER_ONLY","ORDERED_PAIR"].includes(challenge.targetClass)) {
      const target=challenge.targetClass==="ORDERED_PAIR"?pairAblationTarget(challenge):null;
      const e=expectationPair(challenge,"ABLATE_REQUIRED",target);
      rows.push(Object.freeze({index,challengeId:challenge.challengeId,targetClass:challenge.targetClass,control:"ABLATE_REQUIRED",ablationTarget:target,expectation:Object.freeze({disposition:e.primary.expectedDisposition,action:e.primary.expectedAction,memoryReadCount:e.primary.expectedMemoryReadCount,memoryEntryCountSeen:e.primary.expectedMemoryEntryCountSeen,contentEchoed:e.primary.expectedContentEchoed,scientificRootsMinted:0,production:false})}));
      ablation+=1;
    }
    if (challenge.targetClass==="ENUMERATION_ORDER_INVARIANCE") {
      const e=expectationPair(challenge,"ENUM_REVERSED");
      rows.push(Object.freeze({index,challengeId:challenge.challengeId,targetClass:challenge.targetClass,control:"ENUM_REVERSED",ablationTarget:null,expectation:Object.freeze({disposition:e.primary.expectedDisposition,action:e.primary.expectedAction,memoryReadCount:e.primary.expectedMemoryReadCount,memoryEntryCountSeen:e.primary.expectedMemoryEntryCountSeen,contentEchoed:e.primary.expectedContentEchoed,scientificRootsMinted:0,production:false})}));
      reverse+=1;
    }
  }
  const digest=sha256(JSON.stringify(canonical(rows)));
  return Object.freeze({rows:Object.freeze(rows),principalCount:principal,ablationCount:ablation,enumerationReverseCount:reverse,totalExpectedSubjectCalls:rows.length,expectationManifestDigest:digest});
}

export const DOMI_G5_FUR2_EXPECTATION_MANIFEST = buildG5Fur2FrozenExpectationManifest();

export function describeG5Fur2ScorerFreeze() {
  return Object.freeze({
    version:DOMI_G5_FUR2_SCORER_VERSION,
    mode:DOMI_G5_FUR2_SCORER_MODE,
    panelSize:DOMI_G5_FUR2_PANEL_SIZE,
    panelCommitment:DOMI_G5_FUR2_PANEL_COMMITMENT,
    primarySecondaryPrincipalAgreementRequired:"128/128",
    expectedPrincipalCalls:128,
    expectedAblationCalls:96,
    expectedEnumerationReverseCalls:16,
    expectedTotalSubjectCalls:240,
    success:Object.freeze({olderOnlyExact:32,newerOnlyExact:32,orderedPairExact:32,requiredAblationHolds:96,provenanceControlsFailClosed:16,enumerationOrderInvariance:16,primarySecondaryExpectationAgreement:128,ledgerEntryCountAfter:2,g5E0003Absent:true,contentEchoed:false,productionMutation:false,scientificRootsMinted:0}),
    expectationManifestDigest:DOMI_G5_FUR2_EXPECTATION_MANIFEST.expectationManifestDigest,
    subjectImported:false,
    outcomeInputAcceptedAtFreeze:false,
    heldoutSubjectExecutedByDescriptor:false,
    heldoutOutcomeInspectedByDescriptor:false,
    production:false,
    scientificRootsMinted:0,
  });
}
