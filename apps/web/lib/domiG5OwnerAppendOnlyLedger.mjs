import crypto from "node:crypto";
import {
  admitG5ProspectiveOwnerDatum,
} from "./domiG5OwnerActivation.mjs";

export const DOMI_G5_OWNER_LEDGER_VERSION = "DOMI_G5_OWNER_APPEND_ONLY_LEDGER_V0_1";
export const G5_OWNER_LEDGER_SCHEMA = "domi.g5.owner-append-only-ledger.v1";
export const G5_OWNER_LEDGER_RECORD_SCHEMA = "domi.g5.owner-append-only-record.v1";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) freezeDeep(item);
  }
  return value;
}

function requireActivation(activationReceipt) {
  if (!activationReceipt || activationReceipt.schema !== "domi.g5.owner-activation.v1") {
    throw new Error("G5_LEDGER_ACTIVATION_RECEIPT_INVALID");
  }
  if (activationReceipt.activationState !== "ACTIVE" || activationReceipt.g5Started !== true) {
    throw new Error("G5_LEDGER_ACTIVATION_NOT_ACTIVE");
  }
  if (activationReceipt.realOwnerMemoryBoundaryOpen !== true) {
    throw new Error("G5_LEDGER_OWNER_MEMORY_BOUNDARY_CLOSED");
  }
}

function requireLedger(ledger, activationReceipt) {
  requireActivation(activationReceipt);
  if (!ledger || ledger.schema !== G5_OWNER_LEDGER_SCHEMA) {
    throw new Error("G5_LEDGER_INVALID");
  }
  if (ledger.activationFingerprint !== activationReceipt.activationFingerprint) {
    throw new Error("G5_LEDGER_ACTIVATION_FINGERPRINT_MISMATCH");
  }
}

function entryMillis(entry) {
  const millis = Date.parse(entry.observedAt);
  if (!Number.isFinite(millis)) throw new Error("G5_LEDGER_ENTRY_TIMESTAMP_INVALID");
  return millis;
}

function reproduceEntry(activationReceipt, entry) {
  return admitG5ProspectiveOwnerDatum(activationReceipt, {
    entryId: entry.entryId,
    observedAt: entry.observedAt,
    surfaceClass: entry.surfaceClass,
    dataClass: entry.dataClass,
    content: entry.content,
    familyData: entry.familyData,
    holdout: entry.holdout,
    production: entry.production,
    retroactiveImport: entry.retroactiveImport,
  });
}

function recordCore({ ordinal, previousRecordFingerprint, entryFingerprint }) {
  return {
    schema: G5_OWNER_LEDGER_RECORD_SCHEMA,
    ordinal,
    previousRecordFingerprint,
    entryFingerprint,
  };
}

function ledgerFingerprintCore(ledger) {
  return {
    schema: ledger.schema,
    version: ledger.version,
    activationFingerprint: ledger.activationFingerprint,
    appendOnly: ledger.appendOnly,
    overwriteAllowed: ledger.overwriteAllowed,
    entryCount: ledger.entryCount,
    headRecordFingerprint: ledger.headRecordFingerprint,
    recordFingerprints: ledger.records.map((record) => record.recordFingerprint),
    scientificRootsMinted: ledger.scientificRootsMinted,
    production: ledger.production,
  };
}

function materializeLedger(activationReceipt, records) {
  const headRecordFingerprint = records.length === 0
    ? null
    : records[records.length - 1].recordFingerprint;
  const ledgerCore = {
    schema: G5_OWNER_LEDGER_SCHEMA,
    version: DOMI_G5_OWNER_LEDGER_VERSION,
    activationFingerprint: activationReceipt.activationFingerprint,
    appendOnly: true,
    overwriteAllowed: false,
    immutableSnapshots: true,
    orderingRule: "OBSERVED_AT_NONDECREASING_THEN_APPEND_ORDINAL",
    duplicateEntryIdPolicy: "IDEMPOTENT_IF_EXACT_OTHERWISE_REJECT",
    missingReadPolicy: "FAIL_CLOSED",
    records: [...records],
    entryCount: records.length,
    headRecordFingerprint,
    scientificRootsMinted: 0,
    production: false,
  };
  const ledgerFingerprint = sha256(ledgerFingerprintCore(ledgerCore));
  return freezeDeep({ ...ledgerCore, ledgerFingerprint });
}

