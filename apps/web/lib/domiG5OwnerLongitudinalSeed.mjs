import {
  G5_OWNER_DATA_CLASS,
  createG5OwnerActivationReceipt,
  admitG5ProspectiveOwnerDatum,
  projectG5ActivationState,
} from "./domiG5OwnerActivation.mjs";
import {
  createG5OwnerAppendOnlyLedger,
  readG5OwnerLedgerEntryById,
  projectG5OwnerLedgerState,
} from "./domiG5OwnerAppendOnlyLedger.mjs";

export const G5_FIRST_REAL_OWNER_ENTRY_ID = "G5-E-0001-REAL";
export const G5_FIRST_REAL_OWNER_OBSERVED_AT = "2026-09-07T14:14:00-03:00";
export const G5_FIRST_REAL_OWNER_SURFACE = "PERSONAL_DESKTOP";
export const G5_FIRST_REAL_OWNER_DATUM = "Debes recordar que todo esfuerzo siempre será bien recompensado";

export const G5_OWNER_ACTIVATION_RECEIPT = createG5OwnerActivationReceipt();

export const G5_FIRST_REAL_OWNER_ENTRY = admitG5ProspectiveOwnerDatum(
  G5_OWNER_ACTIVATION_RECEIPT,
  {
    entryId: G5_FIRST_REAL_OWNER_ENTRY_ID,
    observedAt: G5_FIRST_REAL_OWNER_OBSERVED_AT,
    surfaceClass: G5_FIRST_REAL_OWNER_SURFACE,
    dataClass: G5_OWNER_DATA_CLASS,
    content: G5_FIRST_REAL_OWNER_DATUM,
    familyData: false,
    holdout: false,
    production: false,
    retroactiveImport: false,
  },
);

export const G5_OWNER_APPEND_ONLY_LEDGER = createG5OwnerAppendOnlyLedger(
  G5_OWNER_ACTIVATION_RECEIPT,
  [G5_FIRST_REAL_OWNER_ENTRY],
);

export const G5_OWNER_LEDGER_STATE = projectG5OwnerLedgerState(
  G5_OWNER_APPEND_ONLY_LEDGER,
  G5_OWNER_ACTIVATION_RECEIPT,
);

export const G5_OWNER_LONGITUDINAL_STATE = projectG5ActivationState(
  G5_OWNER_ACTIVATION_RECEIPT,
  G5_OWNER_APPEND_ONLY_LEDGER.records.map((record) => record.entry),
);

export function readG5FirstOwnerMemory() {
  const entry = readG5OwnerLedgerEntryById(
    G5_OWNER_APPEND_ONLY_LEDGER,
    G5_OWNER_ACTIVATION_RECEIPT,
    G5_FIRST_REAL_OWNER_ENTRY_ID,
  );
  return Object.freeze({
    entryId: entry.entryId,
    content: entry.content,
    observedAt: entry.observedAt,
    surfaceClass: entry.surfaceClass,
    prospective: entry.prospective,
    entryFingerprint: entry.entryFingerprint,
    ledgerFingerprint: G5_OWNER_LEDGER_STATE.ledgerFingerprint,
    ledgerHeadRecordFingerprint: G5_OWNER_LEDGER_STATE.headRecordFingerprint,
    appendOnly: G5_OWNER_LEDGER_STATE.appendOnly,
    overwriteAllowed: G5_OWNER_LEDGER_STATE.overwriteAllowed,
    realOwnerMemoryEntryCount: G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,
    scientificRootsMinted: G5_OWNER_LONGITUDINAL_STATE.scientificRootsMinted,
  });
}
