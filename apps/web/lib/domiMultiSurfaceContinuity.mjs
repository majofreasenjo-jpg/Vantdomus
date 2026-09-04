import {
  buildLongitudinalContext,
  CLAIM_WALL,
} from "./domiLongitudinalConversationSpine.mjs";

export const DOMI_MULTI_SURFACE_CONTINUITY_VERSION =
  "DOMI_MULTI_SURFACE_CONTINUITY_V0_1";

export const DOMI_SURFACE_HANDOFF_PROTOCOL_VERSION =
  "DOMI_SURFACE_HANDOFF_PROTOCOL_V0_1";

const KNOWN_MEMORY_SCOPES = Object.freeze([
  "private_self",
  "guardian_supervised",
  "household_shared",
  "owner_operational",
  "temporary_session",
  "document_derived",
]);

const SURFACE_PROFILES = Object.freeze({
  PERSONAL_DESKTOP: Object.freeze({
    surfaceClass: "PERSONAL_DESKTOP",
    sharedSurface: false,
    attentionClass: "FULL",
    memoryScopes: Object.freeze([...KNOWN_MEMORY_SCOPES]),
    maxTransferTurnIds: 12,
  }),
  PERSONAL_MOBILE: Object.freeze({
    surfaceClass: "PERSONAL_MOBILE",
    sharedSurface: false,
    attentionClass: "BOUNDED",
    memoryScopes: Object.freeze([...KNOWN_MEMORY_SCOPES]),
    maxTransferTurnIds: 8,
  }),
  SHARED_TV: Object.freeze({
    surfaceClass: "SHARED_TV",
    sharedSurface: true,
    attentionClass: "SHARED",
    memoryScopes: Object.freeze(["household_shared", "document_derived"]),
    maxTransferTurnIds: 0,
  }),
  OTHER: Object.freeze({
    surfaceClass: "OTHER",
    sharedSurface: true,
    attentionClass: "MINIMAL_FAIL_CLOSED",
    memoryScopes: Object.freeze(["household_shared", "document_derived"]),
    maxTransferTurnIds: 0,
  }),
});

function clone(value) {
  return structuredClone(value);
}

function assertNonEmpty(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  return value.trim();
}

function normalizeTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_TIMESTAMP");
  return parsed.toISOString();
}

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

function assertLongitudinalState(state) {
  if (!state || typeof state !== "object") throw new Error("LONGITUDINAL_STATE_REQUIRED");
  if (!Array.isArray(state.sessions) || !Array.isArray(state.turns) || !Array.isArray(state.memories)) {
    throw new Error("LONGITUDINAL_STATE_SHAPE_INVALID");
  }
  assertNonEmpty(state.lineageId, "LINEAGE_ID_REQUIRED");
}

function getSession(state, sessionId) {
  const session = state.sessions.find((item) => item.sessionId === sessionId);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  return session;
}

export function getSurfaceCapabilityProfile(surfaceClass) {
  const profile = SURFACE_PROFILES[surfaceClass];
  if (!profile) throw new Error("SURFACE_CLASS_NOT_ALLOWED");
  return profile;
}

function effectiveScopesForSurface(authorizedScopes, surfaceClass) {
  const profile = getSurfaceCapabilityProfile(surfaceClass);
  const requested = new Set(
    (authorizedScopes ?? []).filter((scope) => KNOWN_MEMORY_SCOPES.includes(scope)),
  );
  return profile.memoryScopes.filter((scope) => requested.has(scope));
}

function virtualStateForSurface(state, { personId, surfaceClass, now, virtualSessionId }) {
  const projectedState = clone(state);
  if (projectedState.sessions.some((session) => session.sessionId === virtualSessionId)) {
    throw new Error("VIRTUAL_SESSION_COLLISION");
  }
  projectedState.sessions.push({
    sessionId: virtualSessionId,
    personId,
    surfaceClass,
    startedAt: normalizeTimestamp(now),
    endedAt: null,
    virtualProjection: true,
  });
  return projectedState;
}

