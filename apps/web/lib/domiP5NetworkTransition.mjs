export const DOMI_P5_NETWORK_TRANSITION_VERSION = "DOMI_P5_NETWORK_TRANSITION_V0_1";
export const P5_NETWORK_GATE_ARTIFACT_STORAGE_KEY = "domi:p5:network-transition-artifact:v0.1";

export const P5_NETWORK_DIRECTIONS = Object.freeze({
  WIFI_TO_MOBILE_DATA: "WIFI_TO_MOBILE_DATA",
  MOBILE_DATA_TO_WIFI: "MOBILE_DATA_TO_WIFI",
});

const NETWORK_CLASS = Object.freeze({
  WIFI: "WIFI",
  MOBILE_DATA: "MOBILE_DATA",
});

const EXPECTED_BY_DIRECTION = Object.freeze({
  [P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA]: Object.freeze({ before: NETWORK_CLASS.WIFI, after: NETWORK_CLASS.MOBILE_DATA }),
  [P5_NETWORK_DIRECTIONS.MOBILE_DATA_TO_WIFI]: Object.freeze({ before: NETWORK_CLASS.MOBILE_DATA, after: NETWORK_CLASS.WIFI }),
});

const EXPECTED_MEMORY_IDS = Object.freeze(["P5-M-PRIVATE", "P5-M-SHARED"]);
const DIGEST_RE = /^fnv1a32:[0-9a-f]{8}$/;

function validIso(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  return !Number.isNaN(new Date(value).getTime());
}

function sameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function validateObservation(observation, expectedNetworkClass, label) {
  const failures = [];
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
    return [`${label}_OBSERVATION_REQUIRED`];
  }

  if (observation.declaredNetworkClass !== expectedNetworkClass) failures.push(`${label}_NETWORK_CLASS_MISMATCH`);
  if (observation.ownerPhysicalNetworkConfirmed !== true) failures.push(`${label}_OWNER_PHYSICAL_CONFIRMATION_REQUIRED`);
  if (observation.browserOnline !== true) failures.push(`${label}_BROWSER_OFFLINE`);
  if (observation.handoffPresent !== false) failures.push(`${label}_HANDOFF_MUST_BE_ABSENT`);
  if (!validIso(observation.observedAt)) failures.push(`${label}_OBSERVED_AT_INVALID`);

  const probe = observation.probe;
  if (!probe || typeof probe !== "object") {
    failures.push(`${label}_FRESH_PROBE_REQUIRED`);
  } else {
    if (probe.ok !== true || probe.status !== 200) failures.push(`${label}_FRESH_PROBE_FAILED`);
    if (typeof probe.probeId !== "string" || probe.probeId.length < 8) failures.push(`${label}_PROBE_ID_INVALID`);
    if (typeof probe.clientNonce !== "string" || probe.clientNonce.length < 8) failures.push(`${label}_PROBE_NONCE_INVALID`);
    if (!validIso(probe.serverTime)) failures.push(`${label}_PROBE_SERVER_TIME_INVALID`);
  }

  const reconstruction = observation.reconstruction;
  if (!reconstruction || typeof reconstruction !== "object") {
    failures.push(`${label}_RECONSTRUCTION_REQUIRED`);
  } else {
    if (reconstruction.pass !== true) failures.push(`${label}_RECONSTRUCTION_FAILED`);
    if (!sameStringArray(reconstruction.memoryIds, EXPECTED_MEMORY_IDS)) failures.push(`${label}_RECOVERED_REFERENCES_MISMATCH`);
    if (!DIGEST_RE.test(String(reconstruction.continuityKey ?? ""))) failures.push(`${label}_CONTINUITY_KEY_INVALID`);
    if (!DIGEST_RE.test(String(reconstruction.receiptDigest ?? ""))) failures.push(`${label}_RECEIPT_DIGEST_INVALID`);
    if (!DIGEST_RE.test(String(reconstruction.artifactDigest ?? ""))) failures.push(`${label}_ARTIFACT_DIGEST_INVALID`);
    if (typeof reconstruction.receiptId !== "string" || reconstruction.receiptId.length < 8) failures.push(`${label}_RECEIPT_ID_INVALID`);
    if (reconstruction.rawMemoryPersisted !== false) failures.push(`${label}_RAW_MEMORY_PERSISTENCE_FORBIDDEN`);
    if (reconstruction.rawTranscriptPersisted !== false) failures.push(`${label}_RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN`);
    if (reconstruction.fullStatePersisted !== false) failures.push(`${label}_FULL_STATE_PERSISTENCE_FORBIDDEN`);
    if (reconstruction.authorityPersisted !== false) failures.push(`${label}_AUTHORITY_PERSISTENCE_FORBIDDEN`);
  }

  return failures;
}

