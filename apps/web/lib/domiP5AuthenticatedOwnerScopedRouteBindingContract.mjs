export const DOMI_P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT_VERSION =
  "DOMI_P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT_V0_1";

export const P5_VALIDATED_ADMISSION_SPEC_COMMIT =
  "19f8ab559ff5e0ce7a7bf0a8453db2a7a67cc645";

export const P5_ROUTE_BINDING_AUDIT_COMMIT =
  "15fd6b0eddd77c51d51e8d467372e50440a31388";

export const P5_OWNER_SCOPED_QUALIFIED_CELLS = Object.freeze([
  "ANDROID_CHROME_DESTINATION",
  "WINDOWS_EDGE_SOURCE",
  "WINDOWS_CHROME_SOURCE",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/i;
const ROLE_RANK = Object.freeze({
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
});

function isUuid(value) {
  return UUID_RE.test(String(value ?? ""));
}

function isIso(value) {
  return typeof value === "string"
    && value.trim() !== ""
    && !Number.isNaN(new Date(value).getTime());
}

function validRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLE_RANK, String(role ?? ""));
}

function supportedCell(cell) {
  return P5_OWNER_SCOPED_QUALIFIED_CELLS.includes(String(cell ?? ""));
}

function receiptId(value) {
  return isUuid(value);
}

export function evaluateP5AuthenticatedOwnerScopedRouteBindingContract(input = {}) {
  const failures = [];

  if (input.contractMode !== "DESIGN_ONLY_NON_EXECUTABLE") {
    failures.push("NON_EXECUTABLE_DESIGN_MODE_REQUIRED");
  }
  if (input.surfaceClass !== "SEPARATE_AUTHENTICATED_P5_PRODUCTION_SURFACE") {
    failures.push("SEPARATE_PRODUCTION_SURFACE_REQUIRED");
  }
  if (input.ownerAlphaHarnessReused !== false) {
    failures.push("OWNER_ALPHA_HARNESS_REUSE_FORBIDDEN");
  }

  if (input.simulatedAuthorizationReceiptStatus !== "SIMULATED_PRESENT_FOR_TEST_ONLY") {
    failures.push("SIMULATED_AUTHORIZATION_RECEIPT_REQUIRED");
  }

  if (input.sessionAuthenticated !== true) {
    failures.push("AUTHENTICATED_SESSION_REQUIRED");
  }
  if (input.sessionRevoked !== false) {
    failures.push("NON_REVOKED_SESSION_REQUIRED");
  }
  if (!isUuid(input.sessionJti)) {
    failures.push("SESSION_JTI_INVALID");
  }
  if (!isUuid(input.authenticatedUserId)) {
    failures.push("AUTHENTICATED_USER_ID_INVALID");
  }
  if (!isUuid(input.ownerSubjectUserId)) {
    failures.push("OWNER_SUBJECT_USER_ID_INVALID");
  }
  if (
    isUuid(input.authenticatedUserId)
    && isUuid(input.ownerSubjectUserId)
    && input.authenticatedUserId !== input.ownerSubjectUserId
  ) {
    failures.push("OWNER_SELF_BINDING_REQUIRED_V0_1");
  }
  if (input.delegatedAccess !== false) {
    failures.push("DELEGATED_ACCESS_NOT_SUPPORTED_V0_1");
  }

  if (!isUuid(input.householdId)) {
    failures.push("HOUSEHOLD_ID_INVALID");
  }
  if (!isUuid(input.organizationId)) {
    failures.push("ORGANIZATION_ID_INVALID");
  }
  if (!isUuid(input.householdOrganizationId)) {
    failures.push("HOUSEHOLD_ORGANIZATION_ID_INVALID");
  }
  if (
    isUuid(input.organizationId)
    && isUuid(input.householdOrganizationId)
    && input.organizationId !== input.householdOrganizationId
  ) {
    failures.push("HOUSEHOLD_ORGANIZATION_SCOPE_MISMATCH");
  }
  if (input.householdMembershipPass !== true) {
    failures.push("HOUSEHOLD_MEMBERSHIP_REQUIRED");
  }
  if (!validRole(input.householdRole)) {
    failures.push("HOUSEHOLD_ROLE_INVALID");
  }
  if (input.organizationScopePass !== true) {
    failures.push("ORGANIZATION_SCOPE_VALIDATION_REQUIRED");
  }
  if (input.tenantScopePass !== true) {
    failures.push("TENANT_SCOPE_VALIDATION_REQUIRED");
  }

  if (!supportedCell(input.cell)) {
    failures.push("UNSUPPORTED_BROWSER_OS_DEVICE_CELL");
  }
  if (input.iosSupportInferred === true) {
    failures.push("IOS_SUPPORT_INFERENCE_FORBIDDEN");
  }

  if (input.requestMode !== "READ_ONLY") {
    failures.push("READ_ONLY_CONTRACT_REQUIRED_V0_1");
  }
  if (input.stateMutationRequested !== false) {
    failures.push("STATE_MUTATION_FORBIDDEN_V0_1");
  }
  if (input.csrfPolicyReservedForFutureMutation !== true) {
    failures.push("FUTURE_MUTATION_CSRF_POLICY_ACK_REQUIRED");
  }

  if (input.noStorePolicyPass !== true) {
    failures.push("NO_STORE_POLICY_REQUIRED");
  }
  if (input.rateLimitPolicyPass !== true) {
    failures.push("RATE_LIMIT_POLICY_REQUIRED");
  }
  if (input.incidentStopAuthorityActive !== true) {
    failures.push("INCIDENT_STOP_AUTHORITY_REQUIRED");
  }

  if (!receiptId(input.auditLogReceiptId)) {
    failures.push("AUDIT_LOG_RECEIPT_REQUIRED");
  }
  if (!receiptId(input.securityEventReceiptId)) {
    failures.push("SECURITY_EVENT_RECEIPT_REQUIRED");
  }
  if (input.securityEventMetadataMinimized !== true) {
    failures.push("SECURITY_EVENT_METADATA_MINIMIZATION_REQUIRED");
  }

  if (!SHA40_RE.test(String(input.observedBuildCommit ?? ""))) {
    failures.push("BUILD_COMMIT_INVALID");
  }
  if (!SHA256_RE.test(String(input.observedConfigDigest ?? ""))) {
    failures.push("CONFIG_DIGEST_INVALID");
  }
  if (input.validatedAdmissionSpecCommit !== P5_VALIDATED_ADMISSION_SPEC_COMMIT) {
    failures.push("VALIDATED_ADMISSION_SPEC_COMMIT_MISMATCH");
  }
  if (input.routeBindingAuditCommit !== P5_ROUTE_BINDING_AUDIT_COMMIT) {
    failures.push("ROUTE_BINDING_AUDIT_COMMIT_MISMATCH");
  }

  if (input.rawMemoryPersisted !== false) {
    failures.push("RAW_MEMORY_PERSISTENCE_FORBIDDEN");
  }
  if (input.rawTranscriptPersisted !== false) {
    failures.push("RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN");
  }
  if (input.fullStatePersisted !== false) {
    failures.push("FULL_STATE_PERSISTENCE_FORBIDDEN");
  }
  if (input.authorityPersisted !== false) {
    failures.push("AUTHORITY_PERSISTENCE_FORBIDDEN");
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
    version: DOMI_P5_AUTHENTICATED_OWNER_SCOPED_ROUTE_BINDING_CONTRACT_VERSION,
    pass: failures.length === 0,
    decision: failures.length === 0
      ? "CONTRACT_SATISFIED_IN_SIMULATION_NOT_EXECUTABLE"
      : "HOLD",
    failures: Object.freeze(failures),
    executableBinding: false,
    productionReady: false,
    productionMutationAllowed: false,
    realOwnerMemoryAuthorized: false,
    externalOutreachAuthorized: false,
    ownerScopeMode: "SELF_ONLY_V0_1",
    requestMode: "READ_ONLY",
    supportBoundary: supportedCell(input.cell)
      ? "ONLY_RC2_PHYSICALLY_AND_OPERATIONALLY_QUALIFIED_CELLS"
      : "UNSUPPORTED",
  });
}

