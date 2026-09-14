import { spawnSync } from "node:child_process";
import { br0035Bindings } from "./domi-br0035-final-prelive-contracts.mjs";

const child = spawnSync(process.execPath, [new URL("./domi-owner-live-precheck-build.mjs", import.meta.url).pathname], {
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
    ...br0035Bindings(),
    br0035Adjudication: {
      finalBoundedPreLiveImplementationCutComplete: true,
      stopFurtherSyntheticPreliveExpansionAbsentNewLoadBearingFalsifier: true,
      g5Started: false,
    },
  };
  console.log(`${prefix}${JSON.stringify(enriched)}`);
}

if (!found) {
  throw new Error("DOMI_OWNER_LIVE_PRECHECK_BUILD_RESULT_NOT_FOUND");
}
if (child.status !== 0) process.exit(child.status ?? 1);
