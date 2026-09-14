import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DOMI_G5_FUR1_HELDOUT_GENERATOR_VERSION,
  DOMI_G5_FUR1_HELDOUT_SEED,
  DOMI_G5_FUR1_HELDOUT_PANEL_SIZE,
  DOMI_G5_FUR1_CHALLENGE_NAMESPACE,
  DOMI_G5_FUR1_PRESENTATION_VARIANT_COUNT,
  generateG5Fur1HeldoutPanel,
  assertG5Fur1HeldoutPanelIntegrity,
  describeG5Fur1HeldoutGeneratorFreeze,
} from "../lib/domiG5FunctionalUseReplicationR1Heldout.mjs";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function independentlyReconstruct(index) {
  const challengeId = `${DOMI_G5_FUR1_CHALLENGE_NAMESPACE}${sha256Hex(`${DOMI_G5_FUR1_HELDOUT_SEED}|id|${index}`).slice(0, 24)}`;
  const selector = Number.parseInt(
    sha256Hex(`${DOMI_G5_FUR1_HELDOUT_SEED}|selector|${index}`).slice(0, 8),
    16,
  ) % 16;
  const nonce = sha256Hex(`${DOMI_G5_FUR1_HELDOUT_SEED}|nonce|${index}`).slice(0, 32);
  return Object.freeze({ challengeId, selector, nonce, presentationVariant: index % 4 });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("R1 heldout freeze descriptor is exact and produces no outcome", () => {
  const freeze = describeG5Fur1HeldoutGeneratorFreeze();
  assert.equal(freeze.version, DOMI_G5_FUR1_HELDOUT_GENERATOR_VERSION);
  assert.equal(freeze.version, "DOMI_G5_FUR1_HELDOUT_GENERATOR_V0_1");
  assert.equal(freeze.seed, "G5-FUR1-2026-09-09-PREEXEC-V1");
  assert.equal(freeze.panelSize, 96);
  assert.equal(freeze.namespace, "G5-FUR1-C-");
  assert.equal(freeze.presentationVariantCount, 4);
  assert.equal(freeze.panelMaterializedByThisCall, false);
  assert.equal(freeze.scorerImported, false);
  assert.equal(freeze.memoryReadPerformed, false);
  assert.equal(freeze.outcomeProduced, false);
  assert.equal(freeze.scientificRootsMinted, 0);
  assert.equal(freeze.production, false);
});

test("R1 generator deterministically materializes exactly 96 unique structural challenges", () => {
  const first = generateG5Fur1HeldoutPanel();
  const second = generateG5Fur1HeldoutPanel();
  assert.equal(first.length, DOMI_G5_FUR1_HELDOUT_PANEL_SIZE);
  assert.equal(second.length, DOMI_G5_FUR1_HELDOUT_PANEL_SIZE);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((item) => item.canonicalChallenge.challengeId)).size, 96);
  assert.equal(new Set(first.map((item) => item.canonicalChallenge.nonce)).size, 96);
  assert.ok(first.every((item) => /^G5-FUR1-C-[0-9a-f]{24}$/.test(item.canonicalChallenge.challengeId)));
  assert.ok(first.every((item) => /^[0-9a-f]{32}$/.test(item.canonicalChallenge.nonce)));
  assert.ok(first.every((item) => Number.isInteger(item.canonicalChallenge.selector) && item.canonicalChallenge.selector >= 0 && item.canonicalChallenge.selector <= 15));
});

test("all 96 canonical challenge fields match an independent reconstruction from the frozen seed", () => {
  const panel = generateG5Fur1HeldoutPanel();
  for (let index = 0; index < panel.length; index += 1) {
    const expected = independentlyReconstruct(index);
    assert.equal(panel[index].canonicalChallenge.challengeId, expected.challengeId);
    assert.equal(panel[index].canonicalChallenge.selector, expected.selector);
    assert.equal(panel[index].canonicalChallenge.nonce, expected.nonce);
    assert.equal(panel[index].presentationVariant, expected.presentationVariant);
  }
});

