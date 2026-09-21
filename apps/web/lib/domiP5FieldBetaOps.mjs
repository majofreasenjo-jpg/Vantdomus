export const DOMI_P5_FIELD_BETA_OPS_VERSION = "DOMI_P5_FIELD_BETA_OPS_V0_1";
export const P5_FIELD_BETA_SESSION_STORAGE_KEY = "domi:p5:field-beta-session:v0.1";
export const P5_FIELD_BETA_ARTIFACT_STORAGE_KEY = "domi:p5:field-beta-artifact:v0.1";
export const P5_FIELD_BETA_CANONICAL_CONTINUITY_KEY = "fnv1a32:2b7f23b7";

export const P5_FIELD_BETA_SUPPORT_CONTRACT = Object.freeze({
  version: "DOMI_P5_FIELD_BETA_SUPPORT_CONTRACT_V0_1",
  fieldBetaReady: true,
  productionReady: false,
  previewOnly: true,
  syntheticOnly: true,
  realOwnerMemoryAllowed: false,
  productionMutationAllowed: false,
  externalOutreachAuthorized: false,
  universalCompatibilityClaim: false,
  supportedCells: Object.freeze({
    ANDROID_CHROME_DESTINATION: Object.freeze({
      role: "DESTINATION",
      platformClass: "ANDROID",
      browserClass: "CHROME",
      physicalQualification: "PASS_BOUNDED",
    }),
    WINDOWS_EDGE_SOURCE: Object.freeze({
      role: "SOURCE",
      platformClass: "WINDOWS",
      browserClass: "EDGE",
      physicalQualification: "PASS_BOUNDED",
    }),
  }),
  untestedNotSupportedCells: Object.freeze([
    "WINDOWS_CHROME_SOURCE",
    "IOS_SAFARI_DESTINATION",
  ]),
});

export const P5_FIELD_BETA_INCIDENT_LEVELS = Object.freeze({
  NONE: "NONE",
  B1_LOCAL_RECOVERABLE: "B1_LOCAL_RECOVERABLE",
  B2_CELL_HOLD: "B2_CELL_HOLD",
  B3_BETA_STOP: "B3_BETA_STOP",
  B4_SECRET_STOP_ROTATE: "B4_SECRET_STOP_ROTATE",
});

const EXPECTED_REFERENCES = Object.freeze(["P5-M-PRIVATE", "P5-M-SHARED"]);

function sameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function validProbe(probe) {
  return Boolean(
    probe
    && probe.ok === true
    && probe.status === 200
    && probe.previewEnvironmentPass === true
    && typeof probe.probeId === "string"
    && probe.probeId.length >= 8
    && typeof probe.clientNonce === "string"
    && probe.clientNonce.length >= 8
    && typeof probe.serverTime === "string"
    && !Number.isNaN(new Date(probe.serverTime).getTime())
  );
}

export function isP5FieldBetaSupportedCell(cell) {
  return Object.prototype.hasOwnProperty.call(
    P5_FIELD_BETA_SUPPORT_CONTRACT.supportedCells,
    String(cell ?? ""),
  );
}

