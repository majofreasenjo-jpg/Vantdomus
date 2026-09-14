import {
  G5_OWNER_DATA_CLASS,
  projectG5ActivationState,
} from "./domiG5OwnerActivation.mjs";
import {
  appendG5OwnerLedgerDatum,
  assertG5OwnerLedgerIntegrity,
  projectG5OwnerLedgerState,
  readG5OwnerLedgerEntryById,
} from "./domiG5OwnerAppendOnlyLedger.mjs";
import {
  G5_FIRST_REAL_OWNER_ENTRY_ID,
  G5_OWNER_ACTIVATION_RECEIPT,
  G5_OWNER_APPEND_ONLY_LEDGER as G5_R1_OWNER_APPEND_ONLY_LEDGER,
} from "./domiG5OwnerLongitudinalSeed.mjs";

export const G5_SECOND_REAL_OWNER_ENTRY_ID = "G5-E-0002-REAL";
export const G5_SECOND_REAL_OWNER_OBSERVED_AT = "2026-09-11T11:43:00-03:00";
export const G5_SECOND_REAL_OWNER_SURFACE = "PERSONAL_DESKTOP";
export const G5_SECOND_REAL_OWNER_DATUM = "Prefiero que los proyectos científicos tengan siempre una bitácora clara y un registro de decisiones.";

export const G5_R2_SECOND_OWNER_APPEND_RESULT = appendG5OwnerLedgerDatum(
  G5_R1_OWNER_APPEND_ONLY_LEDGER,
  G5_OWNER_ACTIVATION_RECEIPT,
  {
    entryId: G5_SECOND_REAL_OWNER_ENTRY_ID,
    observedAt: G5_SECOND_REAL_OWNER_OBSERVED_AT,
    surfaceClass: G5_SECOND_REAL_OWNER_SURFACE,
    dataClass: G5_OWNER_DATA_CLASS,
    content: G5_SECOND_REAL_OWNER_DATUM,
    familyData: false,
    holdout: false,
    production: false,
    retroactiveImport: false,
  },
);

if (G5_R2_SECOND_OWNER_APPEND_RESULT.appended !== true) {
  throw new Error("G5_R2_SECOND_OWNER_DATUM_NOT_APPENDED");
}

export const G5_SECOND_REAL_OWNER_ENTRY = G5_R2_SECOND_OWNER_APPEND_RESULT.entry;
export const G5_R2_OWNER_APPEND_ONLY_LEDGER = G5_R2_SECOND_OWNER_APPEND_RESULT.ledger;
export const G5_R2_OWNER_LEDGER_INTEGRITY = assertG5OwnerLedgerIntegrity(
  G5_R2_OWNER_APPEND_ONLY_LEDGER,
  G5_OWNER_ACTIVATION_RECEIPT,
);

if (G5_R2_OWNER_LEDGER_INTEGRITY.pass !== true) {
  throw new Error(`G5_R2_LEDGER_INTEGRITY_HOLD:${G5_R2_OWNER_LEDGER_INTEGRITY.reasons.join("|")}`);
}

export const G5_R2_OWNER_LEDGER_STATE = projectG5OwnerLedgerState(
  G5_R2_OWNER_APPEND_ONLY_LEDGER,
  G5_OWNER_ACTIVATION_RECEIPT,
);

export const G5_R2_OWNER_LONGITUDINAL_STATE = projectG5ActivationState(
  G5_OWNER_ACTIVATION_RECEIPT,
  G5_R2_OWNER_APPEND_ONLY_LEDGER.records.map((record) => record.entry),
);

function readR2Entry(entryId) {
  const entry = readG5OwnerLedgerEntryById(
    G5_R2_OWNER_APPEND_ONLY_LEDGER,
    G5_OWNER_ACTIVATION_RECEIPT,
    entryId,
  );
  return Object.freeze({
    entryId: entry.entryId,
    content: entry.content,
    observedAt: entry.observedAt,
    surfaceClass: entry.surfaceClass,
    prospective: entry.prospective,
    entryFingerprint: entry.entryFingerprint,
    ledgerFingerprint: G5_R2_OWNER_LEDGER_STATE.ledgerFingerprint,
    ledgerHeadRecordFingerprint: G5_R2_OWNER_LEDGER_STATE.headRecordFingerprint,
    appendOnly: G5_R2_OWNER_LEDGER_STATE.appendOnly,
    overwriteAllowed: G5_R2_OWNER_LEDGER_STATE.overwriteAllowed,
    realOwnerMemoryEntryCount: G5_R2_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,
    scientificRootsMinted: G5_R2_OWNER_LONGITUDINAL_STATE.scientificRootsMinted,
  });
}

export function readG5R2FirstOwnerMemory() {
  return readR2Entry(G5_FIRST_REAL_OWNER_ENTRY_ID);
}

export function readG5SecondOwnerMemory() {
  return readR2Entry(G5_SECOND_REAL_OWNER_ENTRY_ID);
}
