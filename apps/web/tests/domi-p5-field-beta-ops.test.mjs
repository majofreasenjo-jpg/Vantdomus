import test from "node:test";
import assert from "node:assert/strict";
import {
  P5_FIELD_BETA_CANONICAL_CONTINUITY_KEY,
  P5_FIELD_BETA_INCIDENT_LEVELS,
  admitP5FieldBetaSession,
  classifyP5FieldBetaIncident,
  adjudicateP5FieldBetaSession,
  adjudicateP5FieldBetaOperationalization,
} from "../lib/domiP5FieldBetaOps.mjs";

function admission(overrides = {}) {
  return admitP5FieldBetaSession({
    cell: "WINDOWS_EDGE_SOURCE",
    previewEnvironmentPass: true,
    syntheticOnly: true,
    operatorBoundaryConfirmed: true,
    artifactValidationPass: true,
    continuityKey: P5_FIELD_BETA_CANONICAL_CONTINUITY_KEY,
    realOwnerMemoryUsed: false,
    productionMutationRequested: false,
    externalOutreachRequested: false,
    rawMemoryPersisted: false,
    rawTranscriptPersisted: false,
    fullStatePersisted: false,
    authorityPersisted: false,
    detectedPlatformClass: "WINDOWS",
    detectedBrowserClass: "EDGE",
    role: "SOURCE",
    ...overrides,
  });
}

function probe(id, nonce) {
  return {
    ok: true,
    status: 200,
    previewEnvironmentPass: true,
    probeId: id,
    clientNonce: nonce,
    serverTime: "2026-09-21T12:00:00.000Z",
  };
}

function continuity(overrides = {}) {
  return {
    pass: true,
    receiptStable: true,
    artifactStable: true,
    continuityKeyStable: true,
    continuityKey: P5_FIELD_BETA_CANONICAL_CONTINUITY_KEY,
    projectedMemoryIds: ["P5-M-PRIVATE", "P5-M-SHARED"],
    rawMemoryPersisted: false,
    rawTranscriptPersisted: false,
    fullStatePersisted: false,
    authorityPersisted: false,
    ...overrides,
  };
}

test("supported Windows Edge source session admits only inside preview synthetic boundary", () => {
  const result = admission();
  assert.equal(result.pass, true);
  assert.equal(result.decision, "ADMIT_SYNTHETIC_BOUNDED_BETA");
});

test("unsupported cell fails closed", () => {
  const result = admission({ cell: "WINDOWS_CHROME_SOURCE", detectedBrowserClass: "CHROME" });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("UNSUPPORTED_BROWSER_OS_DEVICE_CELL"), true);
});

test("non-preview environment fails closed", () => {
  const result = admission({ previewEnvironmentPass: false });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("PREVIEW_ENVIRONMENT_REQUIRED"), true);
});

test("real owner memory fails closed", () => {
  const result = admission({ realOwnerMemoryUsed: true });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("REAL_OWNER_MEMORY_FORBIDDEN"), true);
});

test("production mutation fails closed", () => {
  const result = admission({ productionMutationRequested: true });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("PRODUCTION_MUTATION_FORBIDDEN"), true);
});

test("external outreach remains unauthorized", () => {
  const result = admission({ externalOutreachRequested: true });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("EXTERNAL_OUTREACH_NOT_AUTHORIZED"), true);
});

test("privacy or authority leakage is B3 beta stop", () => {
  const result = classifyP5FieldBetaIncident({ rawMemoryObserved: true });
  assert.equal(result.level, P5_FIELD_BETA_INCIDENT_LEVELS.B3_BETA_STOP);
  assert.equal(result.betaMayContinue, false);
});

test("temporary access exposure is B4 stop and rotate", () => {
  const result = classifyP5FieldBetaIncident({ secretOrTemporaryAccessExposed: true });
  assert.equal(result.level, P5_FIELD_BETA_INCIDENT_LEVELS.B4_SECRET_STOP_ROTATE);
  assert.equal(result.betaMayContinue, false);
});

test("continuity drift is B2 cell hold", () => {
  const result = classifyP5FieldBetaIncident({ receiptDrift: true });
  assert.equal(result.level, P5_FIELD_BETA_INCIDENT_LEVELS.B2_CELL_HOLD);
  assert.equal(result.cellMayContinue, false);
});

test("clean admitted session with fresh probes closes PASS_BOUNDED", () => {
  const result = adjudicateP5FieldBetaSession({
    admission: admission(),
    preProbe: probe("probe-pre-111", "nonce-pre-111"),
    postProbe: probe("probe-post-222", "nonce-post-222"),
    continuity: continuity(),
    incident: classifyP5FieldBetaIncident({}),
    operatorEndConfirmed: true,
  });
  assert.equal(result.pass, true);
  assert.equal(result.decision, "SESSION_PASS_BOUNDED");
});

test("reused probe fails closed", () => {
  const result = adjudicateP5FieldBetaSession({
    admission: admission(),
    preProbe: probe("probe-same-111", "nonce-same-111"),
    postProbe: probe("probe-same-111", "nonce-same-111"),
    continuity: continuity(),
    incident: classifyP5FieldBetaIncident({}),
    operatorEndConfirmed: true,
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("PROBE_ID_NOT_FRESH"), true);
  assert.equal(result.failures.includes("PROBE_NONCE_NOT_FRESH"), true);
});

test("B3 incident forces STOP_BETA", () => {
  const result = adjudicateP5FieldBetaSession({
    admission: admission(),
    preProbe: probe("probe-pre-111", "nonce-pre-111"),
    postProbe: probe("probe-post-222", "nonce-post-222"),
    continuity: continuity(),
    incident: classifyP5FieldBetaIncident({ authorityExpansionObserved: true }),
    operatorEndConfirmed: true,
  });
  assert.equal(result.pass, false);
  assert.equal(result.decision, "STOP_BETA");
});

test("operationalization readiness passes only with all frozen controls and no production/real-memory/outreach", () => {
  const result = adjudicateP5FieldBetaOperationalization({
    supportContractFrozen: true,
    runbookFrozen: true,
    incidentProtocolFrozen: true,
    rollbackProtocolFrozen: true,
    minimumTelemetryFrozen: true,
    ciPass: true,
    previewReady: true,
    productionMutation: false,
    realOwnerMemory: false,
    externalOutreach: false,
  });
  assert.equal(result.pass, true);
  assert.equal(result.decision, "BOUNDED_FIELD_BETA_OPERATIONALIZATION_READY=PASS_BOUNDED");
});
