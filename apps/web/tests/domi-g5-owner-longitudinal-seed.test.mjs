import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_FIRST_REAL_OWNER_DATUM,
  G5_FIRST_REAL_OWNER_ENTRY,
  G5_FIRST_REAL_OWNER_ENTRY_ID,
  G5_FIRST_REAL_OWNER_OBSERVED_AT,
  G5_FIRST_REAL_OWNER_SURFACE,
  G5_OWNER_LONGITUDINAL_STATE,
  readG5FirstOwnerMemory,
} from "../lib/domiG5OwnerLongitudinalSeed.mjs";

test("first real G5 owner datum is the exact authorized prospective phrase", () => {
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY_ID, "G5-E-0001-REAL");
  assert.equal(G5_FIRST_REAL_OWNER_DATUM, "Debes recordar que todo esfuerzo siempre será bien recompensado");
  assert.equal(G5_FIRST_REAL_OWNER_OBSERVED_AT, "2026-09-07T14:14:00-03:00");
  assert.equal(G5_FIRST_REAL_OWNER_SURFACE, "PERSONAL_DESKTOP");
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.content, G5_FIRST_REAL_OWNER_DATUM);
});

test("first real G5 owner datum remains prospective and bounded", () => {
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.prospective, true);
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.retroactiveImport, false);
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.familyData, false);
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.holdout, false);
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.production, false);
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.scientificEvidenceRootMinted, false);
  assert.equal(G5_FIRST_REAL_OWNER_ENTRY.developmentalCredit, 0);
});

test("longitudinal state increments from zero to one without scientific promotion", () => {
  assert.equal(G5_OWNER_LONGITUDINAL_STATE.g5Started, true);
  assert.equal(G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryBoundaryOpen, true);
  assert.equal(G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount, 1);
  assert.equal(G5_OWNER_LONGITUDINAL_STATE.scientificRootsMinted, 0);
  assert.equal(G5_OWNER_LONGITUDINAL_STATE.production, false);
  assert.equal(G5_OWNER_LONGITUDINAL_STATE.familyData, false);
  assert.equal(G5_OWNER_LONGITUDINAL_STATE.holdouts, false);
});

test("readback returns the exact admitted phrase and fingerprint", () => {
  const readback = readG5FirstOwnerMemory();
  assert.equal(readback.entryId, "G5-E-0001-REAL");
  assert.equal(readback.content, G5_FIRST_REAL_OWNER_DATUM);
  assert.equal(readback.observedAt, G5_FIRST_REAL_OWNER_OBSERVED_AT);
  assert.equal(readback.surfaceClass, G5_FIRST_REAL_OWNER_SURFACE);
  assert.equal(readback.prospective, true);
  assert.equal(typeof readback.entryFingerprint, "string");
  assert.equal(readback.entryFingerprint.length, 64);
  assert.equal(readback.realOwnerMemoryEntryCount, 1);
  assert.equal(readback.scientificRootsMinted, 0);
});
