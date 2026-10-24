import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/owner-beta/page.tsx",import.meta.url),"utf8");
const source = readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx",import.meta.url),"utf8");

test("Owner Beta is preview-only on exact isolated branch and hidden from search",()=>{
  assert.match(page,/process\.env\.VERCEL_ENV === "preview"/);
  assert.match(page,/process\.env\.VERCEL_GIT_COMMIT_REF ===/);
  assert.match(page,/domi-neon-staging-pg-startup-gate-20261010/);
  assert.match(page,/if \(!isolatedPreview\) notFound\(\)/);
  assert.match(page,/robots: \{ index: false, follow: false \}/);
});
test("Owner Beta renders synthetic interactions without real household binding",()=>{
  assert.match(page,/dataState="demo"/);
  assert.match(page,/<DomiCompanionHome/);
  assert.match(page,/<OwnerAlphaLongitudinalHarness \/>/);
  assert.doesNotMatch(page,/\bhid=/);
  assert.doesNotMatch(page,/\bdataState="real"/);
  assert.doesNotMatch(page,/\bfetch\(/);
  assert.match(page,/No ingreses/);
});
test("Domi demo chat never calls live assistant without authenticated household",()=>{
  assert.match(source,/if \(hid && dataState === "real"\)/);
  assert.match(source,/generateDomiReply\(text/);
  assert.match(source,/Modo demo: estos datos son de ejemplo/);
});
test("Owner sees understandable actions and explicit synthetic limits",()=>{
  assert.match(page,/href="#conversacion"/);
  assert.match(page,/href="#memoria"/);
  assert.match(page,/simulación local/);
  assert.match(page,/continuidad física/);
});
