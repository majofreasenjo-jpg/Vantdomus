export const DOMI_LONGITUDINAL_CONVERSATION_SPINE_VERSION =
  "DOMI_LONGITUDINAL_CONVERSATION_MEMORY_SPINE_V0_1";

export const CLAIM_WALL = Object.freeze({
  realDevelopmentDemonstrated: false,
  subjecthoodDemonstrated: false,
  selfSpecificityEstablished: false,
  consciousnessDemonstrated: false,
  phenomenalConsciousness: "UNKNOWN",
});

const SAFE_MEMORY_TYPES = new Set([
  "preference",
  "routine_pattern",
  "study_pattern",
  "motivation_pattern",
  "calm_strategy",
  "social_connection",
  "family_story",
  "improvement",
  "operational_context",
]);

const ALLOWED_SCOPES = new Set([
  "private_self",
  "guardian_supervised",
  "household_shared",
  "owner_operational",
  "temporary_session",
  "document_derived",
]);

const SURFACE_CLASSES = new Set([
  "PERSONAL_MOBILE",
  "PERSONAL_DESKTOP",
  "SHARED_TV",
  "OTHER",
]);

const HUMAN_ADMISSION_AUTHORITIES = new Set([
  "USER_EXPLICIT_REMEMBER_REQUEST",
  "USER_CONFIRMED",
  "OWNER_CONFIRMED",
  "GUARDIAN_CONFIRMED",
]);

const HUMAN_CORRECTION_AUTHORITIES = new Set([
  "USER_CONFIRMED",
  "OWNER_CONFIRMED",
  "GUARDIAN_CONFIRMED",
]);

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

