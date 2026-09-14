import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagePath = new URL("../app/owner-alpha/page.tsx", import.meta.url);
const harnessPath = new URL("../app/owner-alpha/OwnerAlphaLongitudinalHarness.tsx", import.meta.url);

const [page, harness] = await Promise.all([
  readFile(pagePath, "utf8"),
  readFile(harnessPath, "utf8"),
]);

test("owner alpha remains preview-only and binds longitudinal harness", () => {
  assert.match(page, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(page, /process\.env\.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck"/);
  assert.match(page, /if \(!isolatedPreview\) notFound\(\)/);
  assert.match(page, /<DomiCompanionHome[\s\S]*dataState="demo"/);
  assert.match(page, /<OwnerAlphaLongitudinalHarness \/>/);
});

test("p3.1 harness uses the target-native longitudinal spine", () => {
  assert.match(harness, /domiLongitudinalConversationSpine\.mjs/);
  assert.match(harness, /createLongitudinalConversationState/);
  assert.match(harness, /proposeMemoryCandidate/);
  assert.match(harness, /adjudicateMemoryCandidate/);
  assert.match(harness, /buildLongitudinalContext/);
});

test("p3.1 harness contains no real household binding or backend memory write", () => {
  assert.match(harness, /OWNER_ALPHA_SYNTHETIC_HOUSEHOLD/);
  assert.match(harness, /OWNER_ALPHA_SYNTHETIC_PERSON/);
  assert.doesNotMatch(harness, /assistantChat\(/);
  assert.doesNotMatch(harness, /fetch\(/);
  assert.doesNotMatch(harness, /add_memory/i);
  assert.doesNotMatch(harness, /memory_items/);
});

test("p3.1 exposes remember, recall, correction, forgetting and inference confirmation", () => {
  assert.match(harness, /“Recuerda que…”/);
  assert.match(harness, /Nueva sesión móvil/);
  assert.match(harness, /Corregir/);
  assert.match(harness, /Olvidar/);
  assert.match(harness, /Proponer inferencia/);
  assert.match(harness, /Confirmar inferencia/);
});

test("p3.1 exposes shared-TV privacy suppression", () => {
  assert.match(harness, /SHARED_TV/);
  assert.match(harness, /private_self/);
  assert.match(harness, /queda suprimido por defecto/);
});
