import test from "node:test";
import assert from "node:assert/strict";
import {
  P5_DEVICE_MATRIX_CELLS,
  classifyP5BrowserEnvironment,
  adjudicateP5DeviceMatrixCell,
  adjudicateP5SupportedMatrix,
} from "../lib/domiP5DeviceMatrix.mjs";

const KEY = "fnv1a32:2b7f23b7";
const RECEIPT_DIGEST = "fnv1a32:11111111";
const ARTIFACT_DIGEST = "fnv1a32:22222222";

function probe(id, nonce, time) {
  return { ok: true, status: 200, probeId: id, clientNonce: nonce, serverTime: time };
}

function destinationObs({ stage, cell = P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION, time, probeId, nonce, transition = false } = {}) {
  return {
    stage,
    cell,
    selectedCell: cell,
    ownerPhysicalEnvironmentConfirmed: true,
    ownerTransitionConfirmed: transition,
    detectedPlatformClass: "ANDROID",
    detectedBrowserClass: "CHROME",
    role: "DESTINATION",
    browserOnline: true,
    handoffPresent: false,
    observedAt: time,
    probe: probe(probeId, nonce, time),
    continuity: {
      pass: true,
      receiptId: "P5-MATRIX-TEST-1",
      receiptDigest: RECEIPT_DIGEST,
      artifactDigest: ARTIFACT_DIGEST,
      continuityKey: KEY,
      memoryIds: ["P5-M-PRIVATE", "P5-M-SHARED"],
      rawMemoryPersisted: false,
      rawTranscriptPersisted: false,
      fullStatePersisted: false,
      authorityPersisted: false,
    },
  };
}

function sourceObs({ stage, cell = P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE, time, probeId, nonce, transition = false } = {}) {
  return {
    stage,
    cell,
    selectedCell: cell,
    ownerPhysicalEnvironmentConfirmed: true,
    ownerTransitionConfirmed: transition,
    detectedPlatformClass: "WINDOWS",
    detectedBrowserClass: "EDGE",
    role: "SOURCE",
    browserOnline: true,
    handoffPresent: false,
    observedAt: time,
    probe: probe(probeId, nonce, time),
    continuity: {
      pass: true,
      sourceReplayPass: true,
      receiptId: "P5-MATRIX-TEST-1",
      receiptDigest: RECEIPT_DIGEST,
      artifactDigest: ARTIFACT_DIGEST,
      continuityKey: KEY,
      projectedMemoryIds: ["P5-M-PRIVATE", "P5-M-SHARED"],
      rawMemoryPersisted: false,
      rawTranscriptPersisted: false,
      fullStatePersisted: false,
      authorityPersisted: false,
    },
  };
}

test("classifies Android Chrome", () => {
  const result = classifyP5BrowserEnvironment({
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/153.0.0.0 Mobile Safari/537.36",
    platform: "Linux armv8l",
  });
  assert.equal(result.platformClass, "ANDROID");
  assert.equal(result.browserClass, "CHROME");
  assert.equal(result.suggestedCell, P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION);
});

test("classifies Windows Edge", () => {
  const result = classifyP5BrowserEnvironment({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0",
    platform: "Win32",
  });
  assert.equal(result.platformClass, "WINDOWS");
  assert.equal(result.browserClass, "EDGE");
  assert.equal(result.suggestedCell, P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE);
});

test("classifies Windows Chrome", () => {
  const result = classifyP5BrowserEnvironment({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
    platform: "Win32",
  });
  assert.equal(result.browserClass, "CHROME");
  assert.equal(result.suggestedCell, P5_DEVICE_MATRIX_CELLS.WINDOWS_CHROME_SOURCE);
});

test("classifies iOS Safari", () => {
  const result = classifyP5BrowserEnvironment({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1",
    platform: "iPhone",
  });
  assert.equal(result.platformClass, "IOS");
  assert.equal(result.browserClass, "SAFARI");
  assert.equal(result.suggestedCell, P5_DEVICE_MATRIX_CELLS.IOS_SAFARI_DESTINATION);
});

test("Android Chrome destination passes only after full reopen witness", () => {
  const baseline = destinationObs({
    stage: "BASELINE",
    time: "2026-09-20T22:00:00.000Z",
    probeId: "probe-baseline-1",
    nonce: "nonce-baseline-1",
  });
  const after = destinationObs({
    stage: "REOPEN",
    time: "2026-09-20T22:01:00.000Z",
    probeId: "probe-reopen-2",
    nonce: "nonce-reopen-2",
    transition: true,
  });
  const result = adjudicateP5DeviceMatrixCell({
    cell: P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION,
    baseline,
    after,
  });
  assert.equal(result.pass, true);
});