function appendAdmittedEntry(ledger, activationReceipt, admittedEntry) {
  requireLedger(ledger, activationReceipt);

  const reproduced = reproduceEntry(activationReceipt, admittedEntry);
  if (reproduced.entryFingerprint !== admittedEntry.entryFingerprint) {
    throw new Error("G5_LEDGER_ENTRY_FINGERPRINT_MISMATCH");
  }

  const existingRecord = ledger.records.find((record) => record.entry.entryId === admittedEntry.entryId);
  if (existingRecord) {
    if (existingRecord.entry.entryFingerprint === admittedEntry.entryFingerprint) {
      return freezeDeep({
        ledger,
        entry: existingRecord.entry,
        record: existingRecord,
        appended: false,
        idempotentReplay: true,
      });
    }
    throw new Error("G5_LEDGER_ENTRY_ID_COLLISION_NO_OVERWRITE");
  }

  const previousRecord = ledger.records.at(-1) ?? null;
  if (previousRecord && entryMillis(admittedEntry) < entryMillis(previousRecord.entry)) {
    throw new Error("G5_LEDGER_TEMPORAL_REGRESSION_REJECTED");
  }

  const core = recordCore({
    ordinal: ledger.records.length + 1,
    previousRecordFingerprint: previousRecord?.recordFingerprint ?? null,
    entryFingerprint: admittedEntry.entryFingerprint,
  });
  const record = freezeDeep({
    ...core,
    entry: admittedEntry,
    recordFingerprint: sha256(core),
  });
  const nextLedger = materializeLedger(activationReceipt, [...ledger.records, record]);
  return freezeDeep({
    ledger: nextLedger,
    entry: admittedEntry,
    record,
    appended: true,
    idempotentReplay: false,
  });
}

export function createG5OwnerAppendOnlyLedger(activationReceipt, admittedEntries = []) {
  requireActivation(activationReceipt);
  let ledger = materializeLedger(activationReceipt, []);
  for (const entry of admittedEntries) {
    ledger = appendAdmittedEntry(ledger, activationReceipt, entry).ledger;
  }
  return ledger;
}

export function appendG5OwnerLedgerDatum(ledger, activationReceipt, datum = {}) {
  requireLedger(ledger, activationReceipt);
  const admittedEntry = admitG5ProspectiveOwnerDatum(activationReceipt, datum);
  return appendAdmittedEntry(ledger, activationReceipt, admittedEntry);
}

export function readG5OwnerLedgerEntryById(ledger, activationReceipt, entryId) {
  requireLedger(ledger, activationReceipt);
  if (typeof entryId !== "string" || entryId.trim() === "") {
    throw new Error("G5_LEDGER_READ_ENTRY_ID_REQUIRED");
  }
  const record = ledger.records.find((candidate) => candidate.entry.entryId === entryId.trim());
  if (!record) throw new Error("G5_LEDGER_ENTRY_NOT_FOUND_FAIL_CLOSED");
  return record.entry;
}

