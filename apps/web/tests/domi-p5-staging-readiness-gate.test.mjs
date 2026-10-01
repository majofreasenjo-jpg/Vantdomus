import test from "node:test";
import assert from "node:assert/strict";
import { evaluateP5StagingReadinessGate } from "../lib/domiP5StagingReadinessGate.mjs";

const COMMIT = "abcdef1234567890abcdef1234567890abcdef12";
const CONFIG = "sha256:" + "a".repeat(64);

function fixture(overrides = {}) {
  const base = {
    gateMode: "DESIGN_ONLY_NON_EXECUTABLE",
    targetEnvironment: "staging",
    validatedIntegrationHarnessCommit:
      "01c20955ce24a410a5eccaa300d51edde0bb408c",
    candidateBuildCommit: COMMIT,
    candidateConfigDigest: CONFIG,
    syntheticOnly: true,
    realOwnerMemoryRequested: false,
    externalUsersRequested: false,
    productionMutationRequested: false,
    ownerAlphaHarnessPromotionRequested: false,
    sourceGates: {
      securityGatePass: true,
      secretScanPass: true,
      webSessionSecurityLintPass: true,
      webEnvPreflightPass: true,
    },
    configurationGates: {
      productionReadinessReportPass: true,
      realStagingEnvValuesPresent: true,
      placeholderValuesPresent: false,
      forbiddenPublicKeysPresent: false,
    },
    infrastructureGates: {
      productionPreflightPass: true,
      productionPreflightSkippedNetwork: false,
      databasePass: true,
      redisPass: true,
      clamavPass: true,
      encryptedBackupPass: true,
    },
    identityTenantGates: {
      authenticatedSessionPass: true,
      sessionRevocationPass: true,
      householdRbacPass: true,
      organizationTenancyPass: true,
      twoTenantIsolationPass: true,
    },
    p5BindingGates: {
      ownerScopedBindingPass: true,
      qualifiedDeviceCellPass: true,
      iosSupportInferred: false,
      noStorePass: true,
      rateLimitPass: true,
      auditReceiptPass: true,
      securityEventReceiptPass: true,
    },
    runtimeSmokeGates: {
      apiHealthPass: true,
      webLoginPass: true,
      protectedRouteRedirectPass: true,
      cacheNoStorePass: true,
      publicProxySizeLimitPass: true,
    },
    resilienceGates: {
      rollbackDrillPass: true,
      backupRestoreDrillPass: true,
      securityEventChainPass: true,
      incidentStopAuthorityPass: true,
    },
    observabilityGates: {
      privacyMinimizedTelemetryPass: true,
      signedAlertDeliveryPass: true,
      operatorOwnershipDefined: true,
    },
    evidenceObservedAt: "2026-10-01T15:00:00.000Z",
  };

  return {
    ...base,
    ...overrides,
    sourceGates: { ...base.sourceGates, ...(overrides.sourceGates ?? {}) },
    configurationGates: { ...base.configurationGates, ...(overrides.configurationGates ?? {}) },
    infrastructureGates: { ...base.infrastructureGates, ...(overrides.infrastructureGates ?? {}) },
    identityTenantGates: { ...base.identityTenantGates, ...(overrides.identityTenantGates ?? {}) },
    p5BindingGates: { ...base.p5BindingGates, ...(overrides.p5BindingGates ?? {}) },
    runtimeSmokeGates: { ...base.runtimeSmokeGates, ...(overrides.runtimeSmokeGates ?? {}) },
    resilienceGates: { ...base.resilienceGates, ...(overrides.resilienceGates ?? {}) },
    observabilityGates: { ...base.observabilityGates, ...(overrides.observabilityGates ?? {}) },
  };
}

test("complete staging evidence can only reach eligibility, never executable deployment", () => {
  const result = evaluateP5StagingReadinessGate(fixture());
  assert.equal(result.pass, true);
  assert.equal(
    result.decision,
    "STAGING_ENTRY_ELIGIBLE_PENDING_EXPLICIT_EXECUTION_AUTHORIZATION",
  );
  assert.equal(result.executableGate, false);
  assert.equal(result.stagingDeploymentAuthorized, false);
  assert.equal(result.productionDeploymentAuthorized, false);
});