export function createContextProjection(inputState, {
  personId,
  surfaceClass,
  query = "",
  now,
  authorizedScopes = [],
  sourceSessionId = null,
  memoryLimit = 8,
  threadLimit = 4,
}) {
  assertLongitudinalState(inputState);
  const state = clone(inputState);
  const resolvedPersonId = assertNonEmpty(personId, "PERSON_ID_REQUIRED");
  const profile = getSurfaceCapabilityProfile(surfaceClass);
  const nowIso = normalizeTimestamp(now);
  if (sourceSessionId !== null) {
    const sourceSession = getSession(state, sourceSessionId);
    if (sourceSession.personId !== resolvedPersonId) throw new Error("SOURCE_SESSION_PERSON_MISMATCH");
  }

  const effectiveScopes = effectiveScopesForSurface(authorizedScopes, surfaceClass);
  const virtualSessionId = `P4-PROJECTION-${stableDigest({
    lineageId: state.lineageId,
    personId: resolvedPersonId,
    surfaceClass,
    now: nowIso,
    sourceSessionId,
    headEventId: state.headEventId ?? null,
  }).replace(":", "-")}`;
  const projectedState = virtualStateForSurface(state, {
    personId: resolvedPersonId,
    surfaceClass,
    now: nowIso,
    virtualSessionId,
  });
  const longitudinal = buildLongitudinalContext(projectedState, {
    sessionId: virtualSessionId,
    personId: resolvedPersonId,
    query,
    now: nowIso,
    authorizedScopes: effectiveScopes,
    memoryLimit,
    threadLimit,
  });

  const core = {
    version: DOMI_MULTI_SURFACE_CONTINUITY_VERSION,
    lineageId: state.lineageId,
    personId: resolvedPersonId,
    sourceSessionId,
    targetSurfaceClass: surfaceClass,
    sharedSurface: profile.sharedSurface,
    attentionClass: profile.attentionClass,
    query: String(query ?? ""),
    effectiveScopes: [...effectiveScopes],
    memoryIds: [...longitudinal.memoryIds],
    pendingThreadIds: [...longitudinal.pendingThreadIds],
    sourceHeadEventId: state.headEventId ?? null,
    longitudinalContextFingerprint: longitudinal.contextFingerprint,
    fullStateCopied: false,
    rawTranscriptCopied: false,
    providerAuthorityTransferred: false,
  };

  return Object.freeze({
    ...core,
    memories: longitudinal.memories,
    pendingThreads: longitudinal.pendingThreads,
    projectionFingerprint: stableDigest(core),
    claimWall: CLAIM_WALL,
  });
}

function normalizeTransferableTurnIds(state, sourceSessionId, requestedTurnIds, targetSurfaceClass) {
  const profile = getSurfaceCapabilityProfile(targetSurfaceClass);
  if (profile.maxTransferTurnIds === 0) return [];
  const seen = new Set();
  const valid = [];
  for (const turnId of requestedTurnIds ?? []) {
    if (typeof turnId !== "string" || turnId.trim() === "" || seen.has(turnId)) continue;
    const turn = state.turns.find((item) => item.turnId === turnId);
    if (!turn) throw new Error("TRANSFER_TURN_NOT_FOUND");
    if (turn.sessionId !== sourceSessionId) throw new Error("TRANSFER_TURN_SESSION_MISMATCH");
    seen.add(turnId);
    valid.push(turnId);
  }
  return valid.slice(-profile.maxTransferTurnIds);
}

function receiptDigest(receipt) {
  const { receiptDigest: _ignored, ...core } = receipt;
  return stableDigest(core);
}

