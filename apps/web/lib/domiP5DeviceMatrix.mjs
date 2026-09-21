export const DOMI_P5_DEVICE_MATRIX_VERSION = "DOMI_P5_DEVICE_MATRIX_V0_1";
export const P5_DEVICE_MATRIX_ARTIFACT_STORAGE_KEY = "domi:p5:device-matrix-artifact:v0.1";
export const P5_DEVICE_MATRIX_BASELINE_PREFIX = "domi:p5:device-matrix-baseline:v0.1:";
export const P5_DEVICE_MATRIX_RESULT_PREFIX = "domi:p5:device-matrix-result:v0.1:";

export const P5_DEVICE_MATRIX_CELLS = Object.freeze({
  ANDROID_CHROME_DESTINATION: "ANDROID_CHROME_DESTINATION",
  WINDOWS_EDGE_SOURCE: "WINDOWS_EDGE_SOURCE",
  WINDOWS_CHROME_SOURCE: "WINDOWS_CHROME_SOURCE",
  IOS_SAFARI_DESTINATION: "IOS_SAFARI_DESTINATION",
});

export const P5_DEVICE_MATRIX_SPECS = Object.freeze({
  [P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION]: Object.freeze({
    platformClass: "ANDROID",
    browserClass: "CHROME",
    role: "DESTINATION",
    afterStage: "REOPEN",
    label: "Android + Chrome · destino",
  }),
  [P5_DEVICE_MATRIX_CELLS.WINDOWS_EDGE_SOURCE]: Object.freeze({
    platformClass: "WINDOWS",
    browserClass: "EDGE",
    role: "SOURCE",
    afterStage: "RELOAD",
    label: "Windows + Edge · fuente",
  }),
  [P5_DEVICE_MATRIX_CELLS.WINDOWS_CHROME_SOURCE]: Object.freeze({
    platformClass: "WINDOWS",
    browserClass: "CHROME",
    role: "SOURCE",
    afterStage: "RELOAD",
    label: "Windows + Chrome · fuente",
  }),
  [P5_DEVICE_MATRIX_CELLS.IOS_SAFARI_DESTINATION]: Object.freeze({
    platformClass: "IOS",
    browserClass: "SAFARI",
    role: "DESTINATION",
    afterStage: "REOPEN",
    label: "iPhone/iPad + Safari · destino",
  }),
});

const EXPECTED_MEMORY_IDS = Object.freeze(["P5-M-PRIVATE", "P5-M-SHARED"]);
const DIGEST_RE = /^fnv1a32:[0-9a-f]{8}$/;

function validIso(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(new Date(value).getTime());
}

function sameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

