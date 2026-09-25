import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateP5AuthenticatedOwnerScopedRouteBindingContract,
  validateP5OwnerScopedRouteBindingEvidence,
} from "../lib/domiP5AuthenticatedOwnerScopedRouteBindingContract.mjs";

const USER = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const ORG = "33333333-3333-4333-8333-333333333333";
const JTI = "44444444-4444-4444-8444-444444444444";
const AUDIT = "55555555-5555-4555-8555-555555555555";
const SEC = "66666666-6666-4666-8666-666666666666";
const BUILD = "abcdef1234567890abcdef1234567890abcdef12";
const CONFIG = "sha256:" + "a".repeat(64);

function fixture(overrides = {}) {
  return {
    contractMode: "DESIGN_ONLY_NON_EXECUTABLE",
    surfaceClass: "SEPARATE_AUTHENTICATED_P5_PRODUCTION_SURFACE",
    ownerAlphaHarnessReused: false,
    simulatedAuthorizationReceiptStatus: "SIMULATED_PRESENT_FOR_TEST_ONLY",
    sessionAuthenticated: true,
    sessionRevoked: false,
    sessionJti: JTI,
    authenticatedUserId: USER,
    ownerSubjectUserId: USER,
    delegatedAccess: false,
    householdId: HOUSEHOLD,
    organizationId: ORG,
    householdOrganizationId: ORG,
    householdMembershipPass: true,
    householdRole: "owner",
    organizationScopePass: true,
    tenantScopePass: true,
    cell: "WINDOWS_CHROME_SOURCE",
    iosSupportInferred: false,
    requestMode: "READ_ONLY",
    stateMutationRequested: false,
    csrfPolicyReservedForFutureMutation: true,
    noStorePolicyPass: true,
    rateLimitPolicyPass: true,
    incidentStopAuthorityActive: true,
    auditLogReceiptId: AUDIT,
    securityEventReceiptId: SEC,
    securityEventMetadataMinimized: true,
    observedBuildCommit: BUILD,
    observedConfigDigest: CONFIG,
    validatedAdmissionSpecCommit:
      "19f8ab559ff5e0ce7a7bf0a8453db2a7a67cc645",
    routeBindingAuditCommit:
      "15fd6b0eddd77c51d51e8d467372e50440a31388",
    rawMemoryPersisted: false,
    rawTranscriptPersisted: false,
    fullStatePersisted: false,
    authorityPersisted: false,
    realOwnerMemoryRequested: false,
    externalOutreachRequested: false,
    evidenceObservedAt: "2026-09-25T13:00:00.000Z",
    ...overrides,
  };
}

test("complete self-owner scoped fixture satisfies simulation but cannot execute", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(fixture());
  assert.equal(result.pass, true);
  assert.equal(result.decision, "CONTRACT_SATISFIED_IN_SIMULATION_NOT_EXECUTABLE");
  assert.equal(result.executableBinding, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.productionMutationAllowed, false);
  assert.equal(result.ownerScopeMode, "SELF_ONLY_V0_1");
});

test("owner-alpha harness reuse is forbidden", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({ ownerAlphaHarnessReused: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("OWNER_ALPHA_HARNESS_REUSE_FORBIDDEN"), true);
});

test("revoked or unauthenticated session fails closed", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({ sessionAuthenticated: false, sessionRevoked: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("AUTHENTICATED_SESSION_REQUIRED"), true);
  assert.equal(result.failures.includes("NON_REVOKED_SESSION_REQUIRED"), true);
});

test("cross-user owner access and delegation are not supported in V0.1", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({
      ownerSubjectUserId: "77777777-7777-4777-8777-777777777777",
      delegatedAccess: true,
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("OWNER_SELF_BINDING_REQUIRED_V0_1"), true);
  assert.equal(result.failures.includes("DELEGATED_ACCESS_NOT_SUPPORTED_V0_1"), true);
});

test("household organization mismatch and failed tenant scope fail closed", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({
      householdOrganizationId: "88888888-8888-4888-8888-888888888888",
      tenantScopePass: false,
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("HOUSEHOLD_ORGANIZATION_SCOPE_MISMATCH"), true);
  assert.equal(result.failures.includes("TENANT_SCOPE_VALIDATION_REQUIRED"), true);
});

