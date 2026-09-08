import {
  G5_OWNER_ACTIVATION_RECEIPT,
  G5_OWNER_APPEND_ONLY_LEDGER,
  G5_OWNER_LEDGER_STATE,
  G5_OWNER_LONGITUDINAL_STATE,
  readG5FirstOwnerMemory,
} from "./domiG5OwnerLongitudinalSeed.mjs";
import {
  assertG5OwnerLedgerIntegrity,
} from "./domiG5OwnerAppendOnlyLedger.mjs";

export const DOMI_G5_MICR_R888_ASSURANCE_VERSION = "DOMI_G5_MICR_R8_88_RECALL_ASSURANCE_V0_1";

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}

export function secondaryReadG5OwnerEntryById(entryId) {
  if (typeof entryId !== "string" || entryId.trim() === "") {
    throw new Error("G5_R888_SECONDARY_ENTRY_ID_REQUIRED");
  }
  const integrity = assertG5OwnerLedgerIntegrity(
    G5_OWNER_APPEND_ONLY_LEDGER,
    G5_OWNER_ACTIVATION_RECEIPT,
  );
  if (!integrity.pass) {
    throw new Error(`G5_R888_SECONDARY_LEDGER_INTEGRITY_HOLD:${integrity.reasons.join("|")}`);
  }
  const normalized = entryId.trim();
  let found = null;
  for (const record of G5_OWNER_APPEND_ONLY_LEDGER.records) {
    if (record.entry.entryId === normalized) {
      if (found) throw new Error("G5_R888_SECONDARY_DUPLICATE_ENTRY_ID");
      found = record.entry;
    }
  }
  if (!found) throw new Error("G5_R888_SECONDARY_ENTRY_NOT_FOUND_FAIL_CLOSED");
  return found;
}

export function buildG5RecallSourceCertificate({
  entryId,
  readSurface = "PREVIEW_RECALL_SURFACE",
  readObservedAt = null,
} = {}) {
  const primary = readG5FirstOwnerMemory();
  if (entryId && entryId !== primary.entryId) {
    throw new Error("G5_R888_PRIMARY_ENTRY_ID_MISMATCH");
  }
  const secondary = secondaryReadG5OwnerEntryById(primary.entryId);
  const integrity = assertG5OwnerLedgerIntegrity(
    G5_OWNER_APPEND_ONLY_LEDGER,
    G5_OWNER_ACTIVATION_RECEIPT,
  );
  if (!integrity.pass) {
    throw new Error(`G5_R888_LEDGER_INTEGRITY_HOLD:${integrity.reasons.join("|")}`);
  }

  const agreement =
    primary.entryId === secondary.entryId &&
    primary.entryFingerprint === secondary.entryFingerprint &&
    primary.content === secondary.content &&
    primary.observedAt === secondary.observedAt &&
    primary.surfaceClass === secondary.surfaceClass;

  if (!agreement) throw new Error("G5_R888_PRIMARY_SECONDARY_SOURCE_DISAGREEMENT");

  return freezeDeep({
    schema: "domi.g5.micr-r8-88-recall-source-certificate.v1",
    version: DOMI_G5_MICR_R888_ASSURANCE_VERSION,
    entryId: primary.entryId,
    entryFingerprint: primary.entryFingerprint,
    ledgerFingerprint: G5_OWNER_LEDGER_STATE.ledgerFingerprint,
    ledgerHeadRecordFingerprint: G5_OWNER_LEDGER_STATE.headRecordFingerprint,
    entryCount: G5_OWNER_LEDGER_STATE.entryCount,
    sourceObservedAt: primary.observedAt,
    sourceSurface: primary.surfaceClass,
    readSurface,
    readObservedAt,
    primarySecondarySourceAgreement: true,
    ledgerIntegrityPass: true,
    canonicalStateSeparatedFromRendering: true,
    readMutatesLedger: false,
    realOwnerMemoryEntryCount: G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,
    scientificRootsMinted: 0,
    production: false,
  });
}

export function projectG5MemoryFunctionalUseStatus() {
  return freezeDeep({
    recallEstablished: true,
    memoryFunctionalUseEstablished: false,
    heldOutDownstreamTaskFrozen: false,
    matchedInformationAblationCompleted: false,
    postHocRetuningAllowed: false,
    sameBankRescueAllowed: false,
    scientificRootsMinted: 0,
    production: false,
    reason: "RECALL_ESTABLISHED_BUT_FUNCTIONAL_USE_REQUIRES_FUTURE_HELD_OUT_ABLATION_BACKED_TASK",
  });
}

export function assertG5RecallReadIsNonMutating() {
  const before = Object.freeze({
    ledgerFingerprint: G5_OWNER_LEDGER_STATE.ledgerFingerprint,
    ledgerHeadRecordFingerprint: G5_OWNER_LEDGER_STATE.headRecordFingerprint,
    entryCount: G5_OWNER_LEDGER_STATE.entryCount,
  });
  readG5FirstOwnerMemory();
  secondaryReadG5OwnerEntryById("G5-E-0001-REAL");
  const after = Object.freeze({
    ledgerFingerprint: G5_OWNER_LEDGER_STATE.ledgerFingerprint,
    ledgerHeadRecordFingerprint: G5_OWNER_LEDGER_STATE.headRecordFingerprint,
    entryCount: G5_OWNER_LEDGER_STATE.entryCount,
  });
  return freezeDeep({
    pass:
      before.ledgerFingerprint === after.ledgerFingerprint &&
      before.ledgerHeadRecordFingerprint === after.ledgerHeadRecordFingerprint &&
      before.entryCount === after.entryCount,
    before,
    after,
    scientificRootsMinted: 0,
  });
}
