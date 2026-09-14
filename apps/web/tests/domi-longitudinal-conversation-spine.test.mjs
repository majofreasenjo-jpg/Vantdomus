import test from "node:test";
import assert from "node:assert/strict";
import {
  createLongitudinalConversationState,
  openConversationSession,
  closeConversationSession,
  appendConversationTurn,
  proposeMemoryCandidate,
  adjudicateMemoryCandidate,
  correctMemory,
  forgetMemory,
  openPendingThread,
  resolvePendingThread,
  buildLongitudinalContext,
  getLongitudinalAuditStatus,
} from "../lib/domiLongitudinalConversationSpine.mjs";

function baseState() {
  let s = createLongitudinalConversationState({ householdId: "H1", lineageId: "L1" });
  s = openConversationSession(s, {
    sessionId: "S1",
    personId: "P1",
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: "2026-09-03T12:00:00Z",
  });
  s = appendConversationTurn(s, {
    sessionId: "S1",
    turnId: "T1",
    speaker: "USER",
    personId: "P1",
    text: "Recuerda que prefiero estudiar matemáticas por la mañana.",
    timestamp: "2026-09-03T12:01:00Z",
  });
  return s;
}

test("explicit remember request can be admitted with direct human authority", () => {
  let s = baseState();
  s = proposeMemoryCandidate(s, {
    candidateId: "C1",
    sessionId: "S1",
    personId: "P1",
    memoryType: "study_pattern",
    content: "Prefiere estudiar matemáticas por la mañana.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
  });
  s = adjudicateMemoryCandidate(s, {
    candidateId: "C1",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "M1",
    adjudicatedAt: "2026-09-03T12:02:00Z",
  });
  const ctx = buildLongitudinalContext(s, {
    sessionId: "S1",
    personId: "P1",
    query: "matemáticas mañana",
    now: "2026-09-03T12:03:00Z",
    authorizedScopes: ["private_self"],
  });
  assert.deepEqual(ctx.memoryIds, ["M1"]);
  assert.equal(ctx.providerMayAdmitMemory, false);
  assert.equal(ctx.claimWall.consciousnessDemonstrated, false);
});

test("provider inference cannot self-admit", () => {
  let s = baseState();
  s = appendConversationTurn(s, {
    sessionId: "S1",
    turnId: "T2",
    speaker: "DOMI",
    text: "Parece que estudiar por la mañana te funciona mejor.",
    timestamp: "2026-09-03T12:01:30Z",
    providerRealized: true,
  });
  s = proposeMemoryCandidate(s, {
    candidateId: "C2",
    sessionId: "S1",
    personId: "P1",
    memoryType: "study_pattern",
    content: "Estudiar por la mañana parece funcionar mejor.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1", "T2"],
    origin: "DOMI_INFERENCE",
  });
  assert.throws(
    () => adjudicateMemoryCandidate(s, {
      candidateId: "C2",
      decision: "ADMIT",
      authority: "PROVIDER",
      memoryId: "M2",
      adjudicatedAt: "2026-09-03T12:02:00Z",
    }),
    /HUMAN_ADMISSION_AUTHORITY_REQUIRED/,
  );
});

test("unconfirmed inference never enters recall", () => {
  let s = baseState();
  s = proposeMemoryCandidate(s, {
    candidateId: "C3",
    sessionId: "S1",
    personId: "P1",
    memoryType: "study_pattern",
    content: "Prefiere estudiar de noche.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    origin: "DOMI_INFERENCE",
  });
  const ctx = buildLongitudinalContext(s, {
    sessionId: "S1",
    personId: "P1",
    query: "estudiar noche",
    now: "2026-09-03T12:03:00Z",
    authorizedScopes: ["private_self"],
  });
  assert.equal(ctx.memories.length, 0);
});

