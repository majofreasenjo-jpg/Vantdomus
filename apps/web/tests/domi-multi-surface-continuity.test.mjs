import test from "node:test";
import assert from "node:assert/strict";
import {
  createLongitudinalConversationState,
  openConversationSession,
  closeConversationSession,
  appendConversationTurn,
  proposeMemoryCandidate,
  adjudicateMemoryCandidate,
  openPendingThread,
} from "../lib/domiLongitudinalConversationSpine.mjs";
import {
  DOMI_MULTI_SURFACE_CONTINUITY_VERSION,
  createContextProjection,
  createSessionContinuationReceipt,
  validateSessionContinuationReceipt,
  revokeSessionContinuationReceipt,
  consumeSessionContinuationReceipt,
  MULTI_SURFACE_INVARIANTS,
} from "../lib/domiMultiSurfaceContinuity.mjs";

function admit(s, {
  candidateId,
  memoryId,
  turnId,
  content,
  visibilityScope,
  memoryType = "operational_context",
}) {
  s = proposeMemoryCandidate(s, {
    candidateId,
    sessionId: "S1",
    personId: "P1",
    memoryType,
    content,
    visibilityScope,
    evidenceTurnIds: [turnId],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
  });
  return adjudicateMemoryCandidate(s, {
    candidateId,
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId,
    adjudicatedAt: "2026-09-04T12:04:00Z",
  });
}

function seededState() {
  let s = createLongitudinalConversationState({ householdId: "H1", lineageId: "DOMI-L1" });
  s = openConversationSession(s, {
    sessionId: "S1",
    personId: "P1",
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: "2026-09-04T12:00:00Z",
  });
  s = appendConversationTurn(s, {
    sessionId: "S1",
    turnId: "T1",
    speaker: "USER",
    personId: "P1",
    text: "Recuerda que Proyecto Atlas es privado y prefiero trabajarlo temprano.",
    timestamp: "2026-09-04T12:01:00Z",
  });
  s = appendConversationTurn(s, {
    sessionId: "S1",
    turnId: "T2",
    speaker: "USER",
    personId: "P1",
    text: "Recuerda que la familia planifica el viaje Atlas para el sábado.",
    timestamp: "2026-09-04T12:02:00Z",
  });
  s = appendConversationTurn(s, {
    sessionId: "S1",
    turnId: "T3",
    speaker: "USER",
    personId: "P1",
    text: "Recuerda temporalmente que hoy comparo dos opciones Atlas.",
    timestamp: "2026-09-04T12:03:00Z",
  });

  s = admit(s, {
    candidateId: "C1",
    memoryId: "M-PRIVATE",
    turnId: "T1",
    content: "Proyecto Atlas: prefiere trabajarlo temprano.",
    visibilityScope: "private_self",
    memoryType: "preference",
  });
  s = admit(s, {
    candidateId: "C2",
    memoryId: "M-SHARED",
    turnId: "T2",
    content: "Proyecto Atlas: la familia viajará el sábado.",
    visibilityScope: "household_shared",
  });
  s = admit(s, {
    candidateId: "C3",
    memoryId: "M-TEMP",
    turnId: "T3",
    content: "Proyecto Atlas: comparar dos opciones hoy.",
    visibilityScope: "temporary_session",
  });
  s = openPendingThread(s, {
    threadId: "THREAD-SHARED",
    sessionId: "S1",
    personId: "P1",
    title: "Proyecto Atlas: confirmar horario familiar",
    visibilityScope: "household_shared",
    evidenceTurnIds: ["T2"],
    openedAt: "2026-09-04T12:05:00Z",
  });
  return s;
}

function mobileReceipt(s) {
  return createSessionContinuationReceipt(s, {
    receiptId: "SCR-1",
    sourceSessionId: "S1",
    personId: "P1",
    targetSurfaceClass: "PERSONAL_MOBILE",
    purpose: "Continuar Proyecto Atlas en móvil",
    query: "Proyecto Atlas",
    authorizedScopes: ["private_self", "household_shared", "temporary_session"],
    transferableTurnIds: ["T1", "T2"],
    createdAt: "2026-09-04T12:06:00Z",
    expiresAt: "2026-09-04T12:30:00Z",
  });
}

