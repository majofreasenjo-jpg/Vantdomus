import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateP5OwnerScopedBindingIntegrationHarness,
  inspectP5BackendPrimitiveSources,
  mapP5BackendPrimitiveReceiptsToBindingInput,
} from "../lib/domiP5OwnerScopedBindingIntegrationHarness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const apiRoot = join(webRoot, "..", "api");

function readApi(relative) {
  return readFileSync(join(apiRoot, relative), "utf8");
}

function sources(overrides = {}) {
  return {
    deps: readApi("app/deps.py"),
    tenancy: readApi("app/tenancy.py"),
    rbac: readApi("app/rbac.py"),
    audit: readApi("app/audit.py"),
    securityEvents: readApi("app/security_events.py"),
    main: readApi("app/main.py"),
    rateLimit: readApi("app/rate_limit.py"),
    ...overrides,
  };
}

const USER = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const ORG = "33333333-3333-4333-8333-333333333333";
const JTI = "44444444-4444-4444-8444-444444444444";
const AUDIT = "55555555-5555-4555-8555-555555555555";
const SECURITY = "66666666-6666-4666-8666-666666666666";
const BUILD = "abcdef1234567890abcdef1234567890abcdef12";
const CONFIG = "sha256:" + "a".repeat(64);

function receipts(overrides = {}) {
  const base = {
    simulatedAuthorizationReceiptStatus: "SIMULATED_PRESENT_FOR_TEST_ONLY",
    session: {
      authenticated: true,
      revoked: false,
      jti: JTI,
      userId: USER,
    },
    owner: {
      subjectUserId: USER,
      delegatedAccess: false,
    },
    tenant: {
      householdId: HOUSEHOLD,
      organizationId: ORG,
      householdOrganizationId: ORG,
      householdMembershipPass: true,
      householdRole: "owner",
      organizationScopePass: true,
      tenantScopePass: true,
    },
    device: {
      cell: "WINDOWS_CHROME_SOURCE",
      iosSupportInferred: false,
    },
    policies: {
      requestMode: "READ_ONLY",
      stateMutationRequested: false,
      csrfPolicyReservedForFutureMutation: true,
      noStorePolicyPass: true,
      rateLimitPolicyPass: true,
      incidentStopAuthorityActive: true,
    },
    audit: {
      auditLogReceiptId: AUDIT,
      securityEventReceiptId: SECURITY,
      securityEventMetadataMinimized: true,
    },
    build: {
      observedBuildCommit: BUILD,
      observedConfigDigest: CONFIG,
      validatedAdmissionSpecCommit:
        "19f8ab559ff5e0ce7a7bf0a8453db2a7a67cc645",
      routeBindingAuditCommit:
        "15fd6b0eddd77c51d51e8d467372e50440a31388",
    },
    privacy: {
      rawMemoryPersisted: false,
      rawTranscriptPersisted: false,
      fullStatePersisted: false,
      authorityPersisted: false,
      realOwnerMemoryRequested: false,
      externalOutreachRequested: false,
    },
    evidenceObservedAt: "2026-09-25T16:00:00.000Z",
  };

  return {
    ...base,
    ...overrides,
    session: { ...base.session, ...(overrides.session ?? {}) },
    owner: { ...base.owner, ...(overrides.owner ?? {}) },
    tenant: { ...base.tenant, ...(overrides.tenant ?? {}) },
    device: { ...base.device, ...(overrides.device ?? {}) },
    policies: { ...base.policies, ...(overrides.policies ?? {}) },
    audit: { ...base.audit, ...(overrides.audit ?? {}) },
    build: { ...base.build, ...(overrides.build ?? {}) },
    privacy: { ...base.privacy, ...(overrides.privacy ?? {}) },
  };
}

test("existing backend source contains all primitives required by the binding contract", () => {
  const result = inspectP5BackendPrimitiveSources(sources());
  assert.equal(result.pass, true);
  assert.equal(result.decision, "BACKEND_PRIMITIVE_SOURCE_MAP_PASS");
  for (const value of Object.values(result.checks)) assert.equal(value, true);
});

