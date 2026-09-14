import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_THIRD_REAL_OWNER_DATUM,
  G5_THIRD_REAL_OWNER_ENTRY,
  G5_THIRD_REAL_OWNER_ENTRY_ID,
  G5_THIRD_REAL_OWNER_OBSERVED_AT,
  G5_THIRD_REAL_OWNER_SURFACE,
  G5_R3_OWNER_LEDGER_INTEGRITY,
  G5_R3_OWNER_LEDGER_STATE,
  G5_R3_OWNER_LONGITUDINAL_STATE,
  readG5R3FirstOwnerMemory,
  readG5R3SecondOwnerMemory,
  readG5ThirdOwnerMemory,
} from "../lib/domiG5OwnerLongitudinalStateR3.mjs";

test("third G5 entry is admitted prospectively and exactly", () => {
  assert.equal(G5_THIRD_REAL_OWNER_ENTRY_ID, "G5-E-0003-REAL");
  assert.equal(G5_THIRD_REAL_OWNER_DATUM, "La felicidad antes de todo");
  assert.equal(G5_THIRD_REAL_OWNER_OBSERVED_AT, "2026-09-13T19:44:00-03:00");
  assert.equal(G5_THIRD_REAL_OWNER_SURFACE, "PERSONAL_DESKTOP");
  assert.equal(G5_THIRD_REAL_OWNER_ENTRY.content, G5_THIRD_REAL_OWNER_DATUM);
  assert.equal(G5_THIRD_REAL_OWNER_ENTRY.prospective, true);
  assert.equal(G5_THIRD_REAL_OWNER_ENTRY.retroactiveImport, false);
  assert.equal(G5_THIRD_REAL_OWNER_ENTRY.familyData, false);
  assert.equal(G5_THIRD_REAL_OWNER_ENTRY.holdout, false);
  assert.equal(G5_THIRD_REAL_OWNER_ENTRY.production, false);
});

test("three-entry append-only ledger preserves E1 E2 and E3", () => {
  assert.equal(G5_R3_OWNER_LEDGER_INTEGRITY.pass, true);
  assert.deepEqual(G5_R3_OWNER_LEDGER_INTEGRITY.reasons, []);
  assert.equal(G5_R3_OWNER_LEDGER_STATE.entryCount, 3);
  assert.equal(G5_R3_OWNER_LEDGER_STATE.appendOnly, true);
  assert.equal(G5_R3_OWNER_LEDGER_STATE.overwriteAllowed, false);
  assert.equal(G5_R3_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount, 3);

  const first = readG5R3FirstOwnerMemory();
  const second = readG5R3SecondOwnerMemory();
  const third = readG5ThirdOwnerMemory();

  assert.equal(first.entryId, "G5-E-0001-REAL");
  assert.equal(second.entryId, "G5-E-0002-REAL");
  assert.equal(third.entryId, "G5-E-0003-REAL");
  assert.notEqual(first.entryFingerprint, second.entryFingerprint);
  assert.notEqual(second.entryFingerprint, third.entryFingerprint);
  assert.notEqual(first.entryFingerprint, third.entryFingerprint);
  assert.equal(first.realOwnerMemoryEntryCount, 3);
  assert.equal(second.realOwnerMemoryEntryCount, 3);
  assert.equal(third.realOwnerMemoryEntryCount, 3);
});

test("E3 admission changes neither production nor scientific roots", () => {
  assert.equal(G5_R3_OWNER_LEDGER_STATE.scientificRootsMinted, 0);
  assert.equal(G5_R3_OWNER_LEDGER_STATE.production, false);
  assert.equal(G5_R3_OWNER_LONGITUDINAL_STATE.scientificRootsMinted, 0);
  assert.equal(G5_R3_OWNER_LONGITUDINAL_STATE.production, false);
  assert.equal(G5_R3_OWNER_LONGITUDINAL_STATE.familyData, false);
  assert.equal(G5_R3_OWNER_LONGITUDINAL_STATE.holdouts, false);
});
