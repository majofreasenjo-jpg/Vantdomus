import {
  createSessionContinuationReceipt,
  consumeSessionContinuationReceipt,
  validateSessionContinuationReceipt,
} from "./domiMultiSurfaceContinuity.mjs";
import {
  closeConversationSession,
  openConversationSession,
} from "./domiLongitudinalConversationSpine.mjs";
import {
  seedP5SyntheticDesktopState,
  P5_SYNTHETIC_PERSON_ID,
  P5_SOURCE_SESSION_ID,
  P5_PRIVATE_MEMORY_ID,
  P5_SHARED_MEMORY_ID,
  P5_PRIVATE_TURN_ID,
  P5_SHARED_TURN_ID,
  P5_QUERY,
  P5_AUTHORIZED_SCOPES,
} from "./domiP5SyntheticFixture.mjs";

export const DOMI_P5_CONTINUITY_RESUME_ARTIFACT_VERSION =
  "DOMI_P5_CONTINUITY_RESUME_ARTIFACT_V0_1";
export const P5_CONTINUITY_RESUME_RECONSTRUCTION_CLASS =
  "P5_DESKTOP_TO_MOBILE_SYNTHETIC_V0_1";
export const P5_CONTINUITY_RESUME_STORAGE_KEY =
  "domi:p5:continuity-resume:v0.1";
export const P5_FORWARD_RECEIPT_PURPOSE =
  "P5 real cross-device synthetic receipt transport";
export const P5_RESUME_TARGET_SESSION_ID = "P5-PHONE-RESUME-1";

const REQUIRED_KEYS = Object.freeze([
  "artifactVersion",
  "reconstructionClass",
  "fixtureBaseTime",
  "receiptId",
  "receiptCreatedAt",
  "receiptExpiresAt",
  "receiptDigest",
  "continuityKey",
  "personId",
  "sourceSessionId",
  "sourceSurfaceClass",
  "targetSurfaceClass",
  "artifactDigest",
]);
const ALLOWED_KEYS = new Set(REQUIRED_KEYS);
const DIGEST_RE = /^fnv1a32:[0-9a-f]{8}$/;
const RECEIPT_ID_RE = /^P5-[A-Za-z0-9_-]{1,96}$/;

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function stableDigest(value) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function normalizeIso(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function coreWithoutDigest(artifact) {
  const core = {};
  for (const key of REQUIRED_KEYS) {
    if (key !== "artifactDigest") core[key] = artifact?.[key];
  }
  return core;
}

function prohibitedFailureForKey(key) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("rawmemory")) return "RAW_MEMORY_PERSISTENCE_FORBIDDEN";
  if (normalized.includes("rawtranscript") || normalized.includes("transcriptraw")) {
    return "RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN";
  }
  if (normalized.includes("fullstate")) return "FULL_STATE_PERSISTENCE_FORBIDDEN";
  if (normalized.includes("authority")) return "AUTHORITY_PERSISTENCE_FORBIDDEN";
  if (normalized.includes("unboundedcontext")) return "UNBOUNDED_CONTEXT_PERSISTENCE_FORBIDDEN";
  return null;
}

function assertForwardReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") throw new Error("RECEIPT_REQUIRED");
  if (receipt.personId !== P5_SYNTHETIC_PERSON_ID) throw new Error("P5_RESUME_PERSON_MISMATCH");
  if (receipt.sourceSessionId !== P5_SOURCE_SESSION_ID) throw new Error("P5_RESUME_SOURCE_SESSION_MISMATCH");
  if (receipt.sourceSurfaceClass !== "PERSONAL_DESKTOP") throw new Error("P5_RESUME_SOURCE_SURFACE_MISMATCH");
  if (receipt.targetSurfaceClass !== "PERSONAL_MOBILE") throw new Error("P5_RESUME_TARGET_SURFACE_MISMATCH");
  if (receipt.purpose !== P5_FORWARD_RECEIPT_PURPOSE) throw new Error("P5_RESUME_PURPOSE_MISMATCH");
  if (receipt.rawMemoryContentIncluded !== false) throw new Error("RAW_MEMORY_PERSISTENCE_FORBIDDEN");
  if (receipt.rawTranscriptContentIncluded !== false) throw new Error("RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN");
  if (receipt.fullStateCopied !== false) throw new Error("FULL_STATE_PERSISTENCE_FORBIDDEN");
  if (receipt.providerAuthorityTransferred !== false || receipt.authorityMayExpand !== false) {
    throw new Error("AUTHORITY_PERSISTENCE_FORBIDDEN");
  }
  const validation = validateSessionContinuationReceipt(receipt, {
    now: receipt.createdAt,
    expectedPersonId: P5_SYNTHETIC_PERSON_ID,
    expectedTargetSurfaceClass: "PERSONAL_MOBILE",
  });
  if (!validation.pass) {
    throw new Error(`P5_RESUME_RECEIPT_INVALID:${validation.failures.join("|")}`);
  }
}

