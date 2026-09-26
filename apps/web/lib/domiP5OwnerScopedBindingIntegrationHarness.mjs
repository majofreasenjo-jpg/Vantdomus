import {
  evaluateP5AuthenticatedOwnerScopedRouteBindingContract,
  P5_VALIDATED_ADMISSION_SPEC_COMMIT,
  P5_ROUTE_BINDING_AUDIT_COMMIT,
} from "./domiP5AuthenticatedOwnerScopedRouteBindingContract.mjs";

export const DOMI_P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_VERSION =
  "DOMI_P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_V0_1";

export const P5_BACKEND_PRIMITIVE_SOURCE_BASELINE = Object.freeze({
  deps: "b17fa2c375cbf6fe32a9a702fc3cfa32f7987b9c",
  tenancy: "79d4749d0011fb944e1d7563db04aab55d3c8ff3",
  rbac: "cbaf62302f5a368f4407ae5ef96f83fca8b872d1",
  audit: "37dc94a9a6b7bbbf7092cffd30e2d54a193c2ac5",
  securityEvents: "3fabd64c37e42eb501f3a77b7cf01a2330d72646",
  main: "535344cb14b29daa690af28f9e085802a16fd99c",
  rateLimit: "82539b4865fd5ab1927373fe521120a7b4f2f4e8",
});

function hasAll(source, needles) {
  const text = String(source ?? "");
  return needles.every((needle) => text.includes(needle));
}

export function inspectP5BackendPrimitiveSources(sources = {}) {
  const checks = Object.freeze({
    sessionRevocation: hasAll(sources.deps, [
      "decode_access_token",
      "auth_sessions",
      "token_jti",
      "revoked_at",
      "Session revoked",
    ]),
    householdRbac: hasAll(sources.rbac, [
      "require_household_role",
      "household_memberships",
      "ROLE_RANK",
      "Not a household member",
    ]),
    organizationTenancy: hasAll(sources.tenancy, [
      "get_household_organization_id",
      "organization_id",
      "households",
    ]),
    auditLog: hasAll(sources.audit, [
      "write_audit_log",
      "INSERT INTO audit_log",
      "organization_id",
      "household_id",
      "user_id",
    ]),
    securityEvents: hasAll(sources.securityEvents, [
      "write_security_event",
      "security_events",
      "event_hash",
      "previous_hash",
      "_redact_metadata",
    ]),
    globalApiRateLimit: hasAll(sources.main, [
      "check_rate_limit",
      "api_rate_limit",
      '@app.middleware("http")',
    ]) && hasAll(sources.rateLimit, [
      "check_rate_limit",
      "rate_limit_exceeded",
      "X-RateLimit-Remaining",
      "Retry-After",
    ]),
  });

  const failures = [];
  for (const [name, pass] of Object.entries(checks)) {
    if (!pass) failures.push(`BACKEND_PRIMITIVE_SOURCE_MISSING:${name}`);
  }

  return Object.freeze({
    pass: failures.length === 0,
    decision: failures.length === 0
      ? "BACKEND_PRIMITIVE_SOURCE_MAP_PASS"
      : "HOLD_BACKEND_PRIMITIVE_DRIFT",
    checks,
    failures: Object.freeze(failures),
    sourceBaseline: P5_BACKEND_PRIMITIVE_SOURCE_BASELINE,
  });
}