test("four rendering variants are exactly balanced and preserve canonical fields", () => {
  const panel = generateG5Fur1HeldoutPanel();
  const counts = Array.from({ length: DOMI_G5_FUR1_PRESENTATION_VARIANT_COUNT }, () => 0);
  const expectedOrders = [
    ["challengeId", "selector", "nonce"],
    ["nonce", "challengeId", "selector"],
    ["selector", "nonce", "challengeId"],
    ["challengeId", "nonce", "selector"],
  ];

  for (const item of panel) {
    counts[item.presentationVariant] += 1;
    assert.equal(item.presentationEnvelope.presentationVariant, item.presentationVariant);
    assert.deepEqual(
      item.presentationEnvelope.fields.map(([key]) => key),
      expectedOrders[item.presentationVariant],
    );
    const presented = Object.fromEntries(item.presentationEnvelope.fields);
    assert.deepEqual(presented, item.canonicalChallenge);
  }
  assert.deepEqual(counts, [24, 24, 24, 24]);
});

test("integrity audit passes the frozen panel and reports no production or scientific roots", () => {
  const panel = generateG5Fur1HeldoutPanel();
  const integrity = assertG5Fur1HeldoutPanelIntegrity(panel);
  assert.equal(integrity.pass, true);
  assert.deepEqual(integrity.reasons, []);
  assert.equal(integrity.panelSize, 96);
  assert.equal(integrity.uniqueChallengeIds, 96);
  assert.equal(integrity.seed, DOMI_G5_FUR1_HELDOUT_SEED);
  assert.equal(integrity.namespace, DOMI_G5_FUR1_CHALLENGE_NAMESPACE);
  assert.equal(integrity.scientificRootsMinted, 0);
  assert.equal(integrity.production, false);
});

test("integrity audit detects deterministic structural tampering and truncation", () => {
  const pristine = generateG5Fur1HeldoutPanel();

  const tampered = clone(pristine);
  tampered[17].canonicalChallenge.selector = (tampered[17].canonicalChallenge.selector + 1) % 16;
  const tamperedResult = assertG5Fur1HeldoutPanelIntegrity(tampered);
  assert.equal(tamperedResult.pass, false);
  assert.ok(tamperedResult.reasons.includes("G5_FUR1_SELECTOR_MISMATCH:17"));

  const truncated = clone(pristine).slice(0, 95);
  const truncatedResult = assertG5Fur1HeldoutPanelIntegrity(truncated);
  assert.equal(truncatedResult.pass, false);
  assert.ok(truncatedResult.reasons.includes("G5_FUR1_PANEL_SIZE_INVALID"));
  assert.ok(truncatedResult.reasons.includes("G5_FUR1_CHALLENGE_IDS_NOT_UNIQUE"));
});

test("materialized structural panel is immutable and carries no executable subject or scorer result fields", () => {
  const panel = generateG5Fur1HeldoutPanel();
  assert.equal(Object.isFrozen(panel), true);
  for (const item of panel) {
    assert.equal(Object.isFrozen(item), true);
    assert.equal(Object.isFrozen(item.canonicalChallenge), true);
    assert.equal(Object.isFrozen(item.presentationEnvelope), true);
    assert.equal(Object.hasOwn(item, "action"), false);
    assert.equal(Object.hasOwn(item, "disposition"), false);
    assert.equal(Object.hasOwn(item, "score"), false);
    assert.equal(item.scientificRootsMinted, 0);
    assert.equal(item.production, false);
  }
});

test("generator source is structurally isolated from subject, scorer, and governed-memory modules", () => {
  const generatorUrl = new URL("../lib/domiG5FunctionalUseReplicationR1Heldout.mjs", import.meta.url);
  const source = readFileSync(fileURLToPath(generatorUrl), "utf8");
  const imports = [...source.matchAll(/^import\s+.*$/gm)].map((match) => match[0]);
  assert.deepEqual(imports, ['import crypto from "node:crypto";']);
  assert.equal(source.includes("domiG5FunctionalUseReplicationR1Subject"), false);
  assert.equal(source.includes("Scorer"), false);
  assert.equal(source.includes("domiG5OwnerLongitudinalSeed"), false);
  assert.equal(source.includes("readG5FirstOwnerMemory"), false);
  assert.equal(source.includes("memoryProvider"), false);
});
