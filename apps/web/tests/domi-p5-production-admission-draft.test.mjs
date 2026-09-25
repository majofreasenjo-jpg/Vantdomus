import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateP5ProductionAdmissionDraft,
  validateP5ProductionAdmissionEvidenceDraft,
} from "../lib/domiP5ProductionAdmissionDraft.mjs";

const COMMIT = "1234567890abcdef1234567890abcdef12345678";
const ROLLBACK = "abcdef1234567890abcdef1234567890abcdef12";
const CONFIG = "sha256:" + "a".repeat(64);

function fixture(overrides = {}) {
  return {
    targetEnvironment: "production",
    contractMode: "DESIGN_ONLY_NON_EXECUTABLE",
    explicitProductionAuthorization: true,
    authenticatedSession: true,
    authorizedOwnerScope: true,
    tenantScopeValid: true,
    identityAssurancePass: true,
    cell: "WINDOWS_EDGE_SOURCE",
    demoFallbackEnabled: false,
    publicStaticAccessTokenPresent: false,
    temporaryShareTokenDependency: false,
    securityGatePass: true,
    secretScanPass: true,
    webSessionSecurityLintPass: true,
    productionReadinessReportPass: true,
    productionPreflightPass: true,
    productionPreflightSkippedNetwork: false,
    healthCheckPass: true,
    expectedCommitSha: COMMIT,
    observedCommitSha: COMMIT,
    expectedConfigDigest: CONFIG,
    observedConfigDigest: CONFIG,
    rollbackAnchorCommit: ROLLBACK,
    rollbackDrillPass: true,
    incidentStopAuthorityActive: true,
    telemetryPolicyPass: true,
    rawMemoryInTelemetry: false,
    rawTranscriptInTelemetry: false,
    fullStateInTelemetry: false,
    authorityInTelemetry: false,
    realOwnerMemoryRequested: false,
    externalOutreachRequested: false,
    evidenceObservedAt: "2026-09-24T20:00:00.000Z",
    ...overrides,
  };
}

test("complete production contract fixture can satisfy design but never execute admission", () => {
  const result = evaluateP5ProductionAdmissionDraft(fixture());
  assert.equal(result.pass, true);
  assert.equal(result.decision, "CONTRACT_SATISFIED_IN_SIMULATION_NOT_EXECUTABLE");
  assert.equal(result.executableAdmission, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.productionMutationAllowed, false);
});

test("missing explicit production authorization fails closed", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ explicitProductionAuthorization: false }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("EXPLICIT_PRODUCTION_AUTHORIZATION_REQUIRED"), true);
});

test("missing authenticated session fails closed", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ authenticatedSession: false }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AUTHENTICATED_SESSION_REQUIRED"), true);
});

test("unqualified iOS Safari remains unsupported in production draft", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ cell: "IOS_SAFARI_DESTINATION" }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("UNSUPPORTED_BROWSER_OS_DEVICE_CELL"), true);
});

test("demo fallback and public browser token fail closed", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({
      demoFallbackEnabled: true,
      publicStaticAccessTokenPresent: true,
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("DEMO_FALLBACK_FORBIDDEN"), true);
  assert.equal(result.failures.includes("PUBLIC_STATIC_ACCESS_TOKEN_FORBIDDEN"), true);
});

test("temporary share-token dependency is forbidden", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ temporaryShareTokenDependency: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("TEMPORARY_SHARE_TOKEN_DEPENDENCY_FORBIDDEN"), true);
});

test("config or commit drift fails closed", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({
      observedCommitSha: "0".repeat(40),
      observedConfigDigest: "sha256:" + "b".repeat(64),
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("COMMIT_SHA_MISMATCH"), true);
  assert.equal(result.failures.includes("CONFIG_DIGEST_MISMATCH"), true);
});

test("network-skipped production preflight cannot satisfy production contract", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ productionPreflightSkippedNetwork: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("PRODUCTION_PREFLIGHT_NETWORK_SKIP_FORBIDDEN"), true);
});

test("rollback and stop authority are mandatory", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ rollbackDrillPass: false, incidentStopAuthorityActive: false }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("ROLLBACK_DRILL_REQUIRED"), true);
  assert.equal(result.failures.includes("INCIDENT_STOP_AUTHORITY_REQUIRED"), true);
});

test("privacy-leaking telemetry forces hold", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ rawMemoryInTelemetry: true, authorityInTelemetry: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("RAW_MEMORY_TELEMETRY_FORBIDDEN"), true);
  assert.equal(result.failures.includes("AUTHORITY_TELEMETRY_FORBIDDEN"), true);
});

test("real owner memory and external outreach remain separately authorized tracks", () => {
  const result = evaluateP5ProductionAdmissionDraft(
    fixture({ realOwnerMemoryRequested: true, externalOutreachRequested: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(
    result.failures.includes("REAL_OWNER_MEMORY_SEPARATE_AUTHORIZATION_REQUIRED"),
    true,
  );
  assert.equal(
    result.failures.includes("EXTERNAL_OUTREACH_SEPARATE_AUTHORIZATION_REQUIRED"),
    true,
  );
});

test("evidence schema accepts digest-only privacy-minimized record", () => {
  const result = validateP5ProductionAdmissionEvidenceDraft({
    schema: "DOMI_P5_PRODUCTION_ADMISSION_EVIDENCE_V0_1",
    commitSha: COMMIT,
    configDigest: CONFIG,
    rollbackAnchorCommit: ROLLBACK,
    observedAt: "2026-09-24T20:00:00.000Z",
    cell: "WINDOWS_CHROME_SOURCE",
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    fullStateIncluded: false,
    authorityIncluded: false,
    credentialsIncluded: false,
  });
  assert.equal(result.pass, true);
  assert.equal(result.executableAdmission, false);
});

test("evidence schema rejects credentials and unsupported cell", () => {
  const result = validateP5ProductionAdmissionEvidenceDraft({
    schema: "DOMI_P5_PRODUCTION_ADMISSION_EVIDENCE_V0_1",
    commitSha: COMMIT,
    configDigest: CONFIG,
    rollbackAnchorCommit: ROLLBACK,
    observedAt: "2026-09-24T20:00:00.000Z",
    cell: "IOS_SAFARI_DESTINATION",
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    fullStateIncluded: false,
    authorityIncluded: false,
    credentialsIncluded: true,
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("EVIDENCE_CELL_UNSUPPORTED"), true);
  assert.equal(result.failures.includes("EVIDENCE_CREDENTIALS_FORBIDDEN"), true);
});
