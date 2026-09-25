export const DOMI_P5_PRODUCTION_ADMISSION_DRAFT_VERSION =
  "DOMI_P5_PRODUCTION_ADMISSION_DRAFT_V0_1";

export const P5_PRODUCTION_ADMISSION_DRAFT_SUPPORTED_CELLS = Object.freeze([
  "ANDROID_CHROME_DESTINATION",
  "WINDOWS_EDGE_SOURCE",
  "WINDOWS_CHROME_SOURCE",
]);

const SHA40_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/i;

function isIso(value) {
  return typeof value === "string"
    && value.trim() !== ""
    && !Number.isNaN(new Date(value).getTime());
}

function isSupportedCell(cell) {
  return P5_PRODUCTION_ADMISSION_DRAFT_SUPPORTED_CELLS.includes(String(cell ?? ""));
}

export function evaluateP5ProductionAdmissionDraft(input = {}) {
  const failures = [];

  if (input.targetEnvironment !== "production") {
    failures.push("PRODUCTION_TARGET_ENVIRONMENT_REQUIRED");
  }

  if (input.contractMode !== "DESIGN_ONLY_NON_EXECUTABLE") {
    failures.push("NON_EXECUTABLE_DESIGN_MODE_REQUIRED");
  }

  if (input.explicitProductionAuthorization !== true) {
    failures.push("EXPLICIT_PRODUCTION_AUTHORIZATION_REQUIRED");
  }

  if (input.authenticatedSession !== true) {
    failures.push("AUTHENTICATED_SESSION_REQUIRED");
  }
  if (input.authorizedOwnerScope !== true) {
    failures.push("AUTHORIZED_OWNER_SCOPE_REQUIRED");
  }
  if (input.tenantScopeValid !== true) {
    failures.push("TENANT_SCOPE_VALIDATION_REQUIRED");
  }
  if (input.identityAssurancePass !== true) {
    failures.push("IDENTITY_ASSURANCE_REQUIRED");
  }

  if (!isSupportedCell(input.cell)) {
    failures.push("UNSUPPORTED_BROWSER_OS_DEVICE_CELL");
  }

  if (input.demoFallbackEnabled !== false) {
    failures.push("DEMO_FALLBACK_FORBIDDEN");
  }
  if (input.publicStaticAccessTokenPresent !== false) {
    failures.push("PUBLIC_STATIC_ACCESS_TOKEN_FORBIDDEN");
  }
  if (input.temporaryShareTokenDependency !== false) {
    failures.push("TEMPORARY_SHARE_TOKEN_DEPENDENCY_FORBIDDEN");
  }

  if (input.securityGatePass !== true) {
    failures.push("SECURITY_GATE_REQUIRED");
  }
  if (input.secretScanPass !== true) {
    failures.push("SECRET_SCAN_REQUIRED");
  }
  if (input.webSessionSecurityLintPass !== true) {
    failures.push("WEB_SESSION_SECURITY_LINT_REQUIRED");
  }
  if (input.productionReadinessReportPass !== true) {
    failures.push("PRODUCTION_READINESS_REPORT_REQUIRED");
  }
  if (input.productionPreflightPass !== true) {
    failures.push("PRODUCTION_PREFLIGHT_REQUIRED");
  }
  if (input.productionPreflightSkippedNetwork === true) {
    failures.push("PRODUCTION_PREFLIGHT_NETWORK_SKIP_FORBIDDEN");
  }
  if (input.healthCheckPass !== true) {
    failures.push("HEALTH_CHECK_REQUIRED");
  }

  if (!SHA40_RE.test(String(input.expectedCommitSha ?? ""))) {
    failures.push("EXPECTED_COMMIT_SHA_INVALID");
  }
  if (!SHA40_RE.test(String(input.observedCommitSha ?? ""))) {
    failures.push("OBSERVED_COMMIT_SHA_INVALID");
  }
  if (
    SHA40_RE.test(String(input.expectedCommitSha ?? ""))
    && SHA40_RE.test(String(input.observedCommitSha ?? ""))
    && input.expectedCommitSha !== input.observedCommitSha
  ) {
    failures.push("COMMIT_SHA_MISMATCH");
  }

  if (!SHA256_RE.test(String(input.expectedConfigDigest ?? ""))) {
    failures.push("EXPECTED_CONFIG_DIGEST_INVALID");
  }
  if (!SHA256_RE.test(String(input.observedConfigDigest ?? ""))) {
    failures.push("OBSERVED_CONFIG_DIGEST_INVALID");
  }
  if (
    SHA256_RE.test(String(input.expectedConfigDigest ?? ""))
    && SHA256_RE.test(String(input.observedConfigDigest ?? ""))
    && input.expectedConfigDigest !== input.observedConfigDigest
  ) {
    failures.push("CONFIG_DIGEST_MISMATCH");
  }

  if (!SHA40_RE.test(String(input.rollbackAnchorCommit ?? ""))) {
    failures.push("ROLLBACK_ANCHOR_INVALID");
  }
  if (input.rollbackDrillPass !== true) {
    failures.push("ROLLBACK_DRILL_REQUIRED");
  }
  if (input.incidentStopAuthorityActive !== true) {
    failures.push("INCIDENT_STOP_AUTHORITY_REQUIRED");
  }

  if (input.telemetryPolicyPass !== true) {
    failures.push("TELEMETRY_POLICY_REQUIRED");
  }
  if (input.rawMemoryInTelemetry !== false) {
    failures.push("RAW_MEMORY_TELEMETRY_FORBIDDEN");
  }
  if (input.rawTranscriptInTelemetry !== false) {
    failures.push("RAW_TRANSCRIPT_TELEMETRY_FORBIDDEN");
  }
  if (input.fullStateInTelemetry !== false) {
    failures.push("FULL_STATE_TELEMETRY_FORBIDDEN");
  }
  if (input.authorityInTelemetry !== false) {
    failures.push("AUTHORITY_TELEMETRY_FORBIDDEN");
  }

  if (input.realOwnerMemoryRequested !== false) {
    failures.push("REAL_OWNER_MEMORY_SEPARATE_AUTHORIZATION_REQUIRED");
  }
  if (input.externalOutreachRequested !== false) {
    failures.push("EXTERNAL_OUTREACH_SEPARATE_AUTHORIZATION_REQUIRED");
  }

  if (!isIso(input.evidenceObservedAt)) {
    failures.push("EVIDENCE_TIMESTAMP_INVALID");
  }

  return Object.freeze({
    version: DOMI_P5_PRODUCTION_ADMISSION_DRAFT_VERSION,
    pass: failures.length === 0,
    decision: failures.length === 0
      ? "CONTRACT_SATISFIED_IN_SIMULATION_NOT_EXECUTABLE"
      : "HOLD",
    failures: Object.freeze(failures),
    cell: String(input.cell ?? ""),
    targetEnvironment: String(input.targetEnvironment ?? ""),
    executableAdmission: false,
    productionReady: false,
    productionMutationAllowed: false,
    realOwnerMemoryAuthorized: false,
    externalOutreachAuthorized: false,
    universalCompatibilityClaim: false,
    supportBoundary: isSupportedCell(input.cell)
      ? "ONLY_RC2_PHYSICALLY_AND_OPERATIONALLY_QUALIFIED_CELLS"
      : "UNSUPPORTED",
  });
}

