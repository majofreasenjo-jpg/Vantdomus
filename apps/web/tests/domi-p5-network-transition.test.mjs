import test from "node:test";
import assert from "node:assert/strict";
import {
  P5_NETWORK_DIRECTIONS,
  adjudicateP5NetworkTransition,
} from "../lib/domiP5NetworkTransition.mjs";

function observation({ networkClass, stage = "BEFORE", probeId = "probe-before-123", nonce = "nonce-before-123", observedAt = "2026-09-16T15:00:00.000Z", serverTime = "2026-09-16T15:00:00.100Z" } = {}) {
  return {
    stage,
    declaredNetworkClass: networkClass,
    ownerPhysicalNetworkConfirmed: true,
    browserOnline: true,
    browserConnectionHint: "effectiveType=4g",
    handoffPresent: false,
    observedAt,
    probe: {
      ok: true,
      status: 200,
      probeId,
      clientNonce: nonce,
      serverTime,
    },
    reconstruction: {
      pass: true,
      receiptId: "P5-NETWORK-123456",
      receiptDigest: "fnv1a32:12345678",
      artifactDigest: "fnv1a32:87654321",
      continuityKey: "fnv1a32:2b7f23b7",
      memoryIds: ["P5-M-PRIVATE", "P5-M-SHARED"],
      rawMemoryPersisted: false,
      rawTranscriptPersisted: false,
      fullStatePersisted: false,
      authorityPersisted: false,
    },
  };
}

function pair(direction) {
  const wifiToMobile = direction === P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA;
  return {
    before: observation({ networkClass: wifiToMobile ? "WIFI" : "MOBILE_DATA" }),
    after: observation({
      networkClass: wifiToMobile ? "MOBILE_DATA" : "WIFI",
      stage: "AFTER",
      probeId: "probe-after-456",
      nonce: "nonce-after-456",
      observedAt: "2026-09-16T15:01:00.000Z",
      serverTime: "2026-09-16T15:01:00.100Z",
    }),
  };
}

test("Wi-Fi to mobile data passes only with fresh probe and stable reconstruction", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, true);
  assert.equal(result.claim, "WIFI_TO_MOBILE_DATA=PASS_BOUNDED");
});

test("mobile data to Wi-Fi passes symmetrically", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.MOBILE_DATA_TO_WIFI);
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.MOBILE_DATA_TO_WIFI, before, after });
  assert.equal(result.pass, true);
});

test("missing owner physical confirmation fails closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.ownerPhysicalNetworkConfirmed = false;
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AFTER_OWNER_PHYSICAL_CONFIRMATION_REQUIRED"), true);
});

test("same declared network class fails closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.declaredNetworkClass = "WIFI";
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("NETWORK_CLASS_DID_NOT_CHANGE"), true);
});

test("reused probe identity and nonce fail closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.probe.probeId = before.probe.probeId;
  after.probe.clientNonce = before.probe.clientNonce;
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("PROBE_ID_NOT_FRESH"), true);
  assert.equal(result.failures.includes("PROBE_NONCE_NOT_FRESH"), true);
});

test("receipt digest drift across network switch fails closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.reconstruction.receiptDigest = "fnv1a32:aaaaaaaa";
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("RECEIPT_DIGEST_CHANGED_ACROSS_NETWORK_SWITCH"), true);
});

test("continuity key drift across network switch fails closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.reconstruction.continuityKey = "fnv1a32:aaaaaaaa";
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("CONTINUITY_KEY_CHANGED_ACROSS_NETWORK_SWITCH"), true);
});

test("failed reconstruction fails closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.reconstruction.pass = false;
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AFTER_RECONSTRUCTION_FAILED"), true);
});

test("wrong recovered references fail closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.reconstruction.memoryIds = ["P5-M-PRIVATE"];
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AFTER_RECOVERED_REFERENCES_MISMATCH"), true);
});

test("handoff reappearance fails closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.handoffPresent = true;
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AFTER_HANDOFF_MUST_BE_ABSENT"), true);
});

test("raw memory persistence fails closed", () => {
  const { before, after } = pair(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  after.reconstruction.rawMemoryPersisted = true;
  const result = adjudicateP5NetworkTransition({ direction: P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA, before, after });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AFTER_RAW_MEMORY_PERSISTENCE_FORBIDDEN"), true);
});

test("unsupported direction fails closed", () => {
  const result = adjudicateP5NetworkTransition({ direction: "WIFI_TO_WIFI", before: {}, after: {} });
  assert.equal(result.pass, false);
  assert.deepEqual(result.failures, ["NETWORK_DIRECTION_UNSUPPORTED"]);
});
