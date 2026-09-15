import {
  closeConversationSession,
  openConversationSession,
} from "./domiLongitudinalConversationSpine.mjs";
import {
  createSessionContinuationReceipt,
  consumeSessionContinuationReceipt,
  validateSessionContinuationReceipt,
} from "./domiMultiSurfaceContinuity.mjs";
import {
  seedP5SyntheticDesktopState,
  P5_SYNTHETIC_PERSON_ID,
  P5_SOURCE_SESSION_ID,
  P5_PRIVATE_MEMORY_ID,
  P5_SHARED_MEMORY_ID,
  P5_QUERY,
  P5_AUTHORIZED_SCOPES,
} from "./domiP5SyntheticFixture.mjs";

export const DOMI_P5_FIELD_BETA_ROUND_TRIP_VERSION = "DOMI_P5_FIELD_BETA_ROUND_TRIP_V0_1";
export const P5_MOBILE_SESSION_ID = "P5-PHONE-ROUNDTRIP-1";
export const P5_RETURN_DESKTOP_SESSION_ID = "P5-DESKTOP-RETURN-1";

function plusMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function buildP5SyntheticRoundTrip({ baseTime, receiptTime, returnReceiptTime }) {
  let state = seedP5SyntheticDesktopState({ baseTime });
  state = closeConversationSession(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    endedAt: receiptTime,
  });
  state = openConversationSession(state, {
    sessionId: P5_MOBILE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: receiptTime,
  });

  const forwardReceipt = createSessionContinuationReceipt(state, {
    receiptId: "P5-FIELD-FORWARD-1",
    sourceSessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    targetSurfaceClass: "PERSONAL_MOBILE",
    purpose: "bounded field-beta forward continuity",
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
    transferableTurnIds: [],
    createdAt: receiptTime,
    expiresAt: plusMinutes(receiptTime, 30),
  });

  const forwardValidation = validateSessionContinuationReceipt(forwardReceipt, {
    now: receiptTime,
    expectedPersonId: P5_SYNTHETIC_PERSON_ID,
    expectedTargetSurfaceClass: "PERSONAL_MOBILE",
  });
  if (!forwardValidation.pass) throw new Error(`FORWARD_RECEIPT_INVALID:${forwardValidation.failures.join("|")}`);

  const forwardConsumption = consumeSessionContinuationReceipt(state, {
    receipt: forwardReceipt,
    targetSessionId: P5_MOBILE_SESSION_ID,
    now: receiptTime,
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
  });

  state = closeConversationSession(state, {
    sessionId: P5_MOBILE_SESSION_ID,
    endedAt: returnReceiptTime,
  });
  state = openConversationSession(state, {
    sessionId: P5_RETURN_DESKTOP_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: returnReceiptTime,
  });

  const returnReceipt = createSessionContinuationReceipt(state, {
    receiptId: "P5-FIELD-RETURN-1",
    sourceSessionId: P5_MOBILE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    targetSurfaceClass: "PERSONAL_DESKTOP",
    purpose: "bounded field-beta return continuity",
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
    transferableTurnIds: [],
    createdAt: returnReceiptTime,
    expiresAt: plusMinutes(returnReceiptTime, 30),
  });

  const returnValidation = validateSessionContinuationReceipt(returnReceipt, {
    now: returnReceiptTime,
    expectedPersonId: P5_SYNTHETIC_PERSON_ID,
    expectedTargetSurfaceClass: "PERSONAL_DESKTOP",
  });
  if (!returnValidation.pass) throw new Error(`RETURN_RECEIPT_INVALID:${returnValidation.failures.join("|")}`);

  const returnConsumption = consumeSessionContinuationReceipt(state, {
    receipt: returnReceipt,
    targetSessionId: P5_RETURN_DESKTOP_SESSION_ID,
    now: returnReceiptTime,
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
  });

  const expectedMemoryIds = [P5_PRIVATE_MEMORY_ID, P5_SHARED_MEMORY_ID].sort();
  const forwardIds = [...forwardConsumption.memoryIds].sort();
  const returnIds = [...returnConsumption.memoryIds].sort();

  return Object.freeze({
    version: DOMI_P5_FIELD_BETA_ROUND_TRIP_VERSION,
    forwardReceipt,
    forwardConsumption,
    returnReceipt,
    returnConsumption,
    checks: Object.freeze({
      forwardExpectedMemories: JSON.stringify(forwardIds) === JSON.stringify(expectedMemoryIds),
      returnExpectedMemories: JSON.stringify(returnIds) === JSON.stringify(expectedMemoryIds),
      continuityKeyStable: forwardReceipt.continuityKey === returnReceipt.continuityKey,
      forwardRawMemoryTransported: forwardReceipt.rawMemoryContentIncluded,
      forwardRawTranscriptTransported: forwardReceipt.rawTranscriptContentIncluded,
      returnRawMemoryTransported: returnReceipt.rawMemoryContentIncluded,
      returnRawTranscriptTransported: returnReceipt.rawTranscriptContentIncluded,
      productionMutation: false,
    }),
  });
}
