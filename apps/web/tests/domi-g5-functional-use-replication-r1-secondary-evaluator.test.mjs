import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION,
  DOMI_G5_FUR1_SECONDARY_ACTION_SPACE,
  DOMI_G5_FUR1_SECONDARY_ARMS,
  deriveG5Fur1SecondaryExpectedAction,
  deriveG5Fur1SecondaryArmExpectation,
  describeG5Fur1SecondaryEvaluatorFreeze,
} from "../lib/domiG5FunctionalUseReplicationR1SecondaryEvaluator.mjs";

const canonicalMemoryFixture = Object.freeze({
  entryId: "G5-E-0001-REAL",
  entryFingerprint: "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4",
  content: "Debes recordar que todo esfuerzo siempre será bien recompensado",
  prospective: true,
  appendOnly: true,
  overwriteAllowed: false,
  realOwnerMemoryEntryCount: 1,
  scientificRootsMinted: 0,
});

const independentHeldoutAnchors = Object.freeze([
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-de3f0bc95f963d8b2cc238f1",
      selector: 10,
      nonce: "3c79e7dcba435c6a0cbd71ea33b2c4ba",
    }),
    expectedAction: "ACTION_2",
  }),
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-f0cdd4e0d12c12fc3e2a4f14",
      selector: 4,
      nonce: "b1c84e8ad89161e22ebbfeeb56a5cf2a",
    }),
    expectedAction: "ACTION_E",
  }),
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-9c00143c6b28200019758a30",
      selector: 3,
      nonce: "e2bc2f9c70c6a9a81eba54d37bd5ca79",
    }),
    expectedAction: "ACTION_C",
  }),
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-0c680bbf7e5fda4cac52060f",
      selector: 15,
      nonce: "52695980ba6fe9674050252cfc660559",
    }),
    expectedAction: "ACTION_C",
  }),
]);

test("R1 secondary evaluator freeze descriptor is exact and non-executing", () => {
  const freeze = describeG5Fur1SecondaryEvaluatorFreeze();
  assert.equal(freeze.version, "DOMI_G5_FUR1_SECONDARY_EVALUATOR_V0_1");
  assert.equal(freeze.evaluator, "SECONDARY");
  assert.equal(freeze.implementationStrategy, "ITERATIVE_MIN_SELECTION_PLUS_BIGINT_MOD16");
  assert.equal(freeze.actionCount, 16);
  assert.deepEqual(freeze.arms, DOMI_G5_FUR1_SECONDARY_ARMS);
  assert.equal(freeze.primaryEvaluatorImported, false);
  assert.equal(freeze.subjectImported, false);
  assert.equal(freeze.heldoutGeneratorImported, false);
  assert.equal(freeze.parentScorerImported, false);
  assert.equal(freeze.governedMemoryReaderImported, false);
  assert.equal(freeze.governedMemoryReadPerformedByDescriptor, false);
  assert.equal(freeze.subjectExecuted, false);
  assert.equal(freeze.outcomeProduced, false);
  assert.equal(freeze.scientificRootsMinted, 0);
  assert.equal(freeze.production, false);
});

test("R1 secondary evaluator matches four independently frozen heldout anchors", () => {
  for (const anchor of independentHeldoutAnchors) {
    const result = deriveG5Fur1SecondaryExpectedAction({
      challenge: anchor.challenge,
      canonicalMemory: canonicalMemoryFixture,
    });
    assert.equal(result.evaluatorVersion, DOMI_G5_FUR1_SECONDARY_EVALUATOR_VERSION);
    assert.equal(result.expectedAction, anchor.expectedAction);
    assert.equal(result.expectedDisposition, "ACTION_SELECTED_FROM_GOVERNED_MEMORY_R1");
    assert.equal(result.expectedMemoryReadCount, 1);
    assert.equal(result.expectedContentEchoed, false);
    assert.equal(result.scientificRootsMinted, 0);
    assert.equal(result.production, false);
  }
});

test("R1 secondary evaluator is deterministic and returns only the frozen 16-action alphabet", () => {
  for (const anchor of independentHeldoutAnchors) {
    const first = deriveG5Fur1SecondaryExpectedAction({ challenge: anchor.challenge, canonicalMemory: canonicalMemoryFixture });
    const second = deriveG5Fur1SecondaryExpectedAction({ challenge: anchor.challenge, canonicalMemory: canonicalMemoryFixture });
    assert.deepEqual(first, second);
    assert.ok(DOMI_G5_FUR1_SECONDARY_ACTION_SPACE.includes(first.expectedAction));
  }
});