function tokenize(value) {
  return new Set(
    String(value ?? "")
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
}

function relevanceScore(queryTokens, content) {
  if (queryTokens.size === 0) return 0;
  const contentTokens = tokenize(content);
  let overlap = 0;
  for (const token of queryTokens) if (contentTokens.has(token)) overlap += 1;
  return overlap / queryTokens.size;
}

function nextSequence(state) {
  return state.audit.length + 1;
}

function appendAudit(state, kind, payload) {
  const seq = nextSequence(state);
  const parentEventId = state.audit.at(-1)?.eventId ?? null;
  const eventCore = {
    seq,
    eventId: `LCS-${String(seq).padStart(5, "0")}`,
    parentEventId,
    kind,
    payload: clone(payload),
  };
  const event = { ...eventCore, digest: stableDigest(eventCore) };
  state.audit.push(event);
  state.headEventId = event.eventId;
  return event;
}

function getSession(state, sessionId) {
  const session = state.sessions.find((item) => item.sessionId === sessionId);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  return session;
}

function getCandidate(state, candidateId) {
  const candidate = state.memoryCandidates.find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error("MEMORY_CANDIDATE_NOT_FOUND");
  return candidate;
}

function getMemory(state, memoryId) {
  const memory = state.memories.find((item) => item.memoryId === memoryId);
  if (!memory) throw new Error("MEMORY_NOT_FOUND");
  return memory;
}

function surfaceAllowsScope(surfaceClass, scope) {
  if (surfaceClass === "SHARED_TV") {
    return scope === "household_shared" || scope === "document_derived";
  }
  return true;
}

function memoryVisibleToPerson(memory, personId) {
  if (memory.visibilityScope === "household_shared" || memory.visibilityScope === "document_derived") {
    return true;
  }
  if (memory.visibilityScope === "owner_operational") return memory.personId === null || memory.personId === personId;
  return memory.personId === personId;
}

function memoryIsCurrent(memory, nowIso, sessionId) {
  if (memory.status !== "ACTIVE") return false;
  if (memory.expiresAt && memory.expiresAt <= nowIso) return false;
  if (memory.visibilityScope === "temporary_session" && memory.sessionId !== sessionId) return false;
  return true;
}

export function createLongitudinalConversationState({ householdId, lineageId }) {
  return {
    version: DOMI_LONGITUDINAL_CONVERSATION_SPINE_VERSION,
    householdId: assertNonEmpty(householdId, "HOUSEHOLD_ID_REQUIRED"),
    lineageId: assertNonEmpty(lineageId, "LINEAGE_ID_REQUIRED"),
    headEventId: null,
    sessions: [],
    turns: [],
    memoryCandidates: [],
    memories: [],
    pendingThreads: [],
    audit: [],
    claimWall: CLAIM_WALL,
  };
}

export function openConversationSession(inputState, {
  sessionId,
  personId,
  surfaceClass = "PERSONAL_DESKTOP",
  startedAt,
}) {
  const state = clone(inputState);
  assertNonEmpty(sessionId, "SESSION_ID_REQUIRED");
  assertNonEmpty(personId, "PERSON_ID_REQUIRED");
  if (!SURFACE_CLASSES.has(surfaceClass)) throw new Error("SURFACE_CLASS_NOT_ALLOWED");
  if (state.sessions.some((item) => item.sessionId === sessionId)) throw new Error("SESSION_ALREADY_EXISTS");
  const session = {
    sessionId,
    personId,
    surfaceClass,
    startedAt: normalizeTimestamp(startedAt),
    endedAt: null,
  };
  state.sessions.push(session);
  appendAudit(state, "SESSION_OPENED", session);
  return state;
}

export function closeConversationSession(inputState, { sessionId, endedAt }) {
  const state = clone(inputState);
  const session = getSession(state, sessionId);
  if (session.endedAt) throw new Error("SESSION_ALREADY_CLOSED");
  session.endedAt = normalizeTimestamp(endedAt);
  if (session.endedAt < session.startedAt) throw new Error("SESSION_END_BEFORE_START");
  appendAudit(state, "SESSION_CLOSED", { sessionId, endedAt: session.endedAt });
  return state;
}

export function appendConversationTurn(inputState, {
  sessionId,
  turnId,
  speaker,
  text,
  timestamp,
  personId = null,
  providerRealized = false,
}) {
  const state = clone(inputState);
  const session = getSession(state, sessionId);
  if (session.endedAt) throw new Error("SESSION_CLOSED");
  if (!["USER", "DOMI", "TOOL"].includes(speaker)) throw new Error("SPEAKER_NOT_ALLOWED");
  if (state.turns.some((item) => item.turnId === turnId)) throw new Error("TURN_ALREADY_EXISTS");
  if (speaker === "USER" && personId !== session.personId) throw new Error("TURN_PERSON_SESSION_MISMATCH");
  const turn = {
    turnId: assertNonEmpty(turnId, "TURN_ID_REQUIRED"),
    sessionId,
    personId: speaker === "USER" ? personId : null,
    speaker,
    text: assertNonEmpty(text, "TURN_TEXT_REQUIRED"),
    timestamp: normalizeTimestamp(timestamp),
    providerRealized: Boolean(providerRealized),
    constitutiveAuthority: false,
    memoryAdmissionAuthority: false,
  };
  state.turns.push(turn);
  appendAudit(state, "TURN_CAPTURED", {
    turnId,
    sessionId,
    speaker,
    providerRealized: turn.providerRealized,
  });
  return state;
}

export function proposeMemoryCandidate(inputState, {
  candidateId,
  sessionId,
  personId,
  memoryType,
  content,
  visibilityScope,
  evidenceTurnIds,
  origin,
  explicitRememberRequest = false,
  importance = 0.5,
  expiresAt = null,
}) {
  const state = clone(inputState);
  const session = getSession(state, sessionId);
  if (session.personId !== personId) throw new Error("CANDIDATE_PERSON_SESSION_MISMATCH");
  if (!SAFE_MEMORY_TYPES.has(memoryType)) throw new Error("MEMORY_TYPE_NOT_ALLOWED");
  if (!ALLOWED_SCOPES.has(visibilityScope)) throw new Error("VISIBILITY_SCOPE_NOT_ALLOWED");
  if (!["USER_EXPLICIT", "DOMI_INFERENCE", "SYSTEM_OBSERVATION"].includes(origin)) {
    throw new Error("MEMORY_ORIGIN_NOT_ALLOWED");
  }
  if (!Array.isArray(evidenceTurnIds) || evidenceTurnIds.length === 0) throw new Error("EVIDENCE_TURN_REQUIRED");
  const uniqueEvidence = [...new Set(evidenceTurnIds)];
  for (const turnId of uniqueEvidence) {
    const turn = state.turns.find((item) => item.turnId === turnId);
    if (!turn) throw new Error("EVIDENCE_TURN_NOT_FOUND");
    if (turn.sessionId !== sessionId) throw new Error("EVIDENCE_SESSION_MISMATCH");
  }
  if (origin === "USER_EXPLICIT") {
    const hasUserEvidence = uniqueEvidence.some((turnId) => {
      const turn = state.turns.find((item) => item.turnId === turnId);
      return turn?.speaker === "USER" && turn.personId === personId;
    });
    if (!hasUserEvidence) throw new Error("USER_EXPLICIT_REQUIRES_USER_EVIDENCE");
  }
  if (state.memoryCandidates.some((item) => item.candidateId === candidateId)) {
    throw new Error("MEMORY_CANDIDATE_ALREADY_EXISTS");
  }
  let normalizedImportance = Number(importance);
  if (!Number.isFinite(normalizedImportance)) normalizedImportance = 0.5;
  normalizedImportance = Math.max(0, Math.min(1, normalizedImportance));
  const candidate = {
    candidateId: assertNonEmpty(candidateId, "CANDIDATE_ID_REQUIRED"),
    sessionId,
    personId,
    memoryType,
    content: assertNonEmpty(content, "MEMORY_CONTENT_REQUIRED"),
    visibilityScope,
    evidenceTurnIds: uniqueEvidence,
    origin,
    explicitRememberRequest: Boolean(explicitRememberRequest),
    importance: normalizedImportance,
    expiresAt: expiresAt ? normalizeTimestamp(expiresAt) : null,
    status: "PENDING_HUMAN_ADJUDICATION",
    proposedByProvider: origin === "DOMI_INFERENCE",
  };
  state.memoryCandidates.push(candidate);
  appendAudit(state, "MEMORY_CANDIDATE_PROPOSED", {
    candidateId,
    sessionId,
    personId,
    origin,
    memoryType,
    visibilityScope,
    evidenceTurnIds: uniqueEvidence,
  });
  return state;
}

export function adjudicateMemoryCandidate(inputState, {
  candidateId,
  decision,
  authority,
  memoryId = null,
  adjudicatedAt,
}) {
  const state = clone(inputState);
  const candidate = getCandidate(state, candidateId);
  if (candidate.status !== "PENDING_HUMAN_ADJUDICATION") throw new Error("CANDIDATE_ALREADY_ADJUDICATED");
  if (!["ADMIT", "REJECT"].includes(decision)) throw new Error("ADJUDICATION_DECISION_NOT_ALLOWED");

  const explicitDirectAdmission =
    candidate.origin === "USER_EXPLICIT" &&
    candidate.explicitRememberRequest === true &&
    authority === "USER_EXPLICIT_REMEMBER_REQUEST";
  const confirmedAdmission = HUMAN_ADMISSION_AUTHORITIES.has(authority) && authority !== "USER_EXPLICIT_REMEMBER_REQUEST";

  if (decision === "ADMIT" && !(explicitDirectAdmission || confirmedAdmission)) {
    throw new Error("HUMAN_ADMISSION_AUTHORITY_REQUIRED");
  }
  if (candidate.origin === "DOMI_INFERENCE" && decision === "ADMIT" && authority === "USER_EXPLICIT_REMEMBER_REQUEST") {
    throw new Error("INFERENCE_REQUIRES_EXPLICIT_CONFIRMATION");
  }

  const at = normalizeTimestamp(adjudicatedAt);
  candidate.status = decision === "ADMIT" ? "ADMITTED" : "REJECTED";
  candidate.adjudicationAuthority = authority;
  candidate.adjudicatedAt = at;

  if (decision === "REJECT") {
    appendAudit(state, "MEMORY_CANDIDATE_REJECTED", { candidateId, authority, adjudicatedAt: at });
    return state;
  }

  const resolvedMemoryId = assertNonEmpty(memoryId, "MEMORY_ID_REQUIRED");
  if (state.memories.some((item) => item.memoryId === resolvedMemoryId)) throw new Error("MEMORY_ALREADY_EXISTS");
  const memory = {
    memoryId: resolvedMemoryId,
    candidateId,
    sessionId: candidate.sessionId,
    personId: candidate.personId,
    memoryType: candidate.memoryType,
    content: candidate.content,
    contentDigest: stableDigest(candidate.content),
    visibilityScope: candidate.visibilityScope,
    evidenceTurnIds: [...candidate.evidenceTurnIds],
    origin: candidate.origin,
    importance: candidate.importance,
    admittedAt: at,
    admissionAuthority: authority,
    expiresAt: candidate.expiresAt,
    status: "ACTIVE",
    supersedesMemoryId: null,
    supersededByMemoryId: null,
    forgottenAt: null,
  };
  state.memories.push(memory);
  appendAudit(state, "MEMORY_ADMITTED", {
    memoryId: resolvedMemoryId,
    candidateId,
    admissionAuthority: authority,
    evidenceTurnIds: candidate.evidenceTurnIds,
  });
  return state;
}

export function correctMemory(inputState, {
  memoryId,
  replacementMemoryId,
  correctedContent,
  authority,
  correctedAt,
}) {
  const state = clone(inputState);
  if (!HUMAN_CORRECTION_AUTHORITIES.has(authority)) throw new Error("HUMAN_CORRECTION_AUTHORITY_REQUIRED");
  const oldMemory = getMemory(state, memoryId);
  if (oldMemory.status !== "ACTIVE") throw new Error("MEMORY_NOT_ACTIVE");
  const newId = assertNonEmpty(replacementMemoryId, "REPLACEMENT_MEMORY_ID_REQUIRED");
  if (state.memories.some((item) => item.memoryId === newId)) throw new Error("MEMORY_ALREADY_EXISTS");
  const at = normalizeTimestamp(correctedAt);
  const replacement = {
    ...clone(oldMemory),
    memoryId: newId,
    candidateId: null,
    content: assertNonEmpty(correctedContent, "CORRECTED_CONTENT_REQUIRED"),
    contentDigest: stableDigest(correctedContent),
    admittedAt: at,
    admissionAuthority: authority,
    status: "ACTIVE",
    supersedesMemoryId: oldMemory.memoryId,
    supersededByMemoryId: null,
    forgottenAt: null,
  };
  oldMemory.status = "SUPERSEDED";
  oldMemory.supersededByMemoryId = newId;
  state.memories.push(replacement);
  appendAudit(state, "MEMORY_CORRECTED_APPEND_ONLY", {
    oldMemoryId: memoryId,
    replacementMemoryId: newId,
    authority,
  });
  return state;
}

export function forgetMemory(inputState, { memoryId, authority, forgottenAt }) {
  const state = clone(inputState);
  if (!HUMAN_CORRECTION_AUTHORITIES.has(authority)) throw new Error("HUMAN_FORGET_AUTHORITY_REQUIRED");
  const memory = getMemory(state, memoryId);
  if (memory.status !== "ACTIVE") throw new Error("MEMORY_NOT_ACTIVE");
  const at = normalizeTimestamp(forgottenAt);
  memory.status = "FORGOTTEN";
  memory.forgottenAt = at;
  memory.content = null;
  appendAudit(state, "MEMORY_FORGOTTEN_TOMBSTONE", {
    memoryId,
    contentDigest: memory.contentDigest,
    authority,
    forgottenAt: at,
  });
  return state;
}

export function openPendingThread(inputState, {
  threadId,
  sessionId,
  personId,
  title,
  visibilityScope,
  evidenceTurnIds,
  openedAt,
}) {
  const state = clone(inputState);
  const session = getSession(state, sessionId);
  if (session.personId !== personId) throw new Error("THREAD_PERSON_SESSION_MISMATCH");
  if (!ALLOWED_SCOPES.has(visibilityScope)) throw new Error("VISIBILITY_SCOPE_NOT_ALLOWED");
  if (!Array.isArray(evidenceTurnIds) || evidenceTurnIds.length === 0) throw new Error("THREAD_EVIDENCE_REQUIRED");
  for (const turnId of evidenceTurnIds) {
    const turn = state.turns.find((item) => item.turnId === turnId);
    if (!turn || turn.sessionId !== sessionId) throw new Error("THREAD_EVIDENCE_MISMATCH");
  }
  if (state.pendingThreads.some((item) => item.threadId === threadId)) throw new Error("THREAD_ALREADY_EXISTS");
  const thread = {
    threadId: assertNonEmpty(threadId, "THREAD_ID_REQUIRED"),
    sessionId,
    personId,
    title: assertNonEmpty(title, "THREAD_TITLE_REQUIRED"),
    visibilityScope,
    evidenceTurnIds: [...new Set(evidenceTurnIds)],
    openedAt: normalizeTimestamp(openedAt),
    status: "OPEN",
    resolvedAt: null,
  };
  state.pendingThreads.push(thread);
  appendAudit(state, "PENDING_THREAD_OPENED", thread);
  return state;
}

export function resolvePendingThread(inputState, { threadId, personId, resolvedAt }) {
  const state = clone(inputState);
  const thread = state.pendingThreads.find((item) => item.threadId === threadId);
  if (!thread) throw new Error("THREAD_NOT_FOUND");
  if (thread.personId !== personId) throw new Error("THREAD_PERSON_MISMATCH");
  if (thread.status !== "OPEN") throw new Error("THREAD_NOT_OPEN");
  thread.status = "RESOLVED";
  thread.resolvedAt = normalizeTimestamp(resolvedAt);
  appendAudit(state, "PENDING_THREAD_RESOLVED", { threadId, personId, resolvedAt: thread.resolvedAt });
  return state;
}

export function buildLongitudinalContext(inputState, {
  sessionId,
  personId,
  query,
  now,
  authorizedScopes,
  memoryLimit = 8,
  threadLimit = 4,
}) {
  const state = clone(inputState);
  const session = getSession(state, sessionId);
  if (session.personId !== personId) throw new Error("RECALL_PERSON_SESSION_MISMATCH");
  const nowIso = normalizeTimestamp(now);
  const allowed = new Set((authorizedScopes ?? []).filter((scope) => ALLOWED_SCOPES.has(scope)));
  const queryTokens = tokenize(query);

  const memories = state.memories
    .filter((memory) => allowed.has(memory.visibilityScope))
    .filter((memory) => surfaceAllowsScope(session.surfaceClass, memory.visibilityScope))
    .filter((memory) => memoryVisibleToPerson(memory, personId))
    .filter((memory) => memoryIsCurrent(memory, nowIso, sessionId))
    .map((memory) => ({
      ...memory,
      relevance: relevanceScore(queryTokens, memory.content),
    }))
    .filter((memory) => queryTokens.size === 0 || memory.relevance > 0)
    .sort((a, b) =>
      b.relevance - a.relevance ||
      b.importance - a.importance ||
      b.admittedAt.localeCompare(a.admittedAt) ||
      a.memoryId.localeCompare(b.memoryId),
    )
    .slice(0, Math.max(0, memoryLimit))
    .map(({ relevance, ...memory }) => ({ ...memory, relevance }));

  const pendingThreads = state.pendingThreads
    .filter((thread) => thread.status === "OPEN")
    .filter((thread) => thread.personId === personId)
    .filter((thread) => allowed.has(thread.visibilityScope))
    .filter((thread) => surfaceAllowsScope(session.surfaceClass, thread.visibilityScope))
    .map((thread) => ({ ...thread, relevance: relevanceScore(queryTokens, thread.title) }))
    .filter((thread) => queryTokens.size === 0 || thread.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || a.openedAt.localeCompare(b.openedAt) || a.threadId.localeCompare(b.threadId))
    .slice(0, Math.max(0, threadLimit));

  const bundleCore = {
    spineVersion: DOMI_LONGITUDINAL_CONVERSATION_SPINE_VERSION,
    lineageId: state.lineageId,
    sessionId,
    personId,
    surfaceClass: session.surfaceClass,
    query: String(query ?? ""),
    authorizedScopes: [...allowed].sort(),
    memoryIds: memories.map((item) => item.memoryId),
    pendingThreadIds: pendingThreads.map((item) => item.threadId),
    headEventId: state.headEventId,
  };

  return Object.freeze({
    ...bundleCore,
    memories: Object.freeze(memories),
    pendingThreads: Object.freeze(pendingThreads),
    contextFingerprint: stableDigest(bundleCore),
    providerMayRewriteMemory: false,
    providerMayAdmitMemory: false,
    unconfirmedInferenceMayEnterRecall: false,
    claimWall: CLAIM_WALL,
  });
}

export function getLongitudinalAuditStatus(state) {
  const failures = [];
  for (let index = 0; index < state.audit.length; index += 1) {
    const event = state.audit[index];
    const expectedParent = index === 0 ? null : state.audit[index - 1].eventId;
    if (event.parentEventId !== expectedParent) failures.push(`${event.eventId}:PARENT_MISMATCH`);
    const { digest, ...core } = event;
    if (stableDigest(core) !== digest) failures.push(`${event.eventId}:DIGEST_MISMATCH`);
    if (event.seq !== index + 1) failures.push(`${event.eventId}:SEQUENCE_MISMATCH`);
  }
  return Object.freeze({
    pass: failures.length === 0,
    failures: Object.freeze(failures),
    events: state.audit.length,
    headEventId: state.headEventId,
    auditFingerprint: stableDigest(state.audit.map((event) => ({ eventId: event.eventId, digest: event.digest }))),
    claimWall: CLAIM_WALL,
  });
}