export function assertG5OwnerLedgerIntegrity(ledger, activationReceipt) {
  const reasons = [];
  try {
    requireLedger(ledger, activationReceipt);
  } catch (error) {
    return freezeDeep({ pass: false, reasons: [error.message], scientificRootsMinted: 0 });
  }

  if (ledger.appendOnly !== true) reasons.push("G5_LEDGER_APPEND_ONLY_FLAG_INVALID");
  if (ledger.overwriteAllowed !== false) reasons.push("G5_LEDGER_OVERWRITE_POLICY_INVALID");
  if (ledger.entryCount !== ledger.records.length) reasons.push("G5_LEDGER_ENTRY_COUNT_MISMATCH");
  if (ledger.scientificRootsMinted !== 0) reasons.push("G5_LEDGER_SCIENTIFIC_ROOT_MINT_INVALID");
  if (ledger.production !== false) reasons.push("G5_LEDGER_PRODUCTION_SCOPE_INVALID");

  const seenIds = new Set();
  let priorRecord = null;
  for (let index = 0; index < ledger.records.length; index += 1) {
    const record = ledger.records[index];
    if (record.schema !== G5_OWNER_LEDGER_RECORD_SCHEMA) reasons.push(`RECORD_SCHEMA_INVALID:${index + 1}`);
    if (record.ordinal !== index + 1) reasons.push(`RECORD_ORDINAL_INVALID:${index + 1}`);
    if (record.previousRecordFingerprint !== (priorRecord?.recordFingerprint ?? null)) {
      reasons.push(`RECORD_CHAIN_BROKEN:${index + 1}`);
    }
    if (seenIds.has(record.entry?.entryId)) reasons.push(`DUPLICATE_ENTRY_ID:${record.entry?.entryId}`);
    seenIds.add(record.entry?.entryId);

    try {
      const reproduced = reproduceEntry(activationReceipt, record.entry);
      if (reproduced.entryFingerprint !== record.entry.entryFingerprint) {
        reasons.push(`ENTRY_FINGERPRINT_INVALID:${record.entry.entryId}`);
      }
    } catch {
      reasons.push(`ENTRY_REPRODUCTION_FAILED:${record.entry?.entryId ?? index + 1}`);
    }

    if (priorRecord && entryMillis(record.entry) < entryMillis(priorRecord.entry)) {
      reasons.push(`TEMPORAL_ORDER_INVALID:${record.entry.entryId}`);
    }

    const expectedCore = recordCore({
      ordinal: index + 1,
      previousRecordFingerprint: priorRecord?.recordFingerprint ?? null,
      entryFingerprint: record.entry.entryFingerprint,
    });
    if (sha256(expectedCore) !== record.recordFingerprint) {
      reasons.push(`RECORD_FINGERPRINT_INVALID:${index + 1}`);
    }
    priorRecord = record;
  }

  const expectedHead = priorRecord?.recordFingerprint ?? null;
  if (ledger.headRecordFingerprint !== expectedHead) reasons.push("G5_LEDGER_HEAD_MISMATCH");
  if (sha256(ledgerFingerprintCore(ledger)) !== ledger.ledgerFingerprint) {
    reasons.push("G5_LEDGER_FINGERPRINT_INVALID");
  }

  return freezeDeep({
    pass: reasons.length === 0,
    reasons,
    entryCount: ledger.records.length,
    headRecordFingerprint: ledger.headRecordFingerprint,
    ledgerFingerprint: ledger.ledgerFingerprint,
    scientificRootsMinted: 0,
  });
}

export function projectG5OwnerLedgerState(ledger, activationReceipt) {
  const integrity = assertG5OwnerLedgerIntegrity(ledger, activationReceipt);
  if (!integrity.pass) {
    throw new Error(`G5_LEDGER_INTEGRITY_HOLD:${integrity.reasons.join("|")}`);
  }
  return freezeDeep({
    schema: ledger.schema,
    version: ledger.version,
    activationFingerprint: ledger.activationFingerprint,
    appendOnly: true,
    overwriteAllowed: false,
    immutableSnapshots: true,
    entryCount: ledger.entryCount,
    headRecordFingerprint: ledger.headRecordFingerprint,
    ledgerFingerprint: ledger.ledgerFingerprint,
    scientificRootsMinted: 0,
    production: false,
  });
}
