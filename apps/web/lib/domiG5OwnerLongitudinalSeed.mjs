import {
  G5_OWNER_DATA_CLASS,
  createG5OwnerActivationReceipt,
  admitG5ProspectiveOwnerDatum,
  projectG5ActivationState,
} from "./domiG5OwnerActivation.mjs";

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

export const G5_OWNER_LONGITUDINAL_STATE = projectG5ActivationState(
  G5_OWNER_ACTIVATION_RECEIPT,
  [G5_FIRST_REAL_OWNER_ENTRY],
);

export function readG5FirstOwnerMemory() {
  return Object.freeze({
    entryId: G5_FIRST_REAL_OWNER_ENTRY.entryId,
    content: G5_FIRST_REAL_OWNER_ENTRY.content,
    observedAt: G5_FIRST_REAL_OWNER_ENTRY.observedAt,
    surfaceClass: G5_FIRST_REAL_OWNER_ENTRY.surfaceClass,
    prospective: G5_FIRST_REAL_OWNER_ENTRY.prospective,
    entryFingerprint: G5_FIRST_REAL_OWNER_ENTRY.entryFingerprint,
    realOwnerMemoryEntryCount: G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,
    scientificRootsMinted: G5_OWNER_LONGITUDINAL_STATE.scientificRootsMinted,
  });
}
