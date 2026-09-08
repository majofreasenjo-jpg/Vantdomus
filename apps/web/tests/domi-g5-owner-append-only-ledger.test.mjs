import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_OWNER_DATA_CLASS,
  createG5OwnerActivationReceipt,
  admitG5ProspectiveOwnerDatum,
} from "../lib/domiG5OwnerActivation.mjs";
import {
  createG5OwnerAppendOnlyLedger,
  appendG5OwnerLedgerDatum,
  readG5OwnerLedgerEntryById,
  assertG5OwnerLedgerIntegrity,
  projectG5OwnerLedgerState,
} from "../lib/domiG5OwnerAppendOnlyLedger.mjs";

const activation = createG5OwnerActivationReceipt();
const first = admitG5ProspectiveOwnerDatum(activation, {
  entryId: "G5-E-0001-REAL",
  observedAt: "2026-09-07T14:14:00-03:00",
  surfaceClass: "PERSONAL_DESKTOP",
  dataClass: G5_OWNER_DATA_CLASS,
  content: "Debes recordar que todo esfuerzo siempre será bien recompensado",
});

function secondDatum(overrides = {}) {
  return {
    entryId: "G5-E-0002-REAL",
    observedAt: "2026-09-08T09:00:00-03:00",
    surfaceClass: "PERSONAL_MOBILE",
    dataClass: G5_OWNER_DATA_CLASS,
    content: "Segundo dato prospectivo de prueba",
    ...overrides,
  };
}

test("ledger seeds from first real entry and preserves exact readback", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  const readback = readG5OwnerLedgerEntryById(ledger, activation, "G5-E-0001-REAL");
  assert.equal(ledger.appendOnly, true);
  assert.equal(ledger.overwriteAllowed, false);
  assert.equal(ledger.entryCount, 1);
  assert.equal(readback.entryFingerprint, first.entryFingerprint);
  assert.equal(readback.content, first.content);
});

test("new prospective entry appends exactly once and advances chain head", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  const result = appendG5OwnerLedgerDatum(ledger, activation, secondDatum());
  assert.equal(result.appended, true);
  assert.equal(result.idempotentReplay, false);
  assert.equal(result.ledger.entryCount, 2);
  assert.equal(result.record.ordinal, 2);
  assert.equal(result.record.previousRecordFingerprint, ledger.headRecordFingerprint);
  assert.notEqual(result.ledger.headRecordFingerprint, ledger.headRecordFingerprint);
});

test("exact replay is idempotent and does not duplicate entry", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  const once = appendG5OwnerLedgerDatum(ledger, activation, secondDatum());
  const twice = appendG5OwnerLedgerDatum(once.ledger, activation, secondDatum());
  assert.equal(twice.appended, false);
  assert.equal(twice.idempotentReplay, true);
  assert.equal(twice.ledger.entryCount, 2);
  assert.equal(twice.ledger.ledgerFingerprint, once.ledger.ledgerFingerprint);
});

test("same entry id with different content is rejected as overwrite attempt", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  const once = appendG5OwnerLedgerDatum(ledger, activation, secondDatum());
  assert.throws(
    () => appendG5OwnerLedgerDatum(once.ledger, activation, secondDatum({ content: "contenido alterado" })),
    /G5_LEDGER_ENTRY_ID_COLLISION_NO_OVERWRITE/,
  );
});

test("temporal regression is rejected", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  assert.throws(
    () => appendG5OwnerLedgerDatum(ledger, activation, secondDatum({ observedAt: "2026-09-07T13:00:00-03:00" })),
    /G5_LEDGER_TEMPORAL_REGRESSION_REJECTED/,
  );
});

test("missing entry read fails closed", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  assert.throws(
    () => readG5OwnerLedgerEntryById(ledger, activation, "G5-E-9999-REAL"),
    /G5_LEDGER_ENTRY_NOT_FOUND_FAIL_CLOSED/,
  );
});

test("integrity audit passes for untampered append-only chain", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  const result = appendG5OwnerLedgerDatum(ledger, activation, secondDatum());
  const audit = assertG5OwnerLedgerIntegrity(result.ledger, activation);
  assert.equal(audit.pass, true);
  assert.deepEqual(audit.reasons, []);
  assert.equal(audit.entryCount, 2);
  assert.equal(audit.scientificRootsMinted, 0);
});

test("tampered snapshot fails integrity audit", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  const tampered = {
    ...ledger,
    entryCount: 2,
  };
  const audit = assertG5OwnerLedgerIntegrity(tampered, activation);
  assert.equal(audit.pass, false);
  assert.ok(audit.reasons.includes("G5_LEDGER_ENTRY_COUNT_MISMATCH"));
});

test("projected ledger state preserves no scientific promotion and no production", () => {
  const ledger = createG5OwnerAppendOnlyLedger(activation, [first]);
  const state = projectG5OwnerLedgerState(ledger, activation);
  assert.equal(state.entryCount, 1);
  assert.equal(state.appendOnly, true);
  assert.equal(state.overwriteAllowed, false);
  assert.equal(state.scientificRootsMinted, 0);
  assert.equal(state.production, false);
});
