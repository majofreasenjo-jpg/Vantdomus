import crypto from "node:crypto";

export const DOMI_G5_R4_ADMISSION_VERSION = "DOMI_G5_R4_PROSPECTIVE_ADMISSION_V0_1";
export const DOMI_G5_R4_NAMESPACE = "DOMI_G5_R4_DELAYED_NONLOCAL_HISTORY_V1";
export const DOMI_G5_R4_G0_COMMIT = "9d2107e1142f689b7e7d728d239f8773f04dae06";
export const DOMI_G5_R4_SOURCE_CLASS = "PROJECT_CONTROLLED_PROSPECTIVE_NONPERSONAL";

const ALLOWED_ROLES = new Set(["REMOTE_ANCHOR", "DISTRACTOR", "ACTIVATION_CUE"]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function r4Sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function admitR4ProspectiveEntry({
  entryId,
  observedAt,
  role,
  semanticClass,
  contentToken,
} = {}) {
  if (typeof entryId !== "string" || !entryId.startsWith("R4-G1-")) {
    throw new Error("R4_ENTRY_ID_NAMESPACE_INVALID");
  }
  if (!ALLOWED_ROLES.has(role)) throw new Error("R4_ROLE_INVALID");
  if (typeof semanticClass !== "string" || semanticClass.trim() === "") {
    throw new Error("R4_SEMANTIC_CLASS_REQUIRED");
  }
  if (typeof contentToken !== "string" || contentToken.trim() === "") {
    throw new Error("R4_CONTENT_TOKEN_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("R4_OBSERVED_AT_INVALID");

  const core = {
    schema: "domi.g5.r4.prospective-entry.v1",
    version: DOMI_G5_R4_ADMISSION_VERSION,
    namespace: DOMI_G5_R4_NAMESPACE,
    g0Commit: DOMI_G5_R4_G0_COMMIT,
    entryId,
    observedAt,
    role,
    semanticClass,
    contentToken,
    sourceClass: DOMI_G5_R4_SOURCE_CLASS,
    prospectiveAfterG0: true,
    personalData: false,
    rawOwnerMemory: false,
    retroactiveImport: false,
    holdout: false,
    production: false,
    scientificEvidenceCredit: 0,
    scientificRootsMinted: 0,
  };

  return Object.freeze({ ...core, entryFingerprint: r4Sha256(core) });
}