test("complete simulated receipts map to the validated contract and pass bounded non-executable harness", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources(),
    receipts: receipts(),
  });
  assert.equal(result.pass, true);
  assert.equal(result.decision, "INTEGRATION_HARNESS_PASS_BOUNDED_NON_EXECUTABLE");
  assert.equal(result.contract.decision, "CONTRACT_SATISFIED_IN_SIMULATION_NOT_EXECUTABLE");
  assert.equal(result.executableBinding, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.productionMutationAllowed, false);
  assert.equal(result.networkCallsPerformed, false);
  assert.equal(result.databaseWritesPerformed, false);
  assert.equal(result.productionEndpointCreated, false);
});

test("receipt mapper never upgrades the contract to an executable surface", () => {
  const mapped = mapP5BackendPrimitiveReceiptsToBindingInput(receipts());
  assert.equal(mapped.contractMode, "DESIGN_ONLY_NON_EXECUTABLE");
  assert.equal(mapped.surfaceClass, "SEPARATE_AUTHENTICATED_P5_PRODUCTION_SURFACE");
  assert.equal(mapped.ownerAlphaHarnessReused, false);
});

test("revoked session receipt fails closed", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources(),
    receipts: receipts({ session: { revoked: true } }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("NON_REVOKED_SESSION_REQUIRED"), true);
});

test("household or tenant scope failure cannot be hidden by valid authentication", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources(),
    receipts: receipts({
      tenant: {
        householdMembershipPass: false,
        tenantScopePass: false,
      },
    }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("HOUSEHOLD_MEMBERSHIP_REQUIRED"), true);
  assert.equal(result.failures.includes("TENANT_SCOPE_VALIDATION_REQUIRED"), true);
});

test("household-to-organization mismatch fails closed", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources(),
    receipts: receipts({
      tenant: {
        householdOrganizationId: "77777777-7777-4777-8777-777777777777",
      },
    }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("HOUSEHOLD_ORGANIZATION_SCOPE_MISMATCH"), true);
});

test("audit/security-event receipts and rate-limit policy are mandatory", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources(),
    receipts: receipts({
      policies: { rateLimitPolicyPass: false },
      audit: {
        auditLogReceiptId: "",
        securityEventReceiptId: "",
      },
    }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("RATE_LIMIT_POLICY_REQUIRED"), true);
  assert.equal(result.failures.includes("AUDIT_LOG_RECEIPT_REQUIRED"), true);
  assert.equal(result.failures.includes("SECURITY_EVENT_RECEIPT_REQUIRED"), true);
});

test("backend primitive source drift places the integration harness on hold", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources({ deps: "def get_current_user(): pass" }),
    receipts: receipts(),
  });
  assert.equal(result.pass, false);
  assert.equal(
    result.failures.includes("BACKEND_PRIMITIVE_SOURCE_MISSING:sessionRevocation"),
    true,
  );
  assert.equal(result.sourceInspection.decision, "HOLD_BACKEND_PRIMITIVE_DRIFT");
});

test("iOS Safari remains unsupported while the physical qualification is paused", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources(),
    receipts: receipts({
      device: {
        cell: "IOS_SAFARI_DESTINATION",
        iosSupportInferred: true,
      },
    }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("UNSUPPORTED_BROWSER_OS_DEVICE_CELL"), true);
  assert.equal(result.failures.includes("IOS_SUPPORT_INFERENCE_FORBIDDEN"), true);
});

test("mutation, real owner memory and external outreach remain separate forbidden tracks", () => {
  const result = evaluateP5OwnerScopedBindingIntegrationHarness({
    sources: sources(),
    receipts: receipts({
      policies: {
        requestMode: "WRITE",
        stateMutationRequested: true,
      },
      privacy: {
        realOwnerMemoryRequested: true,
        externalOutreachRequested: true,
      },
    }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("READ_ONLY_CONTRACT_REQUIRED_V0_1"), true);
  assert.equal(result.failures.includes("STATE_MUTATION_FORBIDDEN_V0_1"), true);
  assert.equal(
    result.failures.includes("REAL_OWNER_MEMORY_SEPARATE_AUTHORIZATION_REQUIRED"),
    true,
  );
  assert.equal(
    result.failures.includes("EXTERNAL_OUTREACH_SEPARATE_AUTHORIZATION_REQUIRED"),
    true,
  );
});