export function admitP5FieldBetaSession(input = {}) {
  const failures = [];
  const cell = String(input.cell ?? "");
  const spec = P5_FIELD_BETA_SUPPORT_CONTRACT.supportedCells[cell] ?? null;

  if (P5_FIELD_BETA_SUPPORT_CONTRACT.fieldBetaReady !== true) failures.push("FIELD_BETA_NOT_READY");
  if (!spec) failures.push("UNSUPPORTED_BROWSER_OS_DEVICE_CELL");
  if (input.previewEnvironmentPass !== true) failures.push("PREVIEW_ENVIRONMENT_REQUIRED");
  if (input.syntheticOnly !== true) failures.push("SYNTHETIC_ONLY_REQUIRED");
  if (input.operatorBoundaryConfirmed !== true) failures.push("OPERATOR_BOUNDARY_CONFIRMATION_REQUIRED");
  if (input.artifactValidationPass !== true) failures.push("ARTIFACT_VALIDATION_REQUIRED");
  if (input.continuityKey !== P5_FIELD_BETA_CANONICAL_CONTINUITY_KEY) failures.push("CANONICAL_CONTINUITY_KEY_MISMATCH");
  if (input.realOwnerMemoryUsed !== false) failures.push("REAL_OWNER_MEMORY_FORBIDDEN");
  if (input.productionMutationRequested !== false) failures.push("PRODUCTION_MUTATION_FORBIDDEN");
  if (input.externalOutreachRequested !== false) failures.push("EXTERNAL_OUTREACH_NOT_AUTHORIZED");
  if (input.rawMemoryPersisted !== false) failures.push("RAW_MEMORY_PERSISTENCE_FORBIDDEN");
  if (input.rawTranscriptPersisted !== false) failures.push("RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN");
  if (input.fullStatePersisted !== false) failures.push("FULL_STATE_PERSISTENCE_FORBIDDEN");
  if (input.authorityPersisted !== false) failures.push("AUTHORITY_PERSISTENCE_FORBIDDEN");

  if (spec) {
    if (input.detectedPlatformClass !== spec.platformClass) failures.push("PLATFORM_CLASS_MISMATCH");
    if (input.detectedBrowserClass !== spec.browserClass) failures.push("BROWSER_CLASS_MISMATCH");
    if (input.role !== spec.role) failures.push("ROLE_MISMATCH");
  }

  return Object.freeze({
    pass: failures.length === 0,
    decision: failures.length === 0 ? "ADMIT_SYNTHETIC_BOUNDED_BETA" : "HOLD",
    cell,
    role: spec?.role ?? null,
    failures: Object.freeze(failures),
    supportBoundary: spec ? "ONLY_THIS_PHYSICALLY_VERIFIED_BROWSER_OS_DEVICE_CELL" : "UNSUPPORTED",
  });
}

export function classifyP5FieldBetaIncident(event = {}) {
  if (event.secretOrTemporaryAccessExposed === true || event.credentialExposed === true) {
    return Object.freeze({
      level: P5_FIELD_BETA_INCIDENT_LEVELS.B4_SECRET_STOP_ROTATE,
      betaMayContinue: false,
      cellMayContinue: false,
      action: "STOP_BETA_REPLACE_ACCESS_AND_REQUALIFY",
    });
  }

  if (
    event.rawMemoryObserved === true
    || event.rawTranscriptObserved === true
    || event.fullStateObserved === true
    || event.authorityExpansionObserved === true
    || event.productionMutationObserved === true
    || event.realOwnerMemoryObserved === true
  ) {
    return Object.freeze({
      level: P5_FIELD_BETA_INCIDENT_LEVELS.B3_BETA_STOP,
      betaMayContinue: false,
      cellMayContinue: false,
      action: "STOP_BETA_PRESERVE_EVIDENCE_AND_INVESTIGATE",
    });
  }

  if (
    event.continuityFailure === true
    || event.receiptDrift === true
    || event.artifactDrift === true
    || event.continuityKeyDrift === true
    || event.freshProbeFailure === true
    || event.unsupportedCellAttempt === true
  ) {
    return Object.freeze({
      level: P5_FIELD_BETA_INCIDENT_LEVELS.B2_CELL_HOLD,
      betaMayContinue: true,
      cellMayContinue: false,
      action: "HOLD_CELL_RESET_SYNTHETIC_SESSION_AND_REQUALIFY",
    });
  }

  if (event.recoverableUiError === true || event.staleSyntheticArtifact === true) {
    return Object.freeze({
      level: P5_FIELD_BETA_INCIDENT_LEVELS.B1_LOCAL_RECOVERABLE,
      betaMayContinue: true,
      cellMayContinue: true,
      action: "RESET_LOCAL_SYNTHETIC_STATE_AND_REPEAT",
    });
  }

  return Object.freeze({
    level: P5_FIELD_BETA_INCIDENT_LEVELS.NONE,
    betaMayContinue: true,
    cellMayContinue: true,
    action: "NONE",
  });
}