export function validateP5ContinuityResumeArtifact(artifact, {
  now,
  expectedSourceSurfaceClass = "PERSONAL_DESKTOP",
  expectedTargetSurfaceClass = "PERSONAL_MOBILE",
  expectedContinuityKey = null,
} = {}) {
  const failures = [];
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return Object.freeze({ pass: false, failures: Object.freeze(["P5_RESUME_ARTIFACT_REQUIRED"]) });
  }

  for (const key of Object.keys(artifact)) {
    const prohibited = prohibitedFailureForKey(key);
    if (prohibited && !failures.includes(prohibited)) failures.push(prohibited);
    if (!ALLOWED_KEYS.has(key)) failures.push(`UNEXPECTED_FIELD:${key}`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in artifact)) failures.push(`REQUIRED_FIELD_MISSING:${key}`);
  }

  if (artifact.artifactVersion !== DOMI_P5_CONTINUITY_RESUME_ARTIFACT_VERSION) failures.push("ARTIFACT_VERSION_MISMATCH");
  if (artifact.reconstructionClass !== P5_CONTINUITY_RESUME_RECONSTRUCTION_CLASS) failures.push("RECONSTRUCTION_CLASS_MISMATCH");
  if (artifact.personId !== P5_SYNTHETIC_PERSON_ID) failures.push("PERSON_MISMATCH");
  if (artifact.sourceSessionId !== P5_SOURCE_SESSION_ID) failures.push("SOURCE_SESSION_MISMATCH");
  if (artifact.sourceSurfaceClass !== "PERSONAL_DESKTOP") failures.push("SOURCE_SURFACE_INVALID");
  if (artifact.targetSurfaceClass !== "PERSONAL_MOBILE") failures.push("TARGET_SURFACE_INVALID");
  if (!RECEIPT_ID_RE.test(String(artifact.receiptId ?? ""))) failures.push("RECEIPT_ID_INVALID");
  if (!DIGEST_RE.test(String(artifact.receiptDigest ?? ""))) failures.push("RECEIPT_DIGEST_INVALID");
  if (!DIGEST_RE.test(String(artifact.continuityKey ?? ""))) failures.push("CONTINUITY_KEY_INVALID");
  if (!DIGEST_RE.test(String(artifact.artifactDigest ?? ""))) failures.push("ARTIFACT_DIGEST_INVALID");

  const fixtureBaseTime = normalizeIso(artifact.fixtureBaseTime);
  const createdAt = normalizeIso(artifact.receiptCreatedAt);
  const expiresAt = normalizeIso(artifact.receiptExpiresAt);
  if (!fixtureBaseTime) failures.push("FIXTURE_BASE_TIME_INVALID");
  if (!createdAt) failures.push("RECEIPT_CREATED_AT_INVALID");
  if (!expiresAt) failures.push("RECEIPT_EXPIRES_AT_INVALID");
  if (fixtureBaseTime && createdAt && fixtureBaseTime > createdAt) failures.push("FIXTURE_BASE_AFTER_RECEIPT_CREATION");
  if (createdAt && expiresAt && expiresAt <= createdAt) failures.push("RECEIPT_EXPIRY_NOT_AFTER_CREATION");

  if (expectedSourceSurfaceClass !== null && artifact.sourceSurfaceClass !== expectedSourceSurfaceClass) {
    failures.push("SOURCE_SURFACE_MISMATCH");
  }
  if (expectedTargetSurfaceClass !== null && artifact.targetSurfaceClass !== expectedTargetSurfaceClass) {
    failures.push("TARGET_SURFACE_MISMATCH");
  }
  if (expectedContinuityKey !== null && artifact.continuityKey !== expectedContinuityKey) {
    failures.push("CONTINUITY_KEY_MISMATCH");
  }

  if (Object.keys(artifact).every((key) => ALLOWED_KEYS.has(key)) && REQUIRED_KEYS.every((key) => key in artifact)) {
    const expectedArtifactDigest = stableDigest(coreWithoutDigest(artifact));
    if (artifact.artifactDigest !== expectedArtifactDigest) failures.push("ARTIFACT_DIGEST_MISMATCH");
  }

  if (now !== undefined) {
    const nowIso = normalizeIso(now);
    if (!nowIso) {
      failures.push("RESUME_TIME_INVALID");
    } else {
      if (createdAt && nowIso < createdAt) failures.push("ARTIFACT_NOT_YET_VALID");
      if (expiresAt && nowIso >= expiresAt) failures.push("ARTIFACT_EXPIRED");
    }
  }

  return Object.freeze({
    pass: failures.length === 0,
    failures: Object.freeze(failures),
    continuityKey: artifact.continuityKey ?? null,
    receiptDigest: artifact.receiptDigest ?? null,
  });
}

