import { spawnSync } from "node:child_process";
import { ar0001Bindings } from "./domi-prelive-architecture-readiness-contracts.mjs";
import {
  OWNER_SYNTHETIC_PRECONTACT_MANIFEST,
  adjudicatePreContactAdmission,
} from "./domi-prelive-architecture-readiness-admission.mjs";

const prefix = "DOMI_OWNER_LIVE_PRECHECK_BUILD_RESULT=";
const preContactAdmission = adjudicatePreContactAdmission(OWNER_SYNTHETIC_PRECONTACT_MANIFEST);

if (!preContactAdmission.ok || preContactAdmission.networkMayBeAttempted !== true) {
  console.log(`${prefix}${JSON.stringify({
    decision: "AR0001_PRECONTACT_ADMISSION_BLOCKED",
    liveOk: false,
    networkAttempted: false,
    credentialSource: "NONE",
    preContactAdmission,
    ...ar0001Bindings(),
    architectureReadinessAdjudication: {
      gate: "G4_PRELIVE_ARCHITECTURE_READINESS",
      architectureReadinessOnly: true,
      preContactAdmissionCausallyUpstreamOfProviderCapableChild: true,
      providerCapableChildSpawned: false,
      productionTouched: false,
      familyDataUsed: false,
      holdoutsOpened: false,
      firstRealLivingBridgeContactAttempted: false,
      g5Started: false,
    },
  })}`);
  process.exit(1);
}

const child = spawnSync(process.execPath, [new URL("./domi-owner-live-precheck-build-br0035.mjs", import.meta.url).pathname], {
  env: {
    ...process.env,
    DOMI_AR0001_PRECONTACT_ADMISSION: preContactAdmission.decision,
    DOMI_AR0001_PRECONTACT_FINGERPRINT: preContactAdmission.ar0001ContractFingerprint,
  },
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

if (child.stderr) process.stderr.write(child.stderr);

const lines = String(child.stdout ?? "").split(/\r?\n/);
let found = false;
for (const line of lines) {
  if (!line.startsWith(prefix)) {
    if (line.length > 0) console.log(line);
    continue;
  }
  found = true;
  const base = JSON.parse(line.slice(prefix.length));
  const enriched = {
    ...base,
    preContactAdmission,
    ...ar0001Bindings(),
    architectureReadinessAdjudication: {
      gate: "G4_PRELIVE_ARCHITECTURE_READINESS",
      architectureReadinessOnly: true,
      priorBR0035FingerprintsPreservedByComposition: true,
      preContactAdmissionCausallyUpstreamOfProviderCapableChild: true,
      providerCapableChildSpawnedOnlyAfterAdmissionPass: true,
      openaiCredentialBindingDeferred: !process.env.OPENAI_API_KEY,
      productionTouched: false,
      familyDataUsed: false,
      holdoutsOpened: false,
      firstRealLivingBridgeContactAttempted: false,
      g5Started: false,
    },
  };
  console.log(`${prefix}${JSON.stringify(enriched)}`);
}

if (!found) {
  throw new Error("DOMI_OWNER_LIVE_PRECHECK_BUILD_RESULT_NOT_FOUND");
}
if (child.status !== 0) process.exit(child.status ?? 1);
