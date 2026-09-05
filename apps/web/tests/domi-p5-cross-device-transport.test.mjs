import test from "node:test";
import assert from "node:assert/strict";
import {
  closeConversationSession,
  openConversationSession,
} from "../lib/domiLongitudinalConversationSpine.mjs";
import {
  createSessionContinuationReceipt,
  consumeSessionContinuationReceipt,
  validateSessionContinuationReceipt,
} from "../lib/domiMultiSurfaceContinuity.mjs";
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
} from "../lib/domiP5SyntheticFixture.mjs";
import {
  createCrossDeviceTransportEnvelope,
  encodeCrossDeviceTransportEnvelope,
  decodeCrossDeviceTransportEnvelope,
} from "../lib/domiP5CrossDeviceTransport.mjs";

function makeTransport() {
  const fixtureBaseTime = "2026-09-05T14:00:00.000Z";
  const state = seedP5SyntheticDesktopState({ baseTime: fixtureBaseTime });
  const receipt = createSessionContinuationReceipt(state, {
    receiptId: "P5-XDEV-TEST",
    sourceSessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    targetSurfaceClass: "PERSONAL_MOBILE",
    purpose: "cross-device test",
    query: P5_QUERY,
    authorizedScopes: P5_AUTHORIZED_SCOPES,
    transferableTurnIds: [P5_PRIVATE_TURN_ID, P5_SHARED_TURN_ID],
    createdAt: "2026-09-05T14:01:00.000Z",
    expiresAt: "2026-09-05T17:01:00.000Z",
  });
  return { fixtureBaseTime, receipt };
}

test("cross-device envelope round-trips without raw memory, transcript, full state or authority", () => {
  const { fixtureBaseTime, receipt } = makeTransport();
  const envelope = createCrossDeviceTransportEnvelope({ receipt, fixtureBaseTime });
  const encoded = encodeCrossDeviceTransportEnvelope(envelope);
  const decoded = decodeCrossDeviceTransportEnvelope(encoded);

  assert.equal(decoded.receipt.receiptDigest, receipt.receiptDigest);
  assert.equal(decoded.transportContainsRawMemory, false);
  assert.equal(decoded.transportContainsRawTranscript, false);
  assert.equal(decoded.transportContainsFullState, false);
  assert.equal(decoded.transportIsAuthorityGrant, false);
  assert.equal(decoded.receipt.rawMemoryContentIncluded, false);
  assert.equal(decoded.receipt.rawTranscriptContentIncluded, false);
});

test("transported receipt validates and consumes against independently reconstructed phone fixture", () => {
  const { fixtureBaseTime, receipt } = makeTransport();
  const encoded = encodeCrossDeviceTransportEnvelope(
    createCrossDeviceTransportEnvelope({ receipt, fixtureBaseTime }),
  );
  const decoded = decodeCrossDeviceTransportEnvelope(encoded);
  const validation = validateSessionContinuationReceipt(decoded.receipt, {
    now: "2026-09-05T14:02:00.000Z",
    expectedPersonId: P5_SYNTHETIC_PERSON_ID,
    expectedTargetSurfaceClass: "PERSONAL_MOBILE",
  });
  assert.equal(validation.pass, true);

  let state = seedP5SyntheticDesktopState({ baseTime: decoded.fixtureBaseTime });
  state = closeConversationSession(state, {
    sessionId: P5_SOURCE_SESSION_ID,
    endedAt: "2026-09-05T14:02:10.000Z",
  });
  state = openConversationSession(state, {
    sessionId: "P5-PHONE-REAL-TEST",
    personId: P5_SYNTHETIC_PERSON_ID,
    surfaceClass: "PERSONAL_MOBILE",
    startedAt: "2026-09-05T14:02:20.000Z",
  });

  const result = consumeSessionContinuationReceipt(state, {
    receipt: decoded.receipt,
    targetSessionId: "P5-PHONE-REAL-TEST",
    now: "2026-09-05T14:02:30.000Z",
    query: P5_QUERY,
    authorizedScopes: P5_AUTHORIZED_SCOPES,
  });

  assert.deepEqual(result.memoryIds.sort(), [P5_PRIVATE_MEMORY_ID, P5_SHARED_MEMORY_ID].sort());
  assert.equal(result.targetSurfaceClass, "PERSONAL_MOBILE");
  assert.equal(result.identityRecreated, false);
});

test("transport decoder rejects envelope that claims raw-memory transport", () => {
  const { fixtureBaseTime, receipt } = makeTransport();
  const envelope = createCrossDeviceTransportEnvelope({ receipt, fixtureBaseTime });
  const tampered = { ...envelope, transportContainsRawMemory: true };
  const payload = Buffer.from(JSON.stringify(tampered), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  assert.throws(() => decodeCrossDeviceTransportEnvelope(payload), /RAW_MEMORY_TRANSPORT_FORBIDDEN/);
});
