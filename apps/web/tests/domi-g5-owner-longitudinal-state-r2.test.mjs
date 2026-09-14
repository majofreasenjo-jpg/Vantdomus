import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_SECOND_REAL_OWNER_DATUM,
  G5_SECOND_REAL_OWNER_ENTRY,
  G5_SECOND_REAL_OWNER_ENTRY_ID,
  G5_SECOND_REAL_OWNER_OBSERVED_AT,
  G5_SECOND_REAL_OWNER_SURFACE,
  G5_R2_OWNER_LEDGER_INTEGRITY,
  G5_R2_OWNER_LEDGER_STATE,
  G5_R2_OWNER_LONGITUDINAL_STATE,
  readG5R2FirstOwnerMemory,
  readG5SecondOwnerMemory,
} from "../lib/domiG5OwnerLongitudinalStateR2.mjs";

test("second real owner datum is admitted prospectively and exactly", () => {
  assert.equal(G5_SECOND_REAL_OWNER_ENTRY_ID, "G5-E-0002-REAL");
  assert.equal(G5_SECOND_REAL_OWNER_DATUM, "Prefiero que los proyectos científicos tengan siempre una bitácora clara y un registro de decisiones.");
  assert.equal(G5_SECOND_REAL_OWNER_OBSERVED_AT, "2026-09-11T11:43:00-03:00");
  assert.equal(G5_SECOND_REAL_OWNER_SURFACE, "PERSONAL_DESKTOP");
  assert.equal(G5_SECOND_REAL_OWNER_ENTRY.content, G5_SECOND_REAL_OWNER_DATUM);
  assert.equal(G5_SECOND_REAL_OWNER_ENTRY.prospective, true);
  assert.equal(G5_SECOND_REAL_OWNER_ENTRY.retroactiveImport, false);
  assert.equal(G5_SECOND_REAL_OWNER_ENTRY.familyData, false);
  assert.equal(G5_SECOND_REAL_OWNER_ENTRY.holdout, false);
  assert.equal(G5_SECOND_REAL_OWNER_ENTRY.production, false);
});

test("two-entry append-only ledger preserves first entry and advances exactly once", () => {
  assert.equal(G5_R2_OWNER_LEDGER_INTEGRITY.pass, true);
  assert.deepEqual(G5_R2_OWNER_LEDGER_INTEGRITY.reasons, []);
  assert.equal(G5_R2_OWNER_LEDGER_STATE.entryCount, 2);
  assert.equal(G5_R2_OWNER_LEDGER_STATE.appendOnly, true);
  assert.equal(G5_R2_OWNER_LEDGER_STATE.overwriteAllowed, false);
  assert.equal(G5_R2_OWNER_LEDGER_STATE.scientificRootsMinted, 0);
  assert.equal(G5_R2_OWNER_LEDGER_STATE.production, false);
  assert.equal(G5_R2_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount, 2);
  const first = readG5R2FirstOwnerMemory();
  const second = readG5SecondOwnerMemory();
  assert.equal(first.entryId, "G5-E-0001-REAL");
  assert.equal(second.entryId, "G5-E-0002-REAL");
  assert.notEqual(first.entryFingerprint, second.entryFingerprint);
  assert.equal(first.realOwnerMemoryEntryCount, 2);
  assert.equal(second.realOwnerMemoryEntryCount, 2);
});

test("R2 memory admission mints no scientific root and mutates no production", () => {
  assert.equal(G5_R2_OWNER_LONGITUDINAL_STATE.scientificRootsMinted, 0);
  assert.equal(G5_R2_OWNER_LONGITUDINAL_STATE.production, false);
  assert.equal(G5_R2_OWNER_LONGITUDINAL_STATE.familyData, false);
  assert.equal(G5_R2_OWNER_LONGITUDINAL_STATE.holdouts, false);
});