test("unqualified iOS Safari remains unsupported and cannot be inferred", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({ cell: "IOS_SAFARI_DESTINATION", iosSupportInferred: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("UNSUPPORTED_BROWSER_OS_DEVICE_CELL"), true);
  assert.equal(result.failures.includes("IOS_SUPPORT_INFERENCE_FORBIDDEN"), true);
});

test("V0.1 is read-only and reserves CSRF for any future mutation", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({
      requestMode: "WRITE",
      stateMutationRequested: true,
      csrfPolicyReservedForFutureMutation: false,
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("READ_ONLY_CONTRACT_REQUIRED_V0_1"), true);
  assert.equal(result.failures.includes("STATE_MUTATION_FORBIDDEN_V0_1"), true);
  assert.equal(result.failures.includes("FUTURE_MUTATION_CSRF_POLICY_ACK_REQUIRED"), true);
});

test("no-store, rate limit, audit and security-event receipts are mandatory", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({
      noStorePolicyPass: false,
      rateLimitPolicyPass: false,
      auditLogReceiptId: "",
      securityEventReceiptId: "",
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("NO_STORE_POLICY_REQUIRED"), true);
  assert.equal(result.failures.includes("RATE_LIMIT_POLICY_REQUIRED"), true);
  assert.equal(result.failures.includes("AUDIT_LOG_RECEIPT_REQUIRED"), true);
  assert.equal(result.failures.includes("SECURITY_EVENT_RECEIPT_REQUIRED"), true);
});

test("admission spec and route-audit identities are pinned", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({
      validatedAdmissionSpecCommit: "0".repeat(40),
      routeBindingAuditCommit: "f".repeat(40),
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("VALIDATED_ADMISSION_SPEC_COMMIT_MISMATCH"), true);
  assert.equal(result.failures.includes("ROUTE_BINDING_AUDIT_COMMIT_MISMATCH"), true);
});

test("privacy leakage, real owner memory and outreach remain forbidden", () => {
  const result = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(
    fixture({
      rawMemoryPersisted: true,
      authorityPersisted: true,
      realOwnerMemoryRequested: true,
      externalOutreachRequested: true,
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("RAW_MEMORY_PERSISTENCE_FORBIDDEN"), true);
  assert.equal(result.failures.includes("AUTHORITY_PERSISTENCE_FORBIDDEN"), true);
  assert.equal(result.failures.includes("REAL_OWNER_MEMORY_SEPARATE_AUTHORIZATION_REQUIRED"), true);
  assert.equal(result.failures.includes("EXTERNAL_OUTREACH_SEPARATE_AUTHORIZATION_REQUIRED"), true);
});

test("privacy-minimized binding evidence validates without credentials", () => {
  const result = validateP5OwnerScopedRouteBindingEvidence({
    schema: "DOMI_P5_OWNER_SCOPED_ROUTE_BINDING_EVIDENCE_V0_1",
    sessionJti: JTI,
    authenticatedUserId: USER,
    ownerSubjectUserId: USER,
    householdId: HOUSEHOLD,
    organizationId: ORG,
    auditLogReceiptId: AUDIT,
    securityEventReceiptId: SEC,
    buildCommit: BUILD,
    configDigest: CONFIG,
    observedAt: "2026-09-25T13:00:00.000Z",
    cell: "ANDROID_CHROME_DESTINATION",
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    fullStateIncluded: false,
    authorityIncluded: false,
    credentialsIncluded: false,
  });
  assert.equal(result.pass, true);
  assert.equal(result.executableBinding, false);
});

test("binding evidence rejects credentials and unsupported cell", () => {
  const result = validateP5OwnerScopedRouteBindingEvidence({
    schema: "DOMI_P5_OWNER_SCOPED_ROUTE_BINDING_EVIDENCE_V0_1",
    sessionJti: JTI,
    authenticatedUserId: USER,
    ownerSubjectUserId: USER,
    householdId: HOUSEHOLD,
    organizationId: ORG,
    auditLogReceiptId: AUDIT,
    securityEventReceiptId: SEC,
    buildCommit: BUILD,
    configDigest: CONFIG,
    observedAt: "2026-09-25T13:00:00.000Z",
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
