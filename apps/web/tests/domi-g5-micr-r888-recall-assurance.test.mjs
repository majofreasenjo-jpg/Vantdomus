import test from "node:test";
import assert from "node:assert/strict";
import {
  buildG5RecallSourceCertificate,
  projectG5MemoryFunctionalUseStatus,
  secondaryReadG5OwnerEntryById,
  assertG5RecallReadIsNonMutating,
} from "../lib/domiG5MicrR888RecallAssurance.mjs";
import {
  G5_FIRST_REAL_OWNER_ENTRY_ID,
  G5_FIRST_REAL_OWNER_DATUM,
  G5_OWNER_LEDGER_STATE,
} from "../lib/domiG5OwnerLongitudinalSeed.mjs";

test("MICR R8.88 secondary reader recovers exact frozen G5 entry", () => {
  const entry = secondaryReadG5OwnerEntryById(G5_FIRST_REAL_OWNER_ENTRY_ID);
  assert.equal(entry.entryId, G5_FIRST_REAL_OWNER_ENTRY_ID);
  assert.equal(entry.content, G5_FIRST_REAL_OWNER_DATUM);
});

test("MICR R8.88 recall certificate binds source and ledger custody", () => {
  const cert = buildG5RecallSourceCertificate({ readSurface: "TEST_PREVIEW" });
  assert.equal(cert.entryId, G5_FIRST_REAL_OWNER_ENTRY_ID);
  assert.equal(cert.ledgerFingerprint, G5_OWNER_LEDGER_STATE.ledgerFingerprint);
  assert.equal(cert.ledgerHeadRecordFingerprint, G5_OWNER_LEDGER_STATE.headRecordFingerprint);
  assert.equal(cert.primarySecondarySourceAgreement, true);
  assert.equal(cert.ledgerIntegrityPass, true);
  assert.equal(cert.canonicalStateSeparatedFromRendering, true);
});

test("MICR R8.88 recall certificate mints no scientific root and touches no production", () => {
  const cert = buildG5RecallSourceCertificate();
  assert.equal(cert.scientificRootsMinted, 0);
  assert.equal(cert.production, false);
  assert.equal(cert.readMutatesLedger, false);
});

test("MICR R8.88 memory functional use remains unestablished after recall", () => {
  const state = projectG5MemoryFunctionalUseStatus();
  assert.equal(state.recallEstablished, true);
  assert.equal(state.memoryFunctionalUseEstablished, false);
  assert.equal(state.heldOutDownstreamTaskFrozen, false);
  assert.equal(state.matchedInformationAblationCompleted, false);
  assert.equal(state.postHocRetuningAllowed, false);
  assert.equal(state.sameBankRescueAllowed, false);
});

test("MICR R8.88 governed recall is non-mutating", () => {
  const result = assertG5RecallReadIsNonMutating();
  assert.equal(result.pass, true);
  assert.deepEqual(result.before, result.after);
  assert.equal(result.scientificRootsMinted, 0);
});

test("MICR R8.88 secondary reader fails closed on missing entry", () => {
  assert.throws(
    () => secondaryReadG5OwnerEntryById("G5-E-9999-NOT-REAL"),
    /G5_R888_SECONDARY_ENTRY_NOT_FOUND_FAIL_CLOSED/,
  );
});