test("destination browser mismatch fails closed", () => {
  const baseline = destinationObs({
    stage: "BASELINE",
    time: "2026-09-20T22:00:00.000Z",
    probeId: "probe-a",
    nonce: "nonce-a",
  });
  baseline.detectedBrowserClass = "EDGE";
  const after = destinationObs({
    stage: "REOPEN",
    time: "2026-09-20T22:01:00.000Z",
    probeId: "probe-b",
    nonce: "nonce-b",
    transition: true,
  });
  const result = adjudicateP5DeviceMatrixCell({
    cell: P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION,
    baseline,
    after,
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("BASELINE_BROWSER_MISMATCH"), true);
});

test("destination without physical reopen confirmation fails closed", () => {
  const baseline = destinationObs({
    stage: "BASELINE",
    time: "2026-09-20T22:00:00.000Z",
    probeId: "probe-a",
    nonce: "nonce-a",
  });
  const after = destinationObs({
    stage: "REOPEN",
    time: "2026-09-20T22:01:00.000Z",
    probeId: "probe-b",
    nonce: "nonce-b",
    transition: false,
  });
  const result = adjudicateP5DeviceMatrixCell({
    cell: P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION,
    baseline,
    after,
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AFTER_OWNER_TRANSITION_CONFIRMATION_REQUIRED"), true);
});

test("source Edge passes after reload with source replay", () => {
  const baseline = sourceObs({
    stage: "BASELINE",
    time: "2026-09-20T22:00:00.000Z",
    probeId: "probe-source-a",
    nonce: "nonce-source-a",
  });
  const after = sourceObs({
    stage: "RELOAD",
    time: "2026-09-20T22:01:00.000Z",
    probeId: "probe-source-b",
    nonce: "nonce-source-b",
    transition: true,
  });
  const result = adjudicateP5DeviceMatrixCell({
    cell: P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE,
    baseline,
    after,
  });
  assert.equal(result.pass, true);
});

test("reused probe identity fails closed", () => {
  const baseline = sourceObs({
    stage: "BASELINE",
    time: "2026-09-20T22:00:00.000Z",
    probeId: "same-probe-id",
    nonce: "same-probe-nonce",
  });
  const after = sourceObs({
    stage: "RELOAD",
    time: "2026-09-20T22:01:00.000Z",
    probeId: "same-probe-id",
    nonce: "same-probe-nonce",
    transition: true,
  });
  const result = adjudicateP5DeviceMatrixCell({
    cell: P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE,
    baseline,
    after,
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("PROBE_ID_NOT_FRESH"), true);
  assert.equal(result.failures.includes("PROBE_NONCE_NOT_FRESH"), true);
});

test("receipt digest drift fails closed", () => {
  const baseline = sourceObs({
    stage: "BASELINE",
    time: "2026-09-20T22:00:00.000Z",
    probeId: "probe-a",
    nonce: "nonce-a",
  });
  const after = sourceObs({
    stage: "RELOAD",
    time: "2026-09-20T22:01:00.000Z",
    probeId: "probe-b",
    nonce: "nonce-b",
    transition: true,
  });
  after.continuity.receiptDigest = "fnv1a32:33333333";
  const result = adjudicateP5DeviceMatrixCell({
    cell: P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE,
    baseline,
    after,
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("RECEIPT_DIGEST_CHANGED"), true);
});

test("raw memory persistence fails closed", () => {
  const baseline = destinationObs({
    stage: "BASELINE",
    time: "2026-09-20T22:00:00.000Z",
    probeId: "probe-a",
    nonce: "nonce-a",
  });
  const after = destinationObs({
    stage: "REOPEN",
    time: "2026-09-20T22:01:00.000Z",
    probeId: "probe-b",
    nonce: "nonce-b",
    transition: true,
  });
  after.continuity.rawMemoryPersisted = true;
  const result = adjudicateP5DeviceMatrixCell({
    cell: P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION,
    baseline,
    after,
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AFTER_RAW_MEMORY_PERSISTENCE_FORBIDDEN"), true);
});

test("supported matrix requires at least one source and one destination cell", () => {
  const sourceResult = {
    pass: true,
    cell: P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE,
    role: "SOURCE",
  };
  const destinationResult = {
    pass: true,
    cell: P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION,
    role: "DESTINATION",
  };
  const result = adjudicateP5SupportedMatrix([sourceResult, destinationResult]);
  assert.equal(result.pass, true);
  assert.deepEqual([...result.supportedCells].sort(), [
    P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION,
    P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE,
  ].sort());
  assert.equal(result.universalCompatibilityClaim, false);
});

test("matrix with destination only remains HOLD", () => {
  const result = adjudicateP5SupportedMatrix([{
    pass: true,
    cell: P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION,
    role: "DESTINATION",
  }]);
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AT_LEAST_ONE_SOURCE_CELL_REQUIRED"), true);
});