test("correction is append-only and old memory leaves recall", () => {
  let s = baseState();
  s = proposeMemoryCandidate(s, {
    candidateId: "C4",
    sessionId: "S1",
    personId: "P1",
    memoryType: "preference",
    content: "Prefiere café.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
  });
  s = adjudicateMemoryCandidate(s, {
    candidateId: "C4",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "M4",
    adjudicatedAt: "2026-09-03T12:02:00Z",
  });
  s = correctMemory(s, {
    memoryId: "M4",
    replacementMemoryId: "M4B",
    correctedContent: "Prefiere té.",
    authority: "USER_CONFIRMED",
    correctedAt: "2026-09-03T12:04:00Z",
  });
  const oldCtx = buildLongitudinalContext(s, {
    sessionId: "S1",
    personId: "P1",
    query: "café",
    now: "2026-09-03T12:05:00Z",
    authorizedScopes: ["private_self"],
  });
  const newCtx = buildLongitudinalContext(s, {
    sessionId: "S1",
    personId: "P1",
    query: "té",
    now: "2026-09-03T12:05:00Z",
    authorizedScopes: ["private_self"],
  });
  assert.equal(oldCtx.memories.length, 0);
  assert.deepEqual(newCtx.memoryIds, ["M4B"]);
});

test("forgetting removes content from recall but keeps audit tombstone", () => {
  let s = baseState();
  s = proposeMemoryCandidate(s, {
    candidateId: "C5",
    sessionId: "S1",
    personId: "P1",
    memoryType: "preference",
    content: "Prefiere jazz.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
  });
  s = adjudicateMemoryCandidate(s, {
    candidateId: "C5",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "M5",
    adjudicatedAt: "2026-09-03T12:02:00Z",
  });
  s = forgetMemory(s, {
    memoryId: "M5",
    authority: "USER_CONFIRMED",
    forgottenAt: "2026-09-03T12:06:00Z",
  });
  const ctx = buildLongitudinalContext(s, {
    sessionId: "S1",
    personId: "P1",
    query: "jazz",
    now: "2026-09-03T12:07:00Z",
    authorizedScopes: ["private_self"],
  });
  assert.equal(ctx.memories.length, 0);
  const status = getLongitudinalAuditStatus(s);
  assert.equal(status.pass, true);
  assert.ok(s.audit.some((e) => e.kind === "MEMORY_FORGOTTEN_TOMBSTONE"));
  assert.equal(s.memories.find((m) => m.memoryId === "M5").content, null);
});