test("ContextProjection minimizes state and does not carry temporary-session memory across a projected handoff", () => {
  const s = seededState();
  const projection = createContextProjection(s, {
    personId: "P1",
    surfaceClass: "PERSONAL_MOBILE",
    sourceSessionId: "S1",
    query: "Proyecto Atlas",
    now: "2026-09-04T12:06:00Z",
    authorizedScopes: ["private_self", "household_shared", "temporary_session"],
  });
  assert.equal(projection.version, DOMI_MULTI_SURFACE_CONTINUITY_VERSION);
  assert.deepEqual(projection.memoryIds.sort(), ["M-PRIVATE", "M-SHARED"]);
  assert.equal(projection.memoryIds.includes("M-TEMP"), false);
  assert.equal(projection.fullStateCopied, false);
  assert.equal(projection.rawTranscriptCopied, false);
  assert.equal(projection.providerAuthorityTransferred, false);
  assert.equal(projection.claimWall.consciousnessDemonstrated, false);
});

test("CT13 Multi-Device Continuity: desktop to mobile preserves continuity without recreating identity", () => {
  let s = seededState();
  const receipt = mobileReceipt(s);
  assert.equal(receipt.sourceSurfaceClass, "PERSONAL_DESKTOP");
  assert.equal(receipt.targetSurfaceClass, "PERSONAL_MOBILE");
  assert.equal(receipt.identityRecreated, false);
  assert.equal(receipt.deviceIsPerson, false);
  assert.equal(receipt.fullStateCopied, false);
  assert.deepEqual(receipt.projectedMemoryIds.sort(), ["M-PRIVATE", "M-SHARED"]);
  assert.deepEqual(receipt.transferableTurnIds, ["T1", "T2"]);
  assert.equal(JSON.stringify(receipt).includes("prefiere trabajarlo temprano"), false);
  assert.equal(JSON.stringify(receipt).includes("familia viajará"), false);
  assert.equal(JSON.stringify(receipt).includes("Recuerda que Proyecto Atlas"), false);

  s = closeConversationSession(s, { sessionId: "S1", endedAt: "2026-09-04T12:07:00Z" });
  s = openConversationSession(s, {
    sessionId: "S2",
    personId: "P1",
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: "2026-09-04T12:08:00Z",
  });
  const continued = consumeSessionContinuationReceipt(s, {
    receipt,
    targetSessionId: "S2",
    now: "2026-09-04T12:09:00Z",
    query: "Proyecto Atlas",
    authorizedScopes: ["private_self", "household_shared", "temporary_session"],
  });
  assert.equal(continued.receiptValidation.pass, true);
  assert.equal(continued.continuityKey, receipt.continuityKey);
  assert.equal(continued.targetSurfaceClass, "PERSONAL_MOBILE");
  assert.deepEqual(continued.memoryIds.sort(), ["M-PRIVATE", "M-SHARED"]);
  assert.equal(continued.memoryIds.includes("M-TEMP"), false);
  assert.deepEqual(continued.pendingThreadIds, ["THREAD-SHARED"]);
  assert.equal(continued.identityRecreated, false);
});