test("real owner memory and external users remain forbidden in initial staging", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({ realOwnerMemoryRequested: true, externalUsersRequested: true }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("REAL_OWNER_MEMORY_FORBIDDEN_IN_INITIAL_STAGING"), true);
  assert.equal(result.failures.includes("EXTERNAL_USERS_FORBIDDEN_IN_INITIAL_STAGING"), true);
});

test("staging configuration must use real non-placeholder values and no forbidden public keys", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      configurationGates: {
        realStagingEnvValuesPresent: false,
        placeholderValuesPresent: true,
        forbiddenPublicKeysPresent: true,
      },
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("REAL_STAGING_ENV_VALUES_REQUIRED"), true);
  assert.equal(result.failures.includes("PLACEHOLDER_ENV_VALUES_FORBIDDEN"), true);
  assert.equal(result.failures.includes("FORBIDDEN_PUBLIC_KEYS_PRESENT"), true);
});

test("network-skipped infrastructure preflight fails closed", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      infrastructureGates: {
        productionPreflightSkippedNetwork: true,
        redisPass: false,
      },
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("NETWORK_CHECK_SKIP_FORBIDDEN"), true);
  assert.equal(result.failures.includes("REDIS_CHECK_REQUIRED"), true);
});

test("authentication alone cannot replace tenant-isolation evidence", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      identityTenantGates: {
        twoTenantIsolationPass: false,
        organizationTenancyPass: false,
      },
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("TWO_TENANT_ISOLATION_STAGING_TEST_REQUIRED"), true);
  assert.equal(result.failures.includes("ORGANIZATION_TENANCY_STAGING_TEST_REQUIRED"), true);
});

test("P5 binding requires rate limit, audit and security-event receipts", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      p5BindingGates: {
        rateLimitPass: false,
        auditReceiptPass: false,
        securityEventReceiptPass: false,
      },
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("P5_RATE_LIMIT_REQUIRED"), true);
  assert.equal(result.failures.includes("P5_AUDIT_RECEIPT_REQUIRED"), true);
  assert.equal(result.failures.includes("P5_SECURITY_EVENT_RECEIPT_REQUIRED"), true);
});

test("iOS support cannot be inferred while physical qualification is paused", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({ p5BindingGates: { iosSupportInferred: true } }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("IOS_SUPPORT_INFERENCE_FORBIDDEN"), true);
  assert.equal(result.iosSupportClaimAllowed, false);
});

test("runtime smoke failures block staging entry", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      runtimeSmokeGates: {
        apiHealthPass: false,
        protectedRouteRedirectPass: false,
        cacheNoStorePass: false,
      },
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("API_HEALTH_REQUIRED"), true);
  assert.equal(result.failures.includes("PROTECTED_ROUTE_SESSION_ENFORCEMENT_REQUIRED"), true);
  assert.equal(result.failures.includes("RUNTIME_NO_STORE_REQUIRED"), true);
});

test("rollback, restore and incident stop are mandatory", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      resilienceGates: {
        rollbackDrillPass: false,
        backupRestoreDrillPass: false,
        incidentStopAuthorityPass: false,
      },
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("ROLLBACK_DRILL_REQUIRED"), true);
  assert.equal(result.failures.includes("BACKUP_RESTORE_DRILL_REQUIRED"), true);
  assert.equal(result.failures.includes("INCIDENT_STOP_AUTHORITY_REQUIRED"), true);
});

test("observability must be privacy-minimized, signed and owned", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      observabilityGates: {
        privacyMinimizedTelemetryPass: false,
        signedAlertDeliveryPass: false,
        operatorOwnershipDefined: false,
      },
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("PRIVACY_MINIMIZED_TELEMETRY_REQUIRED"), true);
  assert.equal(result.failures.includes("SIGNED_ALERT_DELIVERY_REQUIRED"), true);
  assert.equal(result.failures.includes("OPERATOR_OWNERSHIP_REQUIRED"), true);
});

test("owner-alpha harness promotion and production mutation are explicitly forbidden", () => {
  const result = evaluateP5StagingReadinessGate(
    fixture({
      ownerAlphaHarnessPromotionRequested: true,
      productionMutationRequested: true,
    }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes("OWNER_ALPHA_HARNESS_PROMOTION_FORBIDDEN"), true);
  assert.equal(result.failures.includes("PRODUCTION_MUTATION_FORBIDDEN"), true);
});