export function createP5ContinuityResumeArtifact({ receipt, fixtureBaseTime }) {
  assertForwardReceipt(receipt);
  const normalizedBaseTime = normalizeIso(fixtureBaseTime);
  if (!normalizedBaseTime) throw new Error("FIXTURE_BASE_TIME_INVALID");

  const core = {
    artifactVersion: DOMI_P5_CONTINUITY_RESUME_ARTIFACT_VERSION,
    reconstructionClass: P5_CONTINUITY_RESUME_RECONSTRUCTION_CLASS,
    fixtureBaseTime: normalizedBaseTime,
    receiptId: receipt.receiptId,
    receiptCreatedAt: receipt.createdAt,
    receiptExpiresAt: receipt.expiresAt,
    receiptDigest: receipt.receiptDigest,
    continuityKey: receipt.continuityKey,
    personId: receipt.personId,
    sourceSessionId: receipt.sourceSessionId,
    sourceSurfaceClass: receipt.sourceSurfaceClass,
    targetSurfaceClass: receipt.targetSurfaceClass,
  };
  const artifact = Object.freeze({ ...core, artifactDigest: stableDigest(core) });
  const validation = validateP5ContinuityResumeArtifact(artifact, {
    now: receipt.createdAt,
    expectedContinuityKey: receipt.continuityKey,
  });
  if (!validation.pass) {
    throw new Error(`P5_RESUME_ARTIFACT_INVALID:${validation.failures.join("|")}`);
  }
  return artifact;
}

export function serializeP5ContinuityResumeArtifact(artifact) {
  const validation = validateP5ContinuityResumeArtifact(artifact, {
    now: artifact?.receiptCreatedAt,
  });
  if (!validation.pass) {
    throw new Error(`P5_RESUME_ARTIFACT_INVALID:${validation.failures.join("|")}`);
  }
  return JSON.stringify(artifact);
}

export function parseP5ContinuityResumeArtifact(serialized) {
  if (typeof serialized !== "string" || serialized.trim() === "") {
    throw new Error("P5_RESUME_ARTIFACT_REQUIRED");
  }
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("P5_RESUME_ARTIFACT_INVALID");
  }
  const validation = validateP5ContinuityResumeArtifact(parsed);
  if (!validation.pass) {
    throw new Error(`P5_RESUME_ARTIFACT_INVALID:${validation.failures.join("|")}`);
  }
  return Object.freeze(parsed);
}

export function reconstructP5ContinuityFromResumeArtifact(artifact, {
  now,
  targetSessionId = P5_RESUME_TARGET_SESSION_ID,
} = {}) {
  const resumeValidation = validateP5ContinuityResumeArtifact(artifact, {
    now,
    expectedSourceSurfaceClass: "PERSONAL_DESKTOP",
    expectedTargetSurfaceClass: "PERSONAL_MOBILE",
  });
  if (!resumeValidation.pass) {
    throw new Error(`P5_RESUME_ARTIFACT_INVALID:${resumeValidation.failures.join("|")}`);
  }

  let state = seedP5SyntheticDesktopState({ baseTime: artifact.fixtureBaseTime });
  const reconstructedReceipt = createSessionContinuationReceipt(state, {
    receiptId: artifact.receiptId,
    sourceSessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    targetSurfaceClass: "PERSONAL_MOBILE",
    purpose: P5_FORWARD_RECEIPT_PURPOSE,
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
    transferableTurnIds: [P5_PRIVATE_TURN_ID, P5_SHARED_TURN_ID],
    createdAt: artifact.receiptCreatedAt,
    expiresAt: artifact.receiptExpiresAt,
  });

  if (reconstructedReceipt.receiptDigest !== artifact.receiptDigest) {
    throw new Error("RECONSTRUCTED_RECEIPT_DIGEST_MISMATCH");
  }
  if (reconstructedReceipt.continuityKey !== artifact.continuityKey) {
    throw new Error("RECONSTRUCTED_CONTINUITY_KEY_MISMATCH");
  }

  const receiptValidation = validateSessionContinuationReceipt(reconstructedReceipt, {
    now,
    expectedPersonId: P5_SYNTHETIC_PERSON_ID,
    expectedTargetSurfaceClass: "PERSONAL_MOBILE",
  });
  if (!receiptValidation.pass) {
    throw new Error(`RECONSTRUCTED_RECEIPT_INVALID:${receiptValidation.failures.join("|")}`);
  }

  state = closeConversationSession(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    endedAt: artifact.receiptCreatedAt,
  });
  state = openConversationSession(state, {
    sessionId: targetSessionId,
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: now,
  });
  const consumption = consumeSessionContinuationReceipt(state, {
    receipt: reconstructedReceipt,
    targetSessionId,
    now,
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
  });
  const expectedIds = [P5_PRIVATE_MEMORY_ID, P5_SHARED_MEMORY_ID].sort();
  const recoveredIds = [...consumption.memoryIds].sort();

  return Object.freeze({
    resumeValidation,
    receiptValidation,
    reconstructedReceipt,
    consumption,
    checks: Object.freeze({
      expectedSyntheticReferencesRecovered:
        JSON.stringify(recoveredIds) === JSON.stringify(expectedIds),
      continuityKeyStable:
        consumption.continuityKey === artifact.continuityKey,
      rawMemoryPersisted: false,
      rawTranscriptPersisted: false,
      fullStatePersisted: false,
      authorityPersisted: false,
      productionMutation: false,
    }),
  });
}
