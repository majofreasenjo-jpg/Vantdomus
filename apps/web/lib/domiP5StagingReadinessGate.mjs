export const DOMI_P5_STAGING_READINESS_GATE_VERSION =
  "DOMI_P5_STAGING_READINESS_GATE_V0_1";

export const P5_VALIDATED_INTEGRATION_HARNESS_COMMIT =
  "01c20955ce24a410a5eccaa300d51edde0bb408c";

const SHA40_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/i;

function isIso(value) {
  return typeof value === "string"
    && value.trim() !== ""
    && !Number.isNaN(new Date(value).getTime());
}

function pass(receipt, key) {
  return receipt?.[key] === true;
}

export function evaluateP5StagingReadinessGate(input = {}) {
  const failures = [];

  if (input.gateMode !== "DESIGN_ONLY_NON_EXECUTABLE") {
    failures.push("NON_EXECUTABLE_GATE_MODE_REQUIRED");
  }

  if (input.targetEnvironment !== "staging") {
    failures.push("STAGING_TARGET_ENVIRONMENT_REQUIRED");
  }

  if (input.validatedIntegrationHarnessCommit !== P5_VALIDATED_INTEGRATION_HARNESS_COMMIT) {
    failures.push("VALIDATED_INTEGRATION_HARNESS_COMMIT_MISMATCH");
  }

  if (!SHA40_RE.test(String(input.candidateBuildCommit ?? ""))) {
    failures.push("CANDIDATE_BUILD_COMMIT_INVALID");
  }

  if (!SHA256_RE.test(String(input.candidateConfigDigest ?? ""))) {
    failures.push("CANDIDATE_CONFIG_DIGEST_INVALID");
  }

  if (input.syntheticOnly !== true) {
    failures.push("STAGING_SYNTHETIC_ONLY_REQUIRED");
  }

  if (input.realOwnerMemoryRequested !== false) {
    failures.push("REAL_OWNER_MEMORY_FORBIDDEN_IN_INITIAL_STAGING");
  }

  if (input.externalUsersRequested !== false) {
    failures.push("EXTERNAL_USERS_FORBIDDEN_IN_INITIAL_STAGING");
  }

  if (input.productionMutationRequested !== false) {
    failures.push("PRODUCTION_MUTATION_FORBIDDEN");
  }

  if (input.ownerAlphaHarnessPromotionRequested !== false) {
    failures.push("OWNER_ALPHA_HARNESS_PROMOTION_FORBIDDEN");
  }

  if (!pass(input.sourceGates, "securityGatePass")) {
    failures.push("SECURITY_GATE_REQUIRED");
  }
  if (!pass(input.sourceGates, "secretScanPass")) {
    failures.push("SECRET_SCAN_REQUIRED");
  }
  if (!pass(input.sourceGates, "webSessionSecurityLintPass")) {
    failures.push("WEB_SESSION_SECURITY_LINT_REQUIRED");
  }
  if (!pass(input.sourceGates, "webEnvPreflightPass")) {
    failures.push("WEB_ENV_PREFLIGHT_REQUIRED");
  }

  if (!pass(input.configurationGates, "productionReadinessReportPass")) {
    failures.push("PRODUCTION_READINESS_REPORT_REQUIRED");
  }
  if (!pass(input.configurationGates, "realStagingEnvValuesPresent")) {
    failures.push("REAL_STAGING_ENV_VALUES_REQUIRED");
  }
  if (input.configurationGates?.placeholderValuesPresent === true) {
    failures.push("PLACEHOLDER_ENV_VALUES_FORBIDDEN");
  }
  if (input.configurationGates?.forbiddenPublicKeysPresent === true) {
    failures.push("FORBIDDEN_PUBLIC_KEYS_PRESENT");
  }

  if (!pass(input.infrastructureGates, "productionPreflightPass")) {
    failures.push("STAGING_INFRASTRUCTURE_PREFLIGHT_REQUIRED");
  }
  if (input.infrastructureGates?.productionPreflightSkippedNetwork === true) {
    failures.push("NETWORK_CHECK_SKIP_FORBIDDEN");
  }
  if (!pass(input.infrastructureGates, "databasePass")) {
    failures.push("DATABASE_CHECK_REQUIRED");
  }
  if (!pass(input.infrastructureGates, "redisPass")) {
    failures.push("REDIS_CHECK_REQUIRED");
  }
  if (!pass(input.infrastructureGates, "clamavPass")) {
    failures.push("CLAMAV_CHECK_REQUIRED");
  }
  if (!pass(input.infrastructureGates, "encryptedBackupPass")) {
    failures.push("ENCRYPTED_BACKUP_REQUIRED");
  }

  if (!pass(input.identityTenantGates, "authenticatedSessionPass")) {
    failures.push("AUTHENTICATED_SESSION_STAGING_TEST_REQUIRED");
  }
  if (!pass(input.identityTenantGates, "sessionRevocationPass")) {
    failures.push("SESSION_REVOCATION_STAGING_TEST_REQUIRED");
  }
  if (!pass(input.identityTenantGates, "householdRbacPass")) {
    failures.push("HOUSEHOLD_RBAC_STAGING_TEST_REQUIRED");
  }
  if (!pass(input.identityTenantGates, "organizationTenancyPass")) {
    failures.push("ORGANIZATION_TENANCY_STAGING_TEST_REQUIRED");
  }
  if (!pass(input.identityTenantGates, "twoTenantIsolationPass")) {
    failures.push("TWO_TENANT_ISOLATION_STAGING_TEST_REQUIRED");
  }

  if (!pass(input.p5BindingGates, "ownerScopedBindingPass")) {
    failures.push("P5_OWNER_SCOPED_BINDING_STAGING_TEST_REQUIRED");
  }
  if (!pass(input.p5BindingGates, "qualifiedDeviceCellPass")) {
    failures.push("P5_QUALIFIED_DEVICE_CELL_REQUIRED");
  }
  if (input.p5BindingGates?.iosSupportInferred === true) {
    failures.push("IOS_SUPPORT_INFERENCE_FORBIDDEN");
  }
  if (!pass(input.p5BindingGates, "noStorePass")) {
    failures.push("P5_NO_STORE_REQUIRED");
  }
  if (!pass(input.p5BindingGates, "rateLimitPass")) {
    failures.push("P5_RATE_LIMIT_REQUIRED");
  }
  if (!pass(input.p5BindingGates, "auditReceiptPass")) {
    failures.push("P5_AUDIT_RECEIPT_REQUIRED");
  }
  if (!pass(input.p5BindingGates, "securityEventReceiptPass")) {
    failures.push("P5_SECURITY_EVENT_RECEIPT_REQUIRED");
  }

  if (!pass(input.runtimeSmokeGates, "apiHealthPass")) {
    failures.push("API_HEALTH_REQUIRED");
  }
  if (!pass(input.runtimeSmokeGates, "webLoginPass")) {
    failures.push("WEB_LOGIN_REQUIRED");
  }
  if (!pass(input.runtimeSmokeGates, "protectedRouteRedirectPass")) {
    failures.push("PROTECTED_ROUTE_SESSION_ENFORCEMENT_REQUIRED");
  }
  if (!pass(input.runtimeSmokeGates, "cacheNoStorePass")) {
    failures.push("RUNTIME_NO_STORE_REQUIRED");
  }
  if (!pass(input.runtimeSmokeGates, "publicProxySizeLimitPass")) {
    failures.push("PUBLIC_PROXY_SIZE_LIMIT_REQUIRED");
  }

  if (!pass(input.resilienceGates, "rollbackDrillPass")) {
    failures.push("ROLLBACK_DRILL_REQUIRED");
  }
  if (!pass(input.resilienceGates, "backupRestoreDrillPass")) {
    failures.push("BACKUP_RESTORE_DRILL_REQUIRED");
  }
  if (!pass(input.resilienceGates, "securityEventChainPass")) {
    failures.push("SECURITY_EVENT_CHAIN_REQUIRED");
  }
  if (!pass(input.resilienceGates, "incidentStopAuthorityPass")) {
    failures.push("INCIDENT_STOP_AUTHORITY_REQUIRED");
  }

  if (!pass(input.observabilityGates, "privacyMinimizedTelemetryPass")) {
    failures.push("PRIVACY_MINIMIZED_TELEMETRY_REQUIRED");
  }
  if (!pass(input.observabilityGates, "signedAlertDeliveryPass")) {
    failures.push("SIGNED_ALERT_DELIVERY_REQUIRED");
  }
  if (!pass(input.observabilityGates, "operatorOwnershipDefined")) {
    failures.push("OPERATOR_OWNERSHIP_REQUIRED");
  }

  if (!isIso(input.evidenceObservedAt)) {
    failures.push("EVIDENCE_TIMESTAMP_INVALID");
  }

  return Object.freeze({
    version: DOMI_P5_STAGING_READINESS_GATE_VERSION,
    pass: failures.length === 0,
    decision: failures.length === 0
      ? "STAGING_ENTRY_ELIGIBLE_PENDING_EXPLICIT_EXECUTION_AUTHORIZATION"
      : "HOLD_STAGING_ENTRY",
    failures: Object.freeze(failures),
    executableGate: false,
    stagingDeploymentAuthorized: false,
    productionDeploymentAuthorized: false,
    realOwnerMemoryAuthorized: false,
    externalUsersAuthorized: false,
    iosSupportClaimAllowed: false,
  });
}