export function adjudicateP5FieldBetaSession({
  admission,
  preProbe,
  postProbe,
  continuity,
  incident,
  operatorEndConfirmed,
} = {}) {
  const failures = [];

  if (!admission?.pass) failures.push("SESSION_ADMISSION_NOT_PASS");
  if (!validProbe(preProbe)) failures.push("PRE_PROBE_INVALID");
  if (!validProbe(postProbe)) failures.push("POST_PROBE_INVALID");
  if (validProbe(preProbe) && validProbe(postProbe)) {
    if (preProbe.probeId === postProbe.probeId) failures.push("PROBE_ID_NOT_FRESH");
    if (preProbe.clientNonce === postProbe.clientNonce) failures.push("PROBE_NONCE_NOT_FRESH");
  }

  if (operatorEndConfirmed !== true) failures.push("OPERATOR_END_CONFIRMATION_REQUIRED");

  if (!continuity || typeof continuity !== "object") {
    failures.push("CONTINUITY_WITNESS_REQUIRED");
  } else {
    if (continuity.pass !== true) failures.push("CONTINUITY_FAILED");
    if (continuity.receiptStable !== true) failures.push("RECEIPT_NOT_STABLE");
    if (continuity.artifactStable !== true) failures.push("ARTIFACT_NOT_STABLE");
    if (continuity.continuityKeyStable !== true) failures.push("CONTINUITY_KEY_NOT_STABLE");
    if (continuity.continuityKey !== P5_FIELD_BETA_CANONICAL_CONTINUITY_KEY) failures.push("CANONICAL_CONTINUITY_KEY_MISMATCH");
    const refs = continuity.memoryIds ?? continuity.projectedMemoryIds;
    if (!sameStringArray(refs, EXPECTED_REFERENCES)) failures.push("EXPECTED_REFERENCES_MISMATCH");
    if (continuity.rawMemoryPersisted !== false) failures.push("RAW_MEMORY_PERSISTENCE_FORBIDDEN");
    if (continuity.rawTranscriptPersisted !== false) failures.push("RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN");
    if (continuity.fullStatePersisted !== false) failures.push("FULL_STATE_PERSISTENCE_FORBIDDEN");
    if (continuity.authorityPersisted !== false) failures.push("AUTHORITY_PERSISTENCE_FORBIDDEN");
  }

  const incidentLevel = incident?.level ?? P5_FIELD_BETA_INCIDENT_LEVELS.NONE;
  if (incidentLevel === P5_FIELD_BETA_INCIDENT_LEVELS.B4_SECRET_STOP_ROTATE) failures.push("B4_SECRET_INCIDENT");
  if (incidentLevel === P5_FIELD_BETA_INCIDENT_LEVELS.B3_BETA_STOP) failures.push("B3_BETA_STOP_INCIDENT");
  if (incidentLevel === P5_FIELD_BETA_INCIDENT_LEVELS.B2_CELL_HOLD) failures.push("B2_CELL_HOLD_INCIDENT");

  let decision = "SESSION_PASS_BOUNDED";
  if (failures.length > 0) {
    decision = incidentLevel === P5_FIELD_BETA_INCIDENT_LEVELS.B3_BETA_STOP
      || incidentLevel === P5_FIELD_BETA_INCIDENT_LEVELS.B4_SECRET_STOP_ROTATE
      ? "STOP_BETA"
      : "HOLD_SESSION";
  }

  return Object.freeze({
    pass: failures.length === 0,
    decision,
    cell: admission?.cell ?? null,
    failures: Object.freeze(failures),
    incidentLevel,
    universalCompatibilityClaim: false,
    productionReady: false,
  });
}

export function adjudicateP5FieldBetaOperationalization(input = {}) {
  const failures = [];
  for (const [key, code] of [
    ["supportContractFrozen", "SUPPORT_CONTRACT_NOT_FROZEN"],
    ["runbookFrozen", "RUNBOOK_NOT_FROZEN"],
    ["incidentProtocolFrozen", "INCIDENT_PROTOCOL_NOT_FROZEN"],
    ["rollbackProtocolFrozen", "ROLLBACK_PROTOCOL_NOT_FROZEN"],
    ["minimumTelemetryFrozen", "MINIMUM_TELEMETRY_NOT_FROZEN"],
    ["ciPass", "CI_NOT_PASS"],
    ["previewReady", "PREVIEW_NOT_READY"],
  ]) {
    if (input[key] !== true) failures.push(code);
  }
  if (input.productionMutation !== false) failures.push("PRODUCTION_MUTATION_FORBIDDEN");
  if (input.realOwnerMemory !== false) failures.push("REAL_OWNER_MEMORY_FORBIDDEN");
  if (input.externalOutreach !== false) failures.push("EXTERNAL_OUTREACH_NOT_AUTHORIZED");

  return Object.freeze({
    pass: failures.length === 0,
    decision: failures.length === 0
      ? "BOUNDED_FIELD_BETA_OPERATIONALIZATION_READY=PASS_BOUNDED"
      : "HOLD",
    failures: Object.freeze(failures),
    productionReady: false,
    realOwnerMemory: false,
    universalCompatibilityClaim: false,
  });
}