export function createSessionContinuationReceipt(inputState, {
  receiptId,
  sourceSessionId,
  personId,
  targetSurfaceClass,
  purpose,
  query = "",
  authorizedScopes = [],
  transferableTurnIds = [],
  createdAt,
  expiresAt,
}) {
  assertLongitudinalState(inputState);
  const state = clone(inputState);
  const source = getSession(state, sourceSessionId);
  const resolvedPersonId = assertNonEmpty(personId, "PERSON_ID_REQUIRED");
  if (source.personId !== resolvedPersonId) throw new Error("SOURCE_SESSION_PERSON_MISMATCH");
  const targetProfile = getSurfaceCapabilityProfile(targetSurfaceClass);
  const createdAtIso = normalizeTimestamp(createdAt);
  const expiresAtIso = normalizeTimestamp(expiresAt);
  if (expiresAtIso <= createdAtIso) throw new Error("RECEIPT_EXPIRY_NOT_AFTER_CREATION");

  const projection = createContextProjection(state, {
    personId: resolvedPersonId,
    surfaceClass: targetSurfaceClass,
    query,
    now: createdAtIso,
    authorizedScopes,
    sourceSessionId,
  });
  const turnIds = normalizeTransferableTurnIds(
    state,
    sourceSessionId,
    transferableTurnIds,
    targetSurfaceClass,
  );
  const continuityKey = stableDigest({
    lineageId: state.lineageId,
    personId: resolvedPersonId,
  });

  const core = {
    protocolVersion: DOMI_SURFACE_HANDOFF_PROTOCOL_VERSION,
    receiptId: assertNonEmpty(receiptId, "RECEIPT_ID_REQUIRED"),
    status: "ACTIVE",
    lineageId: state.lineageId,
    continuityKey,
    personId: resolvedPersonId,
    sourceSessionId,
    sourceSurfaceClass: source.surfaceClass,
    targetSurfaceClass,
    targetSharedSurface: targetProfile.sharedSurface,
    purpose: assertNonEmpty(purpose, "PURPOSE_REQUIRED"),
    query: String(query ?? ""),
    createdAt: createdAtIso,
    expiresAt: expiresAtIso,
    revocable: true,
    revokedAt: null,
    revocationReason: null,
    memoryScopes: [...projection.effectiveScopes],
    projectedMemoryIds: [...projection.memoryIds],
    projectedPendingThreadIds: [...projection.pendingThreadIds],
    transferableTurnIds: turnIds,
    conversationTransferClass: "TURN_IDS_ONLY_NO_RAW_TRANSCRIPT",
    projectionFingerprint: projection.projectionFingerprint,
    sourceHeadEventId: state.headEventId ?? null,
    identityRecreated: false,
    fullStateCopied: false,
    rawMemoryContentIncluded: false,
    rawTranscriptContentIncluded: false,
    authorityMayExpand: false,
    providerAuthorityTransferred: false,
    deviceIsPerson: false,
    claimWall: CLAIM_WALL,
  };
  return Object.freeze({ ...core, receiptDigest: stableDigest(core) });
}

export function validateSessionContinuationReceipt(receipt, {
  now,
  expectedLineageId = null,
  expectedPersonId = null,
  expectedTargetSurfaceClass = null,
} = {}) {
  const failures = [];
  if (!receipt || typeof receipt !== "object") {
    return Object.freeze({ pass: false, failures: Object.freeze(["RECEIPT_REQUIRED"]) });
  }
  if (receipt.protocolVersion !== DOMI_SURFACE_HANDOFF_PROTOCOL_VERSION) failures.push("PROTOCOL_VERSION_MISMATCH");
  if (receiptDigest(receipt) !== receipt.receiptDigest) failures.push("RECEIPT_DIGEST_MISMATCH");
  if (receipt.status !== "ACTIVE") failures.push("RECEIPT_NOT_ACTIVE");
  if (receipt.revocable !== true) failures.push("RECEIPT_NOT_REVOCABLE");
  if (receipt.identityRecreated !== false) failures.push("IDENTITY_RECREATION_FORBIDDEN");
  if (receipt.fullStateCopied !== false) failures.push("FULL_STATE_COPY_FORBIDDEN");
  if (receipt.rawMemoryContentIncluded !== false) failures.push("RAW_MEMORY_IN_RECEIPT_FORBIDDEN");
  if (receipt.rawTranscriptContentIncluded !== false) failures.push("RAW_TRANSCRIPT_IN_RECEIPT_FORBIDDEN");
  if (receipt.authorityMayExpand !== false) failures.push("AUTHORITY_EXPANSION_FORBIDDEN");
  if (receipt.providerAuthorityTransferred !== false) failures.push("PROVIDER_AUTHORITY_TRANSFER_FORBIDDEN");
  if (receipt.deviceIsPerson !== false) failures.push("DEVICE_PERSON_CONFUSION");

  let profile = null;
  try {
    profile = getSurfaceCapabilityProfile(receipt.targetSurfaceClass);
  } catch {
    failures.push("TARGET_SURFACE_INVALID");
  }
  if (profile) {
    for (const scope of receipt.memoryScopes ?? []) {
      if (!profile.memoryScopes.includes(scope)) failures.push(`TARGET_SCOPE_NOT_ALLOWED:${scope}`);
    }
    if ((receipt.transferableTurnIds?.length ?? 0) > profile.maxTransferTurnIds) {
      failures.push("TRANSFER_TURN_LIMIT_EXCEEDED");
    }
  }

  if (now !== undefined) {
    try {
      const nowIso = normalizeTimestamp(now);
      if (typeof receipt.expiresAt !== "string" || nowIso >= receipt.expiresAt) failures.push("RECEIPT_EXPIRED");
      if (typeof receipt.createdAt !== "string" || nowIso < receipt.createdAt) failures.push("RECEIPT_NOT_YET_VALID");
    } catch {
      failures.push("RECEIPT_TIME_INVALID");
    }
  }
  if (expectedLineageId !== null && receipt.lineageId !== expectedLineageId) failures.push("LINEAGE_MISMATCH");
  if (expectedPersonId !== null && receipt.personId !== expectedPersonId) failures.push("PERSON_MISMATCH");
  if (expectedTargetSurfaceClass !== null && receipt.targetSurfaceClass !== expectedTargetSurfaceClass) {
    failures.push("TARGET_SURFACE_MISMATCH");
  }

  return Object.freeze({
    pass: failures.length === 0,
    failures: Object.freeze(failures),
    receiptId: receipt.receiptId ?? null,
    continuityKey: receipt.continuityKey ?? null,
    claimWall: CLAIM_WALL,
  });
}