export function classifyP5BrowserEnvironment({ userAgent = "", platform = "" } = {}) {
  const ua = String(userAgent);
  const pf = String(platform);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /(iPhone|iPad|iPod)/i.test(ua) || (/Mac/i.test(pf) && /Mobile/i.test(ua));
  const isWindows = /Windows/i.test(ua) || /Win/i.test(pf);

  let platformClass = "UNKNOWN";
  if (isAndroid) platformClass = "ANDROID";
  else if (isIOS) platformClass = "IOS";
  else if (isWindows) platformClass = "WINDOWS";

  let browserClass = "UNKNOWN";
  if (/(Edg|EdgA|EdgiOS)\//i.test(ua)) browserClass = "EDGE";
  else if (/(CriOS|Chrome)\//i.test(ua) && !/(OPR|SamsungBrowser)\//i.test(ua)) browserClass = "CHROME";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua) && !/(CriOS|FxiOS|EdgiOS)\//i.test(ua)) browserClass = "SAFARI";

  const suggestedCell = Object.entries(P5_DEVICE_MATRIX_SPECS)
    .find(([, spec]) => spec.platformClass === platformClass && spec.browserClass === browserClass)?.[0] ?? null;

  return Object.freeze({ platformClass, browserClass, suggestedCell });
}

function validateProbe(probe, label, failures) {
  if (!probe || typeof probe !== "object") {
    failures.push(`${label}_FRESH_PROBE_REQUIRED`);
    return;
  }
  if (probe.ok !== true || probe.status !== 200) failures.push(`${label}_FRESH_PROBE_FAILED`);
  if (typeof probe.probeId !== "string" || probe.probeId.length < 8) failures.push(`${label}_PROBE_ID_INVALID`);
  if (typeof probe.clientNonce !== "string" || probe.clientNonce.length < 8) failures.push(`${label}_PROBE_NONCE_INVALID`);
  if (!validIso(probe.serverTime)) failures.push(`${label}_PROBE_SERVER_TIME_INVALID`);
}

function validateContinuity(continuity, spec, label, failures) {
  if (!continuity || typeof continuity !== "object") {
    failures.push(`${label}_CONTINUITY_REQUIRED`);
    return;
  }
  if (continuity.pass !== true) failures.push(`${label}_CONTINUITY_FAILED`);
  if (typeof continuity.receiptId !== "string" || continuity.receiptId.length < 8) failures.push(`${label}_RECEIPT_ID_INVALID`);
  if (!DIGEST_RE.test(String(continuity.receiptDigest ?? ""))) failures.push(`${label}_RECEIPT_DIGEST_INVALID`);
  if (!DIGEST_RE.test(String(continuity.artifactDigest ?? ""))) failures.push(`${label}_ARTIFACT_DIGEST_INVALID`);
  if (!DIGEST_RE.test(String(continuity.continuityKey ?? ""))) failures.push(`${label}_CONTINUITY_KEY_INVALID`);
  if (continuity.rawMemoryPersisted !== false) failures.push(`${label}_RAW_MEMORY_PERSISTENCE_FORBIDDEN`);
  if (continuity.rawTranscriptPersisted !== false) failures.push(`${label}_RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN`);
  if (continuity.fullStatePersisted !== false) failures.push(`${label}_FULL_STATE_PERSISTENCE_FORBIDDEN`);
  if (continuity.authorityPersisted !== false) failures.push(`${label}_AUTHORITY_PERSISTENCE_FORBIDDEN`);

  if (spec.role === "DESTINATION") {
    if (!sameStringArray(continuity.memoryIds, EXPECTED_MEMORY_IDS)) failures.push(`${label}_RECOVERED_REFERENCES_MISMATCH`);
  } else {
    if (continuity.sourceReplayPass !== true) failures.push(`${label}_SOURCE_REPLAY_FAILED`);
    if (!sameStringArray(continuity.projectedMemoryIds, EXPECTED_MEMORY_IDS)) failures.push(`${label}_PROJECTED_REFERENCES_MISMATCH`);
  }
}

function validateObservation(observation, spec, expectedStage, label) {
  const failures = [];
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
    return [`${label}_OBSERVATION_REQUIRED`];
  }
  if (observation.stage !== expectedStage) failures.push(`${label}_STAGE_MISMATCH`);
  if (observation.cell !== observation.selectedCell) failures.push(`${label}_CELL_INTERNAL_MISMATCH`);
  if (observation.ownerPhysicalEnvironmentConfirmed !== true) failures.push(`${label}_OWNER_ENVIRONMENT_CONFIRMATION_REQUIRED`);
  if (observation.detectedPlatformClass !== spec.platformClass) failures.push(`${label}_PLATFORM_MISMATCH`);
  if (observation.detectedBrowserClass !== spec.browserClass) failures.push(`${label}_BROWSER_MISMATCH`);
  if (observation.role !== spec.role) failures.push(`${label}_ROLE_MISMATCH`);
  if (observation.browserOnline !== true) failures.push(`${label}_BROWSER_OFFLINE`);
  if (observation.handoffPresent !== false) failures.push(`${label}_HANDOFF_MUST_BE_ABSENT`);
  if (!validIso(observation.observedAt)) failures.push(`${label}_OBSERVED_AT_INVALID`);
  validateProbe(observation.probe, label, failures);
  validateContinuity(observation.continuity, spec, label, failures);
  return failures;
}

export function adjudicateP5DeviceMatrixCell({ cell, baseline, after }) {
  const spec = P5_DEVICE_MATRIX_SPECS[cell];
  if (!spec) {
    return Object.freeze({
      version: DOMI_P5_DEVICE_MATRIX_VERSION,
      pass: false,
      cell,
      failures: Object.freeze(["DEVICE_MATRIX_CELL_UNSUPPORTED"]),
      claim: "HOLD",
    });
  }

  const failures = [
    ...validateObservation(baseline, spec, "BASELINE", "BASELINE"),
    ...validateObservation(after, spec, spec.afterStage, "AFTER"),
  ];

  if (baseline?.cell !== cell || after?.cell !== cell) failures.push("CELL_SELECTION_CHANGED");
  if (after?.ownerTransitionConfirmed !== true) failures.push("AFTER_OWNER_TRANSITION_CONFIRMATION_REQUIRED");

  if (baseline?.probe && after?.probe) {
    if (baseline.probe.probeId === after.probe.probeId) failures.push("PROBE_ID_NOT_FRESH");
    if (baseline.probe.clientNonce === after.probe.clientNonce) failures.push("PROBE_NONCE_NOT_FRESH");
  }

  if (validIso(baseline?.observedAt) && validIso(after?.observedAt)
    && new Date(after.observedAt).getTime() <= new Date(baseline.observedAt).getTime()) {
    failures.push("OBSERVATION_TIME_NOT_ADVANCED");
  }

  if (baseline?.continuity && after?.continuity) {
    if (baseline.continuity.receiptId !== after.continuity.receiptId) failures.push("RECEIPT_ID_CHANGED");
    if (baseline.continuity.receiptDigest !== after.continuity.receiptDigest) failures.push("RECEIPT_DIGEST_CHANGED");
    if (baseline.continuity.artifactDigest !== after.continuity.artifactDigest) failures.push("ARTIFACT_DIGEST_CHANGED");
    if (baseline.continuity.continuityKey !== after.continuity.continuityKey) failures.push("CONTINUITY_KEY_CHANGED");
  }

  return Object.freeze({
    version: DOMI_P5_DEVICE_MATRIX_VERSION,
    pass: failures.length === 0,
    cell,
    role: spec.role,
    platformClass: spec.platformClass,
    browserClass: spec.browserClass,
    afterStage: spec.afterStage,
    failures: Object.freeze(failures),
    claim: failures.length === 0 ? `${cell}=PASS_BOUNDED` : "HOLD",
    supportBoundary: "ONLY_THIS_PHYSICALLY_VERIFIED_BROWSER_OS_DEVICE_CELL",
  });
}

export function adjudicateP5SupportedMatrix(cellResults = []) {
  const passed = cellResults.filter((result) => result?.pass === true);
  const sourceCells = passed.filter((result) => result.role === "SOURCE");
  const destinationCells = passed.filter((result) => result.role === "DESTINATION");
  const failures = [];
  if (sourceCells.length < 1) failures.push("AT_LEAST_ONE_SOURCE_CELL_REQUIRED");
  if (destinationCells.length < 1) failures.push("AT_LEAST_ONE_DESTINATION_CELL_REQUIRED");

  return Object.freeze({
    version: DOMI_P5_DEVICE_MATRIX_VERSION,
    pass: failures.length === 0,
    failures: Object.freeze(failures),
    supportedCells: Object.freeze(passed.map((result) => result.cell)),
    sourceCells: Object.freeze(sourceCells.map((result) => result.cell)),
    destinationCells: Object.freeze(destinationCells.map((result) => result.cell)),
    claim: failures.length === 0 ? "SUPPORTED_BROWSER_OS_DEVICE_MATRIX=PASS_BOUNDED" : "HOLD",
    universalCompatibilityClaim: false,
  });
}
