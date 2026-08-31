import { spawnSync } from "node:child_process";
import { ar0001Bindings } from "./domi-prelive-architecture-readiness-contracts.mjs";

const child = spawnSync(process.execPath, [new URL("./domi-owner-live-precheck-build-br0035.mjs", import.meta.url).pathname], {
  env: process.env,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

if (child.stderr) process.stderr.write(child.stderr);

const lines = String(child.stdout ?? "").split(/\r?\n/);
let found = false;
for (const line of lines) {
  const prefix = "DOMI_OWNER_LIVE_PRECHECK_BUILD_RESULT=";
  if (!line.startsWith(prefix)) {
    if (line.length > 0) console.log(line);
    continue;
  }
  found = true;
  const base = JSON.parse(line.slice(prefix.length));
  const enriched = {
    ...base,
    ...ar0001Bindings(),
    architectureReadinessAdjudication: {
      gate: "G4_PRELIVE_ARCHITECTURE_READINESS",
      architectureReadinessOnly: true,
      priorBR0035FingerprintsPreservedByComposition: true,
      openaiCredentialBindingDeferred: true,
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