export function revokeSessionContinuationReceipt(receipt, { revokedAt, reason }) {
  const next = {
    ...clone(receipt),
    status: "REVOKED",
    revokedAt: normalizeTimestamp(revokedAt),
    revocationReason: assertNonEmpty(reason, "REVOCATION_REASON_REQUIRED"),
  };
  delete next.receiptDigest;
  return Object.freeze({ ...next, receiptDigest: stableDigest(next) });
}

export function consumeSessionContinuationReceipt(inputState, {
  receipt,
  targetSessionId,
  now,
  query = null,
  authorizedScopes = [],
}) {
  assertLongitudinalState(inputState);
  const state = clone(inputState);
  const targetSession = getSession(state, targetSessionId);
  const validation = validateSessionContinuationReceipt(receipt, {
    now,
    expectedLineageId: state.lineageId,
    expectedPersonId: targetSession.personId,
    expectedTargetSurfaceClass: targetSession.surfaceClass,
  });
  if (!validation.pass) throw new Error(`SESSION_CONTINUATION_RECEIPT_INVALID:${validation.failures.join("|")}`);
  if (targetSession.endedAt) throw new Error("TARGET_SESSION_CLOSED");

  const allowedByReceipt = new Set(receipt.memoryScopes ?? []);
  const effectiveScopes = (authorizedScopes ?? []).filter((scope) => allowedByReceipt.has(scope));
  const liveContext = buildLongitudinalContext(state, {
    sessionId: targetSessionId,
    personId: targetSession.personId,
    query: query === null ? receipt.query : query,
    now,
    authorizedScopes: effectiveScopes,
  });
  const receiptMemoryIds = new Set(receipt.projectedMemoryIds ?? []);
  const receiptThreadIds = new Set(receipt.projectedPendingThreadIds ?? []);
  const memories = liveContext.memories.filter((memory) => receiptMemoryIds.has(memory.memoryId));
  const pendingThreads = liveContext.pendingThreads.filter((thread) => receiptThreadIds.has(thread.threadId));

  const projectionCore = {
    version: DOMI_MULTI_SURFACE_CONTINUITY_VERSION,
    receiptId: receipt.receiptId,
    continuityKey: receipt.continuityKey,
    lineageId: state.lineageId,
    personId: targetSession.personId,
    targetSessionId,
    targetSurfaceClass: targetSession.surfaceClass,
    effectiveScopes: [...effectiveScopes].sort(),
    memoryIds: memories.map((memory) => memory.memoryId),
    pendingThreadIds: pendingThreads.map((thread) => thread.threadId),
    transferableTurnIds: [...(receipt.transferableTurnIds ?? [])],
    sourceHeadEventId: receipt.sourceHeadEventId,
    currentHeadEventId: state.headEventId ?? null,
    identityRecreated: false,
    fullStateCopied: false,
    providerAuthorityTransferred: false,
  };

  return Object.freeze({
    ...projectionCore,
    memories: Object.freeze(memories),
    pendingThreads: Object.freeze(pendingThreads),
    projectionFingerprint: stableDigest(projectionCore),
    receiptValidation: validation,
    claimWall: CLAIM_WALL,
  });
}

export const MULTI_SURFACE_INVARIANTS = Object.freeze({
  surfaceIsNotDomi: true,
  handoffIsNotIdentityRecreation: true,
  sharedSurfaceIsNotPersonalContext: true,
  fullStateCopyForbidden: true,
  deviceIsNotPerson: true,
  executorIsNotAuthority: true,
  continuityIsNotConsciousness: true,
});