test("CT14 TV Shared Privacy: private_self and raw conversation are suppressed on household-safe TV", () => {
  let s = seededState();
  const receipt = createSessionContinuationReceipt(s, {
    receiptId: "SCR-TV",
    sourceSessionId: "S1",
    personId: "P1",
    targetSurfaceClass: "SHARED_TV",
    purpose: "Continuar contexto household-safe en TV",
    query: "Proyecto Atlas",
    authorizedScopes: ["private_self", "household_shared", "temporary_session", "document_derived"],
    transferableTurnIds: ["T1", "T2", "T3"],
    createdAt: "2026-09-04T12:06:00Z",
    expiresAt: "2026-09-04T12:20:00Z",
  });
  assert.deepEqual(receipt.memoryScopes, ["household_shared", "document_derived"]);
  assert.deepEqual(receipt.projectedMemoryIds, ["M-SHARED"]);
  assert.deepEqual(receipt.transferableTurnIds, []);
  assert.equal(receipt.targetSharedSurface, true);

  s = closeConversationSession(s, { sessionId: "S1", endedAt: "2026-09-04T12:07:00Z" });
  s = openConversationSession(s, {
    sessionId: "S-TV",
    personId: "P1",
    surfaceClass: "SHARED_TV",
    startedAt: "2026-09-04T12:08:00Z",
  });
  const continued = consumeSessionContinuationReceipt(s, {
    receipt,
    targetSessionId: "S-TV",
    now: "2026-09-04T12:09:00Z",
    query: "Proyecto Atlas",
    authorizedScopes: ["private_self", "household_shared", "document_derived"],
  });
  assert.deepEqual(continued.memoryIds, ["M-SHARED"]);
  assert.equal(continued.memoryIds.includes("M-PRIVATE"), false);
  assert.deepEqual(continued.transferableTurnIds, []);
});

test("SessionContinuationReceipt expires closed", () => {
  const receipt = mobileReceipt(seededState());
  const status = validateSessionContinuationReceipt(receipt, {
    now: "2026-09-04T12:31:00Z",
    expectedLineageId: "DOMI-L1",
    expectedPersonId: "P1",
    expectedTargetSurfaceClass: "PERSONAL_MOBILE",
  });
  assert.equal(status.pass, false);
  assert.ok(status.failures.includes("RECEIPT_EXPIRED"));
});

test("SessionContinuationReceipt detects tampering", () => {
  const receipt = mobileReceipt(seededState());
  const tampered = structuredClone(receipt);
  tampered.targetSurfaceClass = "SHARED_TV";
  const status = validateSessionContinuationReceipt(tampered, {
    now: "2026-09-04T12:10:00Z",
  });
  assert.equal(status.pass, false);
  assert.ok(status.failures.includes("RECEIPT_DIGEST_MISMATCH"));
});

test("revoked SessionContinuationReceipt cannot be consumed", () => {
  let s = seededState();
  const receipt = mobileReceipt(s);
  const revoked = revokeSessionContinuationReceipt(receipt, {
    revokedAt: "2026-09-04T12:10:00Z",
    reason: "Owner revoked handoff",
  });
  s = closeConversationSession(s, { sessionId: "S1", endedAt: "2026-09-04T12:11:00Z" });
  s = openConversationSession(s, {
    sessionId: "S2",
    personId: "P1",
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: "2026-09-04T12:12:00Z",
  });
  assert.throws(
    () => consumeSessionContinuationReceipt(s, {
      receipt: revoked,
      targetSessionId: "S2",
      now: "2026-09-04T12:13:00Z",
      authorizedScopes: ["private_self", "household_shared"],
    }),
    /RECEIPT_NOT_ACTIVE/,
  );
});

test("device/surface continuity cannot substitute for person identity", () => {
  let s = seededState();
  const receipt = mobileReceipt(s);
  s = closeConversationSession(s, { sessionId: "S1", endedAt: "2026-09-04T12:07:00Z" });
  s = openConversationSession(s, {
    sessionId: "S-OTHER",
    personId: "P2",
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: "2026-09-04T12:08:00Z",
  });
  assert.throws(
    () => consumeSessionContinuationReceipt(s, {
      receipt,
      targetSessionId: "S-OTHER",
      now: "2026-09-04T12:09:00Z",
      authorizedScopes: ["private_self", "household_shared"],
    }),
    /PERSON_MISMATCH/,
  );
  assert.equal(MULTI_SURFACE_INVARIANTS.deviceIsNotPerson, true);
  assert.equal(MULTI_SURFACE_INVARIANTS.handoffIsNotIdentityRecreation, true);
  assert.equal(MULTI_SURFACE_INVARIANTS.continuityIsNotConsciousness, true);
});
