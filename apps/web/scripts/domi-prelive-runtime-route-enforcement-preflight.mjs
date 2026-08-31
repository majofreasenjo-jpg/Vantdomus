import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routePath = resolve(here, "../app/api/domi-owner-live-precheck/route.ts");
const source = readFileSync(routePath, "utf8");
const checks = [];

function check(name, fn) {
  fn();
  checks.push({ name, status: "PASS" });
}
function pos(token) {
  const index = source.indexOf(token);
  assert.notEqual(index, -1, `missing token: ${token}`);
  return index;
}

const admissionCall = pos("const preContactAdmission = adjudicateRuntimePreContactAdmission()");
const blockedBranch = pos("AR0001_PRECONTACT_ADMISSION_BLOCKED");
const credentialRead = pos("const apiKey = process.env.OPENAI_API_KEY");
const networkCall = pos("await fetch(OPENAI_RESPONSES_URL");

check("runtime-admission-function-present", () => assert.ok(source.includes("function adjudicateRuntimePreContactAdmission()")));
check("admission-before-credential-read", () => assert.ok(admissionCall < credentialRead));
check("blocked-branch-before-credential-read", () => assert.ok(blockedBranch < credentialRead));
check("credential-read-before-network-call", () => assert.ok(credentialRead < networkCall));
check("admission-before-network-call", () => assert.ok(admissionCall < networkCall));
check("blocked-admission-declares-no-network", () => {
  const segment = source.slice(blockedBranch, credentialRead);
  assert.ok(segment.includes("networkAttempted: false"));
  assert.ok(segment.includes('credentialSource: "NONE"'));
});
check("runtime-embeds-frozen-ar0001-fingerprint", () => assert.ok(source.includes("236f1df9d8f70f82037e4e31ef0507f78f7194c00cc601f8b9bae06e2b400817")));
check("preview-only-isolation-present", () => assert.ok(source.includes('process.env.VERCEL_ENV !== "preview"')));
check("isolated-branch-binding-present", () => assert.ok(source.includes('const REQUIRED_BRANCH = "domi-owner-live-precheck"')));
check("no-public-openai-secret-variable", () => assert.equal(source.includes("NEXT_PUBLIC_OPENAI"), false));
check("selected-future-is-external-to-provider", () => {
  assert.ok(source.includes('selectedFutureId: "F-CAUTIOUS"'));
  assert.ok(source.includes("selectedFutureChosenOutsideProvider: true"));
});
check("family-holdout-production-isolation-present", () => {
  assert.ok(source.includes("familyDataUsed: false"));
  assert.ok(source.includes("holdoutsOpened: false"));
  assert.ok(source.includes("productionTouched: false"));
});
check("constitutive-authorities-remain-domi-runtime", () => {
  for (const field of ["identityAuthority", "memoryAuthority", "obligationAuthority", "lineageAuthority", "actionAuthority"]) {
    assert.ok(source.includes(`${field}: "DOMI_RUNTIME"`));
  }
});
check("no-network-before-admission-marker", () => {
  const prefix = source.slice(0, admissionCall);
  assert.equal(prefix.includes("await fetch("), false);
});

console.log(`DOMI_AR0001_RUNTIME_ROUTE_ENFORCEMENT_PREFLIGHT=${JSON.stringify({ ok: true, passed: checks.length, failed: 0, checks, admissionBeforeCredential: admissionCall < credentialRead, admissionBeforeNetwork: admissionCall < networkCall, ar0001ContractFingerprint: "236f1df9d8f70f82037e4e31ef0507f78f7194c00cc601f8b9bae06e2b400817" })}`);