export function validateP5ProductionAdmissionEvidenceDraft(evidence = {}) {
  const failures = [];

  if (evidence.schema !== "DOMI_P5_PRODUCTION_ADMISSION_EVIDENCE_V0_1") {
    failures.push("EVIDENCE_SCHEMA_MISMATCH");
  }
  if (!SHA40_RE.test(String(evidence.commitSha ?? ""))) {
    failures.push("EVIDENCE_COMMIT_SHA_INVALID");
  }
  if (!SHA256_RE.test(String(evidence.configDigest ?? ""))) {
    failures.push("EVIDENCE_CONFIG_DIGEST_INVALID");
  }
  if (!SHA40_RE.test(String(evidence.rollbackAnchorCommit ?? ""))) {
    failures.push("EVIDENCE_ROLLBACK_ANCHOR_INVALID");
  }
  if (!isIso(evidence.observedAt)) {
    failures.push("EVIDENCE_OBSERVED_AT_INVALID");
  }
  if (!isSupportedCell(evidence.cell)) {
    failures.push("EVIDENCE_CELL_UNSUPPORTED");
  }
  if (evidence.rawMemoryIncluded !== false) {
    failures.push("EVIDENCE_RAW_MEMORY_FORBIDDEN");
  }
  if (evidence.rawTranscriptIncluded !== false) {
    failures.push("EVIDENCE_RAW_TRANSCRIPT_FORBIDDEN");
  }
  if (evidence.fullStateIncluded !== false) {
    failures.push("EVIDENCE_FULL_STATE_FORBIDDEN");
  }
  if (evidence.authorityIncluded !== false) {
    failures.push("EVIDENCE_AUTHORITY_FORBIDDEN");
  }
  if (evidence.credentialsIncluded !== false) {
    failures.push("EVIDENCE_CREDENTIALS_FORBIDDEN");
  }

  return Object.freeze({
    pass: failures.length === 0,
    decision: failures.length === 0 ? "EVIDENCE_SCHEMA_PASS" : "HOLD",
    failures: Object.freeze(failures),
    executableAdmission: false,
  });
}
