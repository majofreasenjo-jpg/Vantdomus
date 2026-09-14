import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_FUR2_FRESH_SEED,
  DOMI_G5_FUR2_HELDOUT_GENERATOR_VERSION,
  DOMI_G5_FUR2_NAMESPACE,
  DOMI_G5_FUR2_PANEL_COMMITMENT,
  DOMI_G5_FUR2_PANEL_SIZE,
  DOMI_G5_FUR2_STRATIFICATION,
  computeG5Fur2PanelCommitment,
  generateG5Fur2HeldoutPanel,
  getG5Fur2HeldoutFreezeDescriptor,
} from "../lib/domiG5LongitudinalTwoEntryR2Heldout.mjs";

const R1_SEED = "G5-FUR1-2026-09-09-PREEXEC-V1";
const R1_NAMESPACE = "G5-FUR1-C-";
const forbiddenContentKeys = new Set(["text", "prompt", "content", "memoryHint"]);

test("R2 heldout freeze descriptor is exact and pre-outcome", () => {
  const d = getG5Fur2HeldoutFreezeDescriptor();
  assert.equal(d.version, "DOMI_G5_FUR2_HELDOUT_V0_1");
  assert.equal(d.panelSize, 128);
  assert.equal(d.namespace, "G5-FUR2-C-");
  assert.deepEqual(d.stratification, {
    OLDER_ONLY: 32,
    NEWER_ONLY: 32,
    ORDERED_PAIR: 32,
    PROVENANCE_CONTROL: 16,
    ENUMERATION_ORDER_INVARIANCE: 16,
  });
  assert.equal(d.subjectImported, false);
  assert.equal(d.subjectCalls, 0);
  assert.equal(d.heldoutOutcomesSeen, false);
  assert.equal(d.production, false);
  assert.equal(d.scientificRootsMinted, 0);
  assert.equal(d.thirdEntryAdmissionAllowed, false);
});

test("fresh seed and namespace do not reuse R1", () => {
  assert.notEqual(DOMI_G5_FUR2_FRESH_SEED, R1_SEED);
  assert.notEqual(DOMI_G5_FUR2_NAMESPACE, R1_NAMESPACE);
  assert.equal(DOMI_G5_FUR2_FRESH_SEED.length, 64);
  assert.match(DOMI_G5_FUR2_FRESH_SEED, /^[0-9a-f]{64}$/);
  assert.equal(DOMI_G5_FUR2_HELDOUT_GENERATOR_VERSION, "DOMI_G5_FUR2_HELDOUT_V0_1");
});

test("panel materializes deterministically to exactly 128 unique challenges", () => {
  const a = generateG5Fur2HeldoutPanel();
  const b = generateG5Fur2HeldoutPanel();
  assert.equal(a.length, DOMI_G5_FUR2_PANEL_SIZE);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((row) => row.challengeId)).size, 128);
  assert.equal(computeG5Fur2PanelCommitment(a), DOMI_G5_FUR2_PANEL_COMMITMENT);
  assert.equal(computeG5Fur2PanelCommitment(b), DOMI_G5_FUR2_PANEL_COMMITMENT);
});

test("panel has exact frozen class stratification", () => {
  const panel = generateG5Fur2HeldoutPanel();
  const counts = Object.fromEntries(Object.keys(DOMI_G5_FUR2_STRATIFICATION).map((key) => [key, 0]));
  for (const row of panel) counts[row.targetClass] += 1;
  assert.deepEqual(counts, DOMI_G5_FUR2_STRATIFICATION);
});

test("challenge schema has no content channels and matches frozen geometry", () => {
  const panel = generateG5Fur2HeldoutPanel();
  for (const row of panel) {
    assert.match(row.challengeId, /^G5-FUR2-C-[0-9a-f]{24}$/);
    assert.ok(Number.isInteger(row.selector));
    assert.ok(row.selector >= 0 && row.selector <= 31);
    assert.match(row.nonce, /^[0-9a-f]{40}$/);
    for (const key of forbiddenContentKeys) assert.equal(Object.hasOwn(row, key), false);
    if (row.targetClass === "PROVENANCE_CONTROL") {
      assert.ok(["OLDER", "NEWER", "PAIR"].includes(row.provenanceTarget));
    } else {
      assert.equal(Object.hasOwn(row, "provenanceTarget"), false);
    }
  }
});

test("provenance-control allocation is frozen 6/5/5", () => {
  const rows = generateG5Fur2HeldoutPanel().filter((row) => row.targetClass === "PROVENANCE_CONTROL");
  const counts = { OLDER: 0, NEWER: 0, PAIR: 0 };
  for (const row of rows) counts[row.provenanceTarget] += 1;
  assert.deepEqual(counts, { OLDER: 6, NEWER: 5, PAIR: 5 });
});

test("panel generation is subject-free and outcome-free by construction", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../lib/domiG5LongitudinalTwoEntryR2Heldout.mjs", import.meta.url), "utf8"));
  assert.equal(source.includes("solveG5LongitudinalTwoEntryR2"), false);
  assert.equal(source.includes("domiG5LongitudinalTwoEntryR2Subject"), false);
  assert.equal(source.includes("subjectOutcome"), false);
});
