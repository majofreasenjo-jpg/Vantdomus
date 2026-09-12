import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_FUR2_PANEL_SIZE,
  DOMI_G5_FUR2_PANEL_COMMITMENT,
  generateG5Fur2HeldoutPanel,
} from "../lib/domiG5LongitudinalTwoEntryR2Heldout.mjs";
import {
  deriveG5Fur2PrimaryExpectation,
  describeG5Fur2PrimaryEvaluatorFreeze,
} from "../lib/domiG5LongitudinalTwoEntryR2PrimaryEvaluator.mjs";
import {
  deriveG5Fur2SecondaryExpectation,
  describeG5Fur2SecondaryEvaluatorFreeze,
} from "../lib/domiG5LongitudinalTwoEntryR2SecondaryEvaluator.mjs";
import {
  DOMI_G5_FUR2_EXPECTATION_MANIFEST,
  describeG5Fur2ScorerFreeze,
} from "../lib/domiG5LongitudinalTwoEntryR2Scorer.mjs";
import {
  prepareG5Fur2OneShotExecutionPlan,
  describeG5Fur2OneShotHarnessFreeze,
} from "../lib/domiG5LongitudinalTwoEntryR2OneShotHarness.mjs";

test("primary and secondary evaluator freeze descriptors remain outcome-free", () => {
  const p=describeG5Fur2PrimaryEvaluatorFreeze();
  const s=describeG5Fur2SecondaryEvaluatorFreeze();
  assert.equal(p.subjectImported,false);
  assert.equal(p.heldoutOutcomeInspected,false);
  assert.equal(s.primaryEvaluatorImported,false);
  assert.equal(s.subjectImported,false);
  assert.equal(s.heldoutOutcomeInspected,false);
  assert.equal(p.production,false);
  assert.equal(s.production,false);
});

test("primary-secondary principal expectations agree 128/128", () => {
  const panel=generateG5Fur2HeldoutPanel();
  assert.equal(panel.length,DOMI_G5_FUR2_PANEL_SIZE);
  let agreements=0;
  for(const challenge of panel){
    const a=deriveG5Fur2PrimaryExpectation({challenge});
    const b=deriveG5Fur2SecondaryExpectation({challenge});
    assert.equal(a.expectedDisposition,b.expectedDisposition);
    assert.equal(a.expectedAction,b.expectedAction);
    assert.equal(a.expectedMemoryReadCount,b.expectedMemoryReadCount);
    assert.equal(a.expectedMemoryEntryCountSeen,b.expectedMemoryEntryCountSeen);
    agreements+=1;
  }
  assert.equal(agreements,128);
});

test("negative and invariance control expectations agree", () => {
  const panel=generateG5Fur2HeldoutPanel();
  let ablations=0, reversed=0;
  for(const challenge of panel){
    if(["OLDER_ONLY","NEWER_ONLY"].includes(challenge.targetClass)){
      const a=deriveG5Fur2PrimaryExpectation({challenge,control:"ABLATE_REQUIRED"});
      const b=deriveG5Fur2SecondaryExpectation({challenge,control:"ABLATE_REQUIRED"});
      assert.equal(a.expectedDisposition,b.expectedDisposition);
      assert.equal(a.expectedAction,b.expectedAction);
      ablations+=1;
    }
    if(challenge.targetClass==="ORDERED_PAIR"){
      for(const target of ["OLDER","NEWER"]){
        const a=deriveG5Fur2PrimaryExpectation({challenge,control:"ABLATE_REQUIRED",ablationTarget:target});
        const b=deriveG5Fur2SecondaryExpectation({challenge,control:"ABLATE_REQUIRED",ablationTarget:target});
        assert.equal(a.expectedDisposition,"HOLD_MEMORY_INCOMPLETE");
        assert.equal(a.expectedDisposition,b.expectedDisposition);
      }
      ablations+=1;
    }
    if(challenge.targetClass==="ENUMERATION_ORDER_INVARIANCE"){
      const a=deriveG5Fur2PrimaryExpectation({challenge,control:"ENUM_REVERSED"});
      const b=deriveG5Fur2SecondaryExpectation({challenge,control:"ENUM_REVERSED"});
      assert.equal(a.expectedAction,b.expectedAction);
      reversed+=1;
    }
  }
  assert.equal(ablations,96);
  assert.equal(reversed,16);
});

test("scorer freezes exact 240-call expectation geometry", () => {
  const d=describeG5Fur2ScorerFreeze();
  assert.equal(d.panelSize,128);
  assert.equal(d.panelCommitment,DOMI_G5_FUR2_PANEL_COMMITMENT);
  assert.equal(DOMI_G5_FUR2_EXPECTATION_MANIFEST.principalCount,128);
  assert.equal(DOMI_G5_FUR2_EXPECTATION_MANIFEST.ablationCount,96);
  assert.equal(DOMI_G5_FUR2_EXPECTATION_MANIFEST.enumerationReverseCount,16);
  assert.equal(DOMI_G5_FUR2_EXPECTATION_MANIFEST.totalExpectedSubjectCalls,240);
  assert.match(DOMI_G5_FUR2_EXPECTATION_MANIFEST.expectationManifestDigest,/^[0-9a-f]{64}$/);
  assert.equal(d.heldoutOutcomeInspectedByDescriptor,false);
});

test("one-shot plan is frozen but does not execute subject", () => {
  const plan=prepareG5Fur2OneShotExecutionPlan();
  const d=describeG5Fur2OneShotHarnessFreeze();
  assert.equal(plan.state,"PREPARED_NOT_EXECUTED");
  assert.equal(plan.totalSubjectCalls,240);
  assert.equal(plan.subjectExecuted,false);
  assert.equal(plan.heldoutOutcomeInspected,false);
  assert.equal(plan.outcomeProduced,false);
  assert.match(plan.planCommitmentDigest,/^[0-9a-f]{64}$/);
  assert.equal(d.executionStarted,false);
  assert.equal(d.heldoutSubjectExecutedByDescriptor,false);
  assert.equal(d.subjectOutcomeInspectedByDescriptor,false);
  assert.equal(d.production,false);
  assert.equal(d.scientificRootsMinted,0);
});

test("provenance controls are frozen to fail closed", () => {
  const panel=generateG5Fur2HeldoutPanel().filter((c)=>c.targetClass==="PROVENANCE_CONTROL");
  assert.equal(panel.length,16);
  for(const challenge of panel){
    const p=deriveG5Fur2PrimaryExpectation({challenge});
    const s=deriveG5Fur2SecondaryExpectation({challenge});
    assert.equal(p.expectedDisposition,"HOLD_UNGOVERNED_MEMORY");
    assert.equal(p.expectedAction,null);
    assert.equal(p.expectedDisposition,s.expectedDisposition);
  }
});
