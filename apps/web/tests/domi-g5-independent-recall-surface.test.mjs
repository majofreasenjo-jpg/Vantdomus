import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const routePath = path.resolve(process.cwd(), "app/owner-g5-recall/page.tsx");
const source = fs.readFileSync(routePath, "utf8");

test("G5 recall surface is preview-only and branch-isolated", () => {
  assert.match(source, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(source, /process\.env\.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck"/);
  assert.match(source, /if \(!isolatedPreview\) notFound\(\)/);
});

test("G5 recall surface reads persisted governed memory instead of current-turn input", () => {
  assert.match(source, /readG5FirstOwnerMemory\(\)/);
  assert.doesNotMatch(source, /searchParams/);
  assert.doesNotMatch(source, /useSearchParams/);
  assert.doesNotMatch(source, /request\.json/);
  assert.doesNotMatch(source, /FormData/);
  assert.doesNotMatch(source, /cookies\(/);
  assert.doesNotMatch(source, /headers\(/);
});

test("G5 recall surface exposes custody metadata and keeps claim wall closed", () => {
  assert.match(source, /readback\.entryId/);
  assert.match(source, /readback\.entryFingerprint/);
  assert.match(source, /readback\.realOwnerMemoryEntryCount/);
  assert.match(source, /readback\.scientificRootsMinted/);
  assert.match(source, /REAL_DEVELOPMENT_DEMONSTRATED=FALSE/);
  assert.match(source, /SUBJECTHOOD_DEMONSTRATED=FALSE/);
  assert.match(source, /SELF_SPECIFICITY_ESTABLISHED=FALSE/);
  assert.match(source, /CONSCIOUSNESS_DEMONSTRATED=FALSE/);
});