test("R1 secondary evaluator freezes B and C fail-closed expectations without any provider call", () => {
  const challenge = independentHeldoutAnchors[0].challenge;
  const b = deriveG5Fur1SecondaryArmExpectation({ arm: "B_MEMORY_ABLATED", challenge });
  const c = deriveG5Fur1SecondaryArmExpectation({ arm: "C_UNGOVERNED_MATCHED_CONTROL", challenge });
  assert.equal(b.expectedDisposition, "HOLD_MEMORY_UNAVAILABLE");
  assert.equal(b.expectedAction, null);
  assert.equal(c.expectedDisposition, "HOLD_UNGOVERNED_MEMORY");
  assert.equal(c.expectedAction, null);
  assert.equal(b.expectedMemoryReadCount, 1);
  assert.equal(c.expectedMemoryReadCount, 1);
});

test("R1 secondary evaluator freezes A and D to identical canonical expectations", () => {
  for (const anchor of independentHeldoutAnchors) {
    const a = deriveG5Fur1SecondaryArmExpectation({
      arm: "A_MEMORY_AVAILABLE",
      challenge: anchor.challenge,
      canonicalMemory: canonicalMemoryFixture,
    });
    const d = deriveG5Fur1SecondaryArmExpectation({
      arm: "D_RENDERING_PERTURBATION",
      challenge: { ...anchor.challenge, cosmeticEnvelope: "ignored-by-secondary-reference" },
      canonicalMemory: canonicalMemoryFixture,
    });
    assert.equal(a.expectedAction, anchor.expectedAction);
    assert.equal(d.expectedAction, a.expectedAction);
  }
});

test("R1 secondary evaluator fails closed on malformed challenge geometry", () => {
  assert.throws(
    () => deriveG5Fur1SecondaryExpectedAction({
      challenge: { ...independentHeldoutAnchors[0].challenge, selector: -1 },
      canonicalMemory: canonicalMemoryFixture,
    }),
    /G5_FUR1_SECONDARY_SELECTOR_INVALID/,
  );
  assert.throws(
    () => deriveG5Fur1SecondaryExpectedAction({
      challenge: { ...independentHeldoutAnchors[0].challenge, challengeId: "G5-FUR1-C-short" },
      canonicalMemory: canonicalMemoryFixture,
    }),
    /G5_FUR1_SECONDARY_CHALLENGE_ID_INVALID/,
  );
});

test("R1 secondary evaluator rejects noncanonical governance or scientific promotion", () => {
  assert.throws(
    () => deriveG5Fur1SecondaryExpectedAction({
      challenge: independentHeldoutAnchors[0].challenge,
      canonicalMemory: { ...canonicalMemoryFixture, appendOnly: false },
    }),
    /G5_FUR1_SECONDARY_MEMORY_GOVERNANCE_INVALID/,
  );
  assert.throws(
    () => deriveG5Fur1SecondaryExpectedAction({
      challenge: independentHeldoutAnchors[0].challenge,
      canonicalMemory: { ...canonicalMemoryFixture, scientificRootsMinted: 1 },
    }),
    /G5_FUR1_SECONDARY_SCIENTIFIC_ROOT_INVALID/,
  );
});

test("R1 secondary evaluator source is isolated from primary, subject, generator, ledger reader, and parent scorer", () => {
  const evaluatorUrl = new URL("../lib/domiG5FunctionalUseReplicationR1SecondaryEvaluator.mjs", import.meta.url);
  const source = readFileSync(fileURLToPath(evaluatorUrl), "utf8");
  const imports = [...source.matchAll(/^import\s+.*$/gm)].map((match) => match[0]);
  assert.deepEqual(imports, ['import crypto from "node:crypto";']);
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1PrimaryEvaluator"), false);
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1Subject"), false);
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1Heldout"), false);
  assert.equal(source.includes("readG5FirstOwnerMemory"), false);
  assert.equal(source.includes("domiG5OwnerLongitudinalSeed"), false);
  assert.equal(source.includes("MemoryFunctionalUseHeldout"), false);
});
