import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION,
  DOMI_G5_FUR1_PRIMARY_ACTION_SPACE,
  DOMI_G5_FUR1_PRIMARY_ARMS,
  deriveG5Fur1PrimaryExpectedAction,
  deriveG5Fur1PrimaryArmExpectation,
  describeG5Fur1PrimaryEvaluatorFreeze,
} from "../lib/domiG5FunctionalUseReplicationR1PrimaryEvaluator.mjs";

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

const independentAnchors = Object.freeze([
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-0123456789abcdef01234567",
      selector: 7,
      nonce: "0123456789abcdef0123456789abcdef",
    }),
    expectedAction: "ACTION_0",
  }),
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-fedcba9876543210fedcba98",
      selector: 0,
      nonce: "ffffffffffffffffffffffffffffffff",
    }),
    expectedAction: "ACTION_2",
  }),
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-aaaaaaaaaaaaaaaaaaaaaaaa",
      selector: 15,
      nonce: "00000000000000000000000000000000",
    }),
    expectedAction: "ACTION_9",
  }),
  Object.freeze({
    challenge: Object.freeze({
      challengeId: "G5-FUR1-C-bbbbbbbbbbbbbbbbbbbbbbbb",
      selector: 3,
      nonce: "1234567890abcdef1234567890abcdef",
    }),
    expectedAction: "ACTION_C",
  }),
]);

test("R1 primary evaluator freeze descriptor is exact and non-executing", () => {
  const freeze = describeG5Fur1PrimaryEvaluatorFreeze();
  assert.equal(freeze.version, "DOMI_G5_FUR1_PRIMARY_EVALUATOR_V0_1");
  assert.equal(freeze.evaluator, "PRIMARY");
  assert.equal(freeze.actionCount, 16);
  assert.deepEqual(freeze.arms, DOMI_G5_FUR1_PRIMARY_ARMS);
  assert.equal(freeze.subjectImported, false);
  assert.equal(freeze.parentScorerImported, false);
  assert.equal(freeze.heldoutGeneratorImported, false);
  assert.equal(freeze.governedMemoryReadPerformedByDescriptor, false);
  assert.equal(freeze.subjectExecuted, false);
  assert.equal(freeze.outcomeProduced, false);
  assert.equal(freeze.scientificRootsMinted, 0);
  assert.equal(freeze.production, false);
});

test("R1 primary evaluator matches four independently precomputed cryptographic anchors", () => {
  for (const anchor of independentAnchors) {
    const result = deriveG5Fur1PrimaryExpectedAction({
      challenge: anchor.challenge,
      canonicalMemory: canonicalMemoryFixture,
    });
    assert.equal(result.evaluatorVersion, DOMI_G5_FUR1_PRIMARY_EVALUATOR_VERSION);
    assert.equal(result.expectedAction, anchor.expectedAction);
    assert.equal(result.expectedDisposition, "ACTION_SELECTED_FROM_GOVERNED_MEMORY_R1");
    assert.equal(result.expectedMemoryReadCount, 1);
    assert.equal(result.expectedContentEchoed, false);
    assert.equal(result.scientificRootsMinted, 0);
    assert.equal(result.production, false);
  }
});

test("R1 primary evaluator determinism is stable across repeated evaluation", () => {
  for (const anchor of independentAnchors) {
    const first = deriveG5Fur1PrimaryExpectedAction({ challenge: anchor.challenge, canonicalMemory: canonicalMemoryFixture });
    const second = deriveG5Fur1PrimaryExpectedAction({ challenge: anchor.challenge, canonicalMemory: canonicalMemoryFixture });
    assert.deepEqual(first, second);
    assert.ok(DOMI_G5_FUR1_PRIMARY_ACTION_SPACE.includes(first.expectedAction));
  }
});

test("R1 primary evaluator freezes B and C fail-closed expectations without calling any provider", () => {
  const challenge = independentAnchors[0].challenge;
  const b = deriveG5Fur1PrimaryArmExpectation({ arm: "B_MEMORY_ABLATED", challenge });
  const c = deriveG5Fur1PrimaryArmExpectation({ arm: "C_UNGOVERNED_MATCHED_CONTROL", challenge });
  assert.equal(b.expectedDisposition, "HOLD_MEMORY_UNAVAILABLE");
  assert.equal(b.expectedAction, null);
  assert.equal(b.expectedMemoryReadCount, 1);
  assert.equal(c.expectedDisposition, "HOLD_UNGOVERNED_MEMORY");
  assert.equal(c.expectedAction, null);
  assert.equal(c.expectedMemoryReadCount, 1);
});

test("R1 primary evaluator freezes A and D to the same canonical expectation", () => {
  for (const anchor of independentAnchors) {
    const a = deriveG5Fur1PrimaryArmExpectation({
      arm: "A_MEMORY_AVAILABLE",
      challenge: anchor.challenge,
      canonicalMemory: canonicalMemoryFixture,
    });
    const d = deriveG5Fur1PrimaryArmExpectation({
      arm: "D_RENDERING_PERTURBATION",
      challenge: { ...anchor.challenge, cosmeticEnvelope: "variant-does-not-enter-canonical-fields" },
      canonicalMemory: canonicalMemoryFixture,
    });
    assert.equal(a.expectedAction, anchor.expectedAction);
    assert.equal(d.expectedAction, a.expectedAction);
  }
});

test("R1 primary evaluator rejects malformed challenge geometry before deriving expectations", () => {
  assert.throws(
    () => deriveG5Fur1PrimaryExpectedAction({
      challenge: { ...independentAnchors[0].challenge, selector: 16 },
      canonicalMemory: canonicalMemoryFixture,
    }),
    /G5_FUR1_PRIMARY_SELECTOR_INVALID/,
  );
  assert.throws(
    () => deriveG5Fur1PrimaryExpectedAction({
      challenge: { ...independentAnchors[0].challenge, nonce: "xyz" },
      canonicalMemory: canonicalMemoryFixture,
    }),
    /G5_FUR1_PRIMARY_NONCE_INVALID/,
  );
});

test("R1 primary evaluator rejects noncanonical or scientifically promoted memory fixtures", () => {
  assert.throws(
    () => deriveG5Fur1PrimaryExpectedAction({
      challenge: independentAnchors[0].challenge,
      canonicalMemory: { ...canonicalMemoryFixture, entryId: "G5-E-CONTROL" },
    }),
    /G5_FUR1_PRIMARY_MEMORY_ENTRY_ID_INVALID/,
  );
  assert.throws(
    () => deriveG5Fur1PrimaryExpectedAction({
      challenge: independentAnchors[0].challenge,
      canonicalMemory: { ...canonicalMemoryFixture, scientificRootsMinted: 1 },
    }),
    /G5_FUR1_PRIMARY_SCIENTIFIC_ROOT_INVALID/,
  );
});

test("R1 primary evaluator source is isolated from subject, generator, ledger reader, and parent scorer", () => {
  const evaluatorUrl = new URL("../lib/domiG5FunctionalUseReplicationR1PrimaryEvaluator.mjs", import.meta.url);
  const source = readFileSync(fileURLToPath(evaluatorUrl), "utf8");
  const imports = [...source.matchAll(/^import\s+.*$/gm)].map((match) => match[0]);
  assert.deepEqual(imports, ['import crypto from "node:crypto";']);
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1Subject"), false);
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1Heldout"), false);
  assert.equal(source.includes("readG5FirstOwnerMemory"), false);
  assert.equal(source.includes("domiG5OwnerLongitudinalSeed"), false);
  assert.equal(source.includes("MemoryFunctionalUseHeldout"), false);
});
