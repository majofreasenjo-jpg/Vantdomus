import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  auditP5ProductionRouteBindingSources,
} from "../lib/domiP5ProductionRouteBindingAudit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function read(relative) {
  return readFileSync(join(webRoot, relative), "utf8");
}

function currentAudit() {
  return auditP5ProductionRouteBindingSources({
    proxy: read("proxy.ts"),
    nextConfig: read("next.config.js"),
    authProxy: read("app/api/proxy/[...path]/route.ts"),
    fieldPreflight: read("app/api/p5-field-beta-preflight/route.ts"),
    networkProbe: read("app/api/p5-network-probe/route.ts"),
    pages: {
      CONTINUITY_RESUME: read("app/owner-alpha-continuity-resume/page.tsx"),
      CROSS_DEVICE_RETURN: read("app/owner-alpha-cross-device-return/page.tsx"),
      CROSS_DEVICE: read("app/owner-alpha-cross-device/page.tsx"),
      DEVICE_MATRIX: read("app/owner-alpha-device-matrix/page.tsx"),
      FIELD_BETA_OPS: read("app/owner-alpha-field-beta-ops/page.tsx"),
      HANDOFF: read("app/owner-alpha-handoff/page.tsx"),
      NETWORK_TRANSITION: read("app/owner-alpha-network-transition/page.tsx"),
      MEMORY_TEST: read("app/owner-alpha-memory-test/page.tsx"),
    },
  });
}

test("existing authenticated proxy already supplies token, CSRF, body-limit and no-store controls", () => {
  const result = currentAudit();
  assert.equal(result.controls.authenticatedProxyRequiresToken, true);
  assert.equal(result.controls.authenticatedProxyCsrf, true);
  assert.equal(result.controls.authenticatedProxyBodyLimit, true);
  assert.equal(result.controls.authenticatedProxyNoStore, true);
  assert.equal(result.controls.globalSecurityHeaders, true);
  assert.equal(result.controls.allApiNoStore, true);
});

test("field beta preflight remains preview-only and no-store", () => {
  const result = currentAudit();
  assert.equal(result.controls.fieldPreflightPreviewOnly, true);
  assert.equal(result.controls.fieldPreflightNoStore, true);
});

test("current owner-alpha P5 pages are not globally session-bound by web proxy", () => {
  const result = currentAudit();
  assert.equal(result.controls.ownerAlphaInProtectedProxy, false);
  assert.equal(
    result.blockers.includes("P5_OWNER_ALPHA_NOT_BOUND_TO_AUTHENTICATED_WEB_PROXY"),
    true,
  );
});

test("owner-alpha page no-store policy is not yet globally bound", () => {
  const result = currentAudit();
  assert.equal(result.controls.ownerAlphaNoStorePolicy, false);
  assert.equal(
    result.blockers.includes("P5_OWNER_ALPHA_PAGE_NO_STORE_POLICY_MISSING"),
    true,
  );
});

test("cross-device, handoff and memory-test retain explicit Preview notFound guards", () => {
  const result = currentAudit();
  for (const id of ["CROSS_DEVICE", "HANDOFF", "MEMORY_TEST"]) {
    const row = result.pages.find((item) => item.id === id);
    assert.equal(row?.previewGuard, true, id);
  }
});

test("continuity, return, matrix, field-ops and network-transition pages still lack server Preview guards", () => {
  const result = currentAudit();
  for (const id of [
    "CONTINUITY_RESUME",
    "CROSS_DEVICE_RETURN",
    "DEVICE_MATRIX",
    "FIELD_BETA_OPS",
    "NETWORK_TRANSITION",
  ]) {
    const row = result.pages.find((item) => item.id === id);
    assert.equal(row?.previewGuard, false, id);
    assert.equal(result.blockers.includes(`${id}_PREVIEW_GUARD_MISSING`), true, id);
  }
});

test("direct P5 network probe currently lacks environment and session binding", () => {
  const result = currentAudit();
  assert.equal(result.controls.networkProbeNoStore, true);
  assert.equal(result.controls.networkProbePreviewOnly, false);
  assert.equal(result.controls.networkProbeSessionBound, false);
  assert.equal(
    result.blockers.includes("P5_NETWORK_PROBE_ENVIRONMENT_GUARD_MISSING"),
    true,
  );
  assert.equal(
    result.blockers.includes("P5_NETWORK_PROBE_SESSION_BINDING_MISSING"),
    true,
  );
});

test("audit refuses production route binding while owner/tenant, audit-event and rate policies remain unbound", () => {
  const result = currentAudit();
  assert.equal(result.pass, false);
  assert.equal(result.decision, "HOLD_PRODUCTION_ROUTE_BINDING");
  assert.equal(
    result.blockers.includes("P5_OWNER_TENANT_SCOPE_BINDING_NOT_IMPLEMENTED"),
    true,
  );
  assert.equal(
    result.blockers.includes("P5_PRODUCTION_AUDIT_SECURITY_EVENT_BINDING_NOT_IMPLEMENTED"),
    true,
  );
  assert.equal(
    result.blockers.includes("P5_PRODUCTION_RATE_LIMIT_POLICY_NOT_BOUND_TO_DIRECT_P5_PROBES"),
    true,
  );
  assert.equal(result.productionReady, false);
  assert.equal(result.productionMutationAllowed, false);
  assert.equal(result.executableBinding, false);
});

test("recommended architecture keeps owner-alpha harnesses isolated rather than promoting them directly", () => {
  const result = currentAudit();
  assert.equal(
    result.recommendedArchitecture,
    "KEEP_OWNER_ALPHA_HARNESSES_PREVIEW_ONLY_AND_CREATE_SEPARATE_AUTHENTICATED_OWNER_SCOPED_PRODUCTION_SURFACE",
  );
});