test("temporary-session memory cannot leak into a later session", () => {
  let s = baseState();
  s = proposeMemoryCandidate(s, {
    candidateId: "C6",
    sessionId: "S1",
    personId: "P1",
    memoryType: "operational_context",
    content: "Está comparando dos presupuestos hoy.",
    visibilityScope: "temporary_session",
    evidenceTurnIds: ["T1"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
    expiresAt: "2026-09-03T18:00:00Z",
  });
  s = adjudicateMemoryCandidate(s, {
    candidateId: "C6",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "M6",
    adjudicatedAt: "2026-09-03T12:02:00Z",
  });
  s = closeConversationSession(s, { sessionId: "S1", endedAt: "2026-09-03T13:00:00Z" });
  s = openConversationSession(s, {
    sessionId: "S2",
    personId: "P1",
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: "2026-09-03T14:00:00Z",
  });
  const ctx = buildLongitudinalContext(s, {
    sessionId: "S2",
    personId: "P1",
    query: "presupuestos",
    now: "2026-09-03T14:01:00Z",
    authorizedScopes: ["temporary_session"],
  });
  assert.equal(ctx.memories.length, 0);
});

test("private memory is suppressed on shared TV", () => {
  let s = baseState();
  s = proposeMemoryCandidate(s, {
    candidateId: "C7",
    sessionId: "S1",
    personId: "P1",
    memoryType: "preference",
    content: "Prefiere reuniones pequeñas.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
  });
  s = adjudicateMemoryCandidate(s, {
    candidateId: "C7",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "M7",
    adjudicatedAt: "2026-09-03T12:02:00Z",
  });
  s = closeConversationSession(s, { sessionId: "S1", endedAt: "2026-09-03T13:00:00Z" });
  s = openConversationSession(s, {
    sessionId: "TV1",
    personId: "P1",
    surfaceClass: "SHARED_TV",
    startedAt: "2026-09-03T14:00:00Z",
  });
  const ctx = buildLongitudinalContext(s, {
    sessionId: "TV1",
    personId: "P1",
    query: "reuniones",
    now: "2026-09-03T14:01:00Z",
    authorizedScopes: ["private_self", "household_shared"],
  });
  assert.equal(ctx.memories.length, 0);
});

test("pending thread survives sessions and can later be resolved", () => {
  let s = baseState();
  s = openPendingThread(s, {
    threadId: "TH1",
    sessionId: "S1",
    personId: "P1",
    title: "Revisar presupuesto de viaje a Copiapó",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    openedAt: "2026-09-03T12:03:00Z",
  });
  s = closeConversationSession(s, { sessionId: "S1", endedAt: "2026-09-03T13:00:00Z" });
  s = openConversationSession(s, {
    sessionId: "S3",
    personId: "P1",
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: "2026-09-04T09:00:00Z",
  });
  const ctx = buildLongitudinalContext(s, {
    sessionId: "S3",
    personId: "P1",
    query: "presupuesto viaje",
    now: "2026-09-04T09:01:00Z",
    authorizedScopes: ["private_self"],
  });
  assert.deepEqual(ctx.pendingThreadIds, ["TH1"]);
  s = resolvePendingThread(s, {
    threadId: "TH1",
    personId: "P1",
    resolvedAt: "2026-09-04T09:05:00Z",
  });
  const ctx2 = buildLongitudinalContext(s, {
    sessionId: "S3",
    personId: "P1",
    query: "presupuesto viaje",
    now: "2026-09-04T09:06:00Z",
    authorizedScopes: ["private_self"],
  });
  assert.equal(ctx2.pendingThreads.length, 0);
});

test("same initial state plus different admitted histories yields different longitudinal context", () => {
  let a = baseState();
  let b = baseState();
  a = proposeMemoryCandidate(a, {
    candidateId: "CA",
    sessionId: "S1",
    personId: "P1",
    memoryType: "preference",
    content: "Prefiere trabajar con música instrumental.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
  });
  a = adjudicateMemoryCandidate(a, {
    candidateId: "CA",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "MA",
    adjudicatedAt: "2026-09-03T12:02:00Z",
  });
  b = proposeMemoryCandidate(b, {
    candidateId: "CB",
    sessionId: "S1",
    personId: "P1",
    memoryType: "preference",
    content: "Prefiere trabajar en silencio.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["T1"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
  });
  b = adjudicateMemoryCandidate(b, {
    candidateId: "CB",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "MB",
    adjudicatedAt: "2026-09-03T12:02:00Z",
  });
  const ctxA = buildLongitudinalContext(a, {
    sessionId: "S1",
    personId: "P1",
    query: "trabajar música silencio",
    now: "2026-09-03T12:03:00Z",
    authorizedScopes: ["private_self"],
  });
  const ctxB = buildLongitudinalContext(b, {
    sessionId: "S1",
    personId: "P1",
    query: "trabajar música silencio",
    now: "2026-09-03T12:03:00Z",
    authorizedScopes: ["private_self"],
  });
  assert.notEqual(ctxA.contextFingerprint, ctxB.contextFingerprint);
  assert.notDeepEqual(ctxA.memoryIds, ctxB.memoryIds);
});

test("audit detects tampering", () => {
  const s = baseState();
  const tampered = structuredClone(s);
  tampered.audit[0].kind = "TAMPERED";
  const status = getLongitudinalAuditStatus(tampered);
  assert.equal(status.pass, false);
  assert.ok(status.failures.some((f) => f.includes("DIGEST_MISMATCH")));
});