export function validateP5OwnerScopedRouteBindingEvidence(evidence = {}) {
  const failures = [];

  if (evidence.schema !== "DOMI_P5_OWNER_SCOPED_ROUTE_BINDING_EVIDENCE_V0_1") {
    failures.push("EVIDENCE_SCHEMA_MISMATCH");
  }
  for (const [field, code] of [
    ["sessionJti", "EVIDENCE_SESSION_JTI_INVALID"],
    ["authenticatedUserId", "EVIDENCE_AUTH_USER_ID_INVALID"],
    ["ownerSubjectUserId", "EVIDENCE_OWNER_SUBJECT_ID_INVALID"],
    ["householdId", "EVIDENCE_HOUSEHOLD_ID_INVALID"],
    ["organizationId", "EVIDENCE_ORGANIZATION_ID_INVALID"],
    ["auditLogReceiptId", "EVIDENCE_AUDIT_RECEIPT_INVALID"],
    ["securityEventReceiptId", "EVIDENCE_SECURITY_EVENT_RECEIPT_INVALID"],
  ]) {
    if (!isUuid(evidence[field])) failures.push(code);
  }
  if (!SHA40_RE.test(String(evidence.buildCommit ?? ""))) {
    failures.push("EVIDENCE_BUILD_COMMIT_INVALID");
  }
  if (!SHA256_RE.test(String(evidence.configDigest ?? ""))) {
    failures.push("EVIDENCE_CONFIG_DIGEST_INVALID");
  }
  if (!isIso(evidence.observedAt)) {
    failures.push("EVIDENCE_OBSERVED_AT_INVALID");
  }
  if (!supportedCell(evidence.cell)) {
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
    executableBinding: false,
  });
}