export function adjudicateP5NetworkTransition({ direction, before, after }) {
  const failures = [];
  const expected = EXPECTED_BY_DIRECTION[direction];
  if (!expected) {
    return Object.freeze({
      version: DOMI_P5_NETWORK_TRANSITION_VERSION,
      pass: false,
      direction,
      failures: Object.freeze(["NETWORK_DIRECTION_UNSUPPORTED"]),
      claim: "HOLD",
    });
  }

  failures.push(...validateObservation(before, expected.before, "BEFORE"));
  failures.push(...validateObservation(after, expected.after, "AFTER"));

  if (before && after) {
    if (before.declaredNetworkClass === after.declaredNetworkClass) failures.push("NETWORK_CLASS_DID_NOT_CHANGE");

    if (before.probe && after.probe) {
      if (before.probe.probeId === after.probe.probeId) failures.push("PROBE_ID_NOT_FRESH");
      if (before.probe.clientNonce === after.probe.clientNonce) failures.push("PROBE_NONCE_NOT_FRESH");
      if (validIso(before.probe.serverTime) && validIso(after.probe.serverTime)
        && new Date(after.probe.serverTime).getTime() < new Date(before.probe.serverTime).getTime()) {
        failures.push("PROBE_SERVER_TIME_REGRESSED");
      }
    }

    if (validIso(before.observedAt) && validIso(after.observedAt)
      && new Date(after.observedAt).getTime() <= new Date(before.observedAt).getTime()) {
      failures.push("OBSERVATION_TIME_NOT_ADVANCED");
    }

    if (before.reconstruction && after.reconstruction) {
      if (before.reconstruction.receiptId !== after.reconstruction.receiptId) failures.push("RECEIPT_ID_CHANGED_ACROSS_NETWORK_SWITCH");
      if (before.reconstruction.receiptDigest !== after.reconstruction.receiptDigest) failures.push("RECEIPT_DIGEST_CHANGED_ACROSS_NETWORK_SWITCH");
      if (before.reconstruction.artifactDigest !== after.reconstruction.artifactDigest) failures.push("ARTIFACT_DIGEST_CHANGED_ACROSS_NETWORK_SWITCH");
      if (before.reconstruction.continuityKey !== after.reconstruction.continuityKey) failures.push("CONTINUITY_KEY_CHANGED_ACROSS_NETWORK_SWITCH");
    }
  }

  return Object.freeze({
    version: DOMI_P5_NETWORK_TRANSITION_VERSION,
    pass: failures.length === 0,
    direction,
    expectedBeforeNetworkClass: expected.before,
    expectedAfterNetworkClass: expected.after,
    failures: Object.freeze(failures),
    claim: failures.length === 0 ? `${direction}=PASS_BOUNDED` : "HOLD",
    measurementBoundary: "OWNER_PHYSICAL_NETWORK_CONFIRMATION_PLUS_FRESH_SAME_ORIGIN_PROBE; BROWSER_NETWORK_HINT_NON_LOAD_BEARING",
  });
}
