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

export const DOMI_P5_MOBILE_TO_DESKTOP_RETURN_VERSION = "DOMI_P5_MOBILE_TO_DESKTOP_RETURN_V0_1";
export const P5_RETURN_SOURCE_MOBILE_SESSION_ID = "P5-PHONE-RETURN-SOURCE-1";
export const P5_RETURN_TARGET_DESKTOP_SESSION_ID = "P5-DESKTOP-RETURN-TARGET-1";

function plusMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function createP5MobileToDesktopReturnReceipt({ baseTime, now }) {
  let state = seedP5SyntheticDesktopState({ baseTime });
  state = closeConversationSession(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    endedAt: now,
  });
  state = openConversationSession(state, {
    sessionId: P5_RETURN_SOURCE_MOBILE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: now,
  });

  const receipt = createSessionContinuationReceipt(state, {
    receiptId: `P5-M2D-${new Date(now).getTime()}`,
    sourceSessionId: P5_RETURN_SOURCE_MOBILE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    targetSurfaceClass: "PERSONAL_DESKTOP",
    purpose: "P5 physical mobile to desktop bounded return",
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
    transferableTurnIds: [],
    createdAt: now,
    expiresAt: plusMinutes(now, 180),
  });

  return Object.freeze({ state, receipt });
}

export function consumeP5MobileToDesktopReturnReceipt({ baseTime, receipt, now }) {
  let state = seedP5SyntheticDesktopState({ baseTime });
  state = closeConversationSession(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    endedAt: receipt.createdAt,
  });
  state = openConversationSession(state, {
    sessionId: P5_RETURN_SOURCE_MOBILE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: receipt.createdAt,
  });
  state = closeConversationSession(state, {
    sessionId: P5_RETURN_SOURCE_MOBILE_SESSION_ID,
    endedAt: now,
  });
  state = openConversationSession(state, {
    sessionId: P5_RETURN_TARGET_DESKTOP_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: now,
  });

  const validation = validateSessionContinuationReceipt(receipt, {
    now,
    expectedPersonId: P5_SYNTHETIC_PERSON_ID,
    expectedTargetSurfaceClass: "PERSONAL_DESKTOP",
  });
  if (!validation.pass) throw new Error(`RETURN_RECEIPT_INVALID:${validation.failures.join("|")}`);

  const consumed = consumeSessionContinuationReceipt(state, {
    receipt,
    targetSessionId: P5_RETURN_TARGET_DESKTOP_SESSION_ID,
    now,
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
  });

  const expected = [P5_PRIVATE_MEMORY_ID, P5_SHARED_MEMORY_ID].sort();
  const actual = [...consumed.memoryIds].sort();
  return Object.freeze({
    validation,
    consumed,
    expectedMemoriesRecovered: JSON.stringify(expected) === JSON.stringify(actual),
  });
}
