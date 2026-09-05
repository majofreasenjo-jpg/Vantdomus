import {
  createLongitudinalConversationState,
  openConversationSession,
  appendConversationTurn,
  proposeMemoryCandidate,
  adjudicateMemoryCandidate,
} from "./domiLongitudinalConversationSpine.mjs";

export const P5_SYNTHETIC_PERSON_ID = "OWNER_ALPHA_SYNTHETIC_PERSON";
export const P5_SYNTHETIC_HOUSEHOLD_ID = "OWNER_ALPHA_SYNTHETIC_HOUSEHOLD";
export const P5_SYNTHETIC_LINEAGE_ID = "OWNER_ALPHA_SYNTHETIC_LINEAGE";
export const P5_SOURCE_SESSION_ID = "P5-DESKTOP-1";
export const P5_PRIVATE_MEMORY_ID = "P5-M-PRIVATE";
export const P5_SHARED_MEMORY_ID = "P5-M-SHARED";
export const P5_PRIVATE_TURN_ID = "P5-T-PRIVATE";
export const P5_SHARED_TURN_ID = "P5-T-SHARED";
export const P5_QUERY = "Proyecto Atlas sábado temprano";
export const P5_AUTHORIZED_SCOPES = Object.freeze([
  "private_self",
  "household_shared",
  "temporary_session",
  "document_derived",
]);

function iso(value = new Date()) {
  return new Date(value).toISOString();
}

export function seedP5SyntheticDesktopState({ baseTime = new Date() } = {}) {
  const t0 = new Date(baseTime).getTime();
  const at = (offsetMs) => iso(new Date(t0 + offsetMs));

  let state = createLongitudinalConversationState({
    householdId: P5_SYNTHETIC_HOUSEHOLD_ID,
    lineageId: P5_SYNTHETIC_LINEAGE_ID,
  });

  state = openConversationSession(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: at(0),
  });

  state = appendConversationTurn(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    turnId: P5_PRIVATE_TURN_ID,
    speaker: "USER",
    personId: P5_SYNTHETIC_PERSON_ID,
    text: "Recuerda que Proyecto Atlas es privado y prefiero trabajarlo temprano.",
    timestamp: at(1_000),
  });
  state = proposeMemoryCandidate(state, {
    candidateId: "P5-C-PRIVATE",
    sessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    memoryType: "preference",
    content: "Proyecto Atlas: prefiere trabajarlo temprano.",
    visibilityScope: "private_self",
    evidenceTurnIds: [P5_PRIVATE_TURN_ID],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
    importance: 0.8,
  });
  state = adjudicateMemoryCandidate(state, {
    candidateId: "P5-C-PRIVATE",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: P5_PRIVATE_MEMORY_ID,
    adjudicatedAt: at(2_000),
  });

  state = appendConversationTurn(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    turnId: P5_SHARED_TURN_ID,
    speaker: "USER",
    personId: P5_SYNTHETIC_PERSON_ID,
    text: "Recuerda que la familia revisará Atlas el sábado.",
    timestamp: at(3_000),
  });
  state = proposeMemoryCandidate(state, {
    candidateId: "P5-C-SHARED",
    sessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    memoryType: "operational_context",
    content: "Proyecto Atlas: revisión familiar el sábado.",
    visibilityScope: "household_shared",
    evidenceTurnIds: [P5_SHARED_TURN_ID],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
    importance: 0.7,
  });
  state = adjudicateMemoryCandidate(state, {
    candidateId: "P5-C-SHARED",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: P5_SHARED_MEMORY_ID,
    adjudicatedAt: at(4_000),
  });

  return state;
}