export function mapP5BackendPrimitiveReceiptsToBindingInput(receipts = {}) {
  const session = receipts.session ?? {};
  const owner = receipts.owner ?? {};
  const tenant = receipts.tenant ?? {};
  const device = receipts.device ?? {};
  const policies = receipts.policies ?? {};
  const audit = receipts.audit ?? {};
  const build = receipts.build ?? {};
  const privacy = receipts.privacy ?? {};

  return Object.freeze({
    contractMode: "DESIGN_ONLY_NON_EXECUTABLE",
    surfaceClass: "SEPARATE_AUTHENTICATED_P5_PRODUCTION_SURFACE",
    ownerAlphaHarnessReused: false,
    simulatedAuthorizationReceiptStatus:
      receipts.simulatedAuthorizationReceiptStatus ?? "SIMULATED_PRESENT_FOR_TEST_ONLY",

    sessionAuthenticated: session.authenticated === true,
    sessionRevoked: session.revoked === true,
    sessionJti: session.jti ?? "",
    authenticatedUserId: session.userId ?? "",
    ownerSubjectUserId: owner.subjectUserId ?? "",
    delegatedAccess: owner.delegatedAccess === true,

    householdId: tenant.householdId ?? "",
    organizationId: tenant.organizationId ?? "",
    householdOrganizationId: tenant.householdOrganizationId ?? "",
    householdMembershipPass: tenant.householdMembershipPass === true,
    householdRole: tenant.householdRole ?? "",
    organizationScopePass: tenant.organizationScopePass === true,
    tenantScopePass: tenant.tenantScopePass === true,

    cell: device.cell ?? "",
    iosSupportInferred: device.iosSupportInferred === true,

    requestMode: policies.requestMode ?? "",
    stateMutationRequested: policies.stateMutationRequested === true,
    csrfPolicyReservedForFutureMutation:
      policies.csrfPolicyReservedForFutureMutation === true,
    noStorePolicyPass: policies.noStorePolicyPass === true,
    rateLimitPolicyPass: policies.rateLimitPolicyPass === true,
    incidentStopAuthorityActive: policies.incidentStopAuthorityActive === true,

    auditLogReceiptId: audit.auditLogReceiptId ?? "",
    securityEventReceiptId: audit.securityEventReceiptId ?? "",
    securityEventMetadataMinimized:
      audit.securityEventMetadataMinimized === true,

    observedBuildCommit: build.observedBuildCommit ?? "",
    observedConfigDigest: build.observedConfigDigest ?? "",
    validatedAdmissionSpecCommit:
      build.validatedAdmissionSpecCommit ?? P5_VALIDATED_ADMISSION_SPEC_COMMIT,
    routeBindingAuditCommit:
      build.routeBindingAuditCommit ?? P5_ROUTE_BINDING_AUDIT_COMMIT,

    rawMemoryPersisted: privacy.rawMemoryPersisted === true,
    rawTranscriptPersisted: privacy.rawTranscriptPersisted === true,
    fullStatePersisted: privacy.fullStatePersisted === true,
    authorityPersisted: privacy.authorityPersisted === true,
    realOwnerMemoryRequested: privacy.realOwnerMemoryRequested === true,
    externalOutreachRequested: privacy.externalOutreachRequested === true,

    evidenceObservedAt: receipts.evidenceObservedAt ?? "",
  });
}

export function evaluateP5OwnerScopedBindingIntegrationHarness({
  sources = {},
  receipts = {},
} = {}) {
  const sourceInspection = inspectP5BackendPrimitiveSources(sources);
  const mappedInput = mapP5BackendPrimitiveReceiptsToBindingInput(receipts);
  const contract = evaluateP5AuthenticatedOwnerScopedRouteBindingContract(mappedInput);

  const failures = [
    ...sourceInspection.failures,
    ...contract.failures,
  ];

  return Object.freeze({
    version: DOMI_P5_OWNER_SCOPED_BINDING_INTEGRATION_HARNESS_VERSION,
    pass: failures.length === 0,
    decision: failures.length === 0
      ? "INTEGRATION_HARNESS_PASS_BOUNDED_NON_EXECUTABLE"
      : "HOLD_INTEGRATION_HARNESS",
    failures: Object.freeze(failures),
    sourceInspection,
    contract,
    executableBinding: false,
    productionReady: false,
    productionMutationAllowed: false,
    realOwnerMemoryAuthorized: false,
    externalOutreachAuthorized: false,
    networkCallsPerformed: false,
    databaseWritesPerformed: false,
    productionEndpointCreated: false,
  });
}
