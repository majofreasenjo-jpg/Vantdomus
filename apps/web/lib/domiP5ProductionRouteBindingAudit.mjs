export const DOMI_P5_PRODUCTION_ROUTE_BINDING_AUDIT_VERSION =
  "DOMI_P5_PRODUCTION_ROUTE_BINDING_AUDIT_V0_1";

export const P5_PRODUCTION_ROUTE_SURFACES = Object.freeze([
  Object.freeze({
    id: "CONTINUITY_RESUME",
    path: "/owner-alpha-continuity-resume",
    sourcePath: "app/owner-alpha-continuity-resume/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY_OR_REPLACE",
  }),
  Object.freeze({
    id: "CROSS_DEVICE_RETURN",
    path: "/owner-alpha-cross-device-return",
    sourcePath: "app/owner-alpha-cross-device-return/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY_OR_REPLACE",
  }),
  Object.freeze({
    id: "CROSS_DEVICE",
    path: "/owner-alpha-cross-device",
    sourcePath: "app/owner-alpha-cross-device/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY",
  }),
  Object.freeze({
    id: "DEVICE_MATRIX",
    path: "/owner-alpha-device-matrix",
    sourcePath: "app/owner-alpha-device-matrix/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY_OR_REPLACE",
  }),
  Object.freeze({
    id: "FIELD_BETA_OPS",
    path: "/owner-alpha-field-beta-ops",
    sourcePath: "app/owner-alpha-field-beta-ops/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY_OR_REPLACE",
  }),
  Object.freeze({
    id: "HANDOFF",
    path: "/owner-alpha-handoff",
    sourcePath: "app/owner-alpha-handoff/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY",
  }),
  Object.freeze({
    id: "NETWORK_TRANSITION",
    path: "/owner-alpha-network-transition",
    sourcePath: "app/owner-alpha-network-transition/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY_OR_REPLACE",
  }),
  Object.freeze({
    id: "MEMORY_TEST",
    path: "/owner-alpha-memory-test",
    sourcePath: "app/owner-alpha-memory-test/page.tsx",
    disposition: "KEEP_PREVIEW_ONLY_BLOCK_PRODUCTION_UNTIL_ROM_AUTHORIZED",
  }),
]);

export const P5_PRODUCTION_API_SURFACES = Object.freeze([
  Object.freeze({
    id: "FIELD_BETA_PREFLIGHT",
    path: "/api/p5-field-beta-preflight",
    sourcePath: "app/api/p5-field-beta-preflight/route.ts",
    disposition: "KEEP_PREVIEW_ONLY",
  }),
  Object.freeze({
    id: "NETWORK_PROBE",
    path: "/api/p5-network-probe",
    sourcePath: "app/api/p5-network-probe/route.ts",
    disposition: "KEEP_PREVIEW_ONLY_OR_REPLACE_WITH_AUTHENTICATED_PROBE",
  }),
]);

function includesAll(source, needles) {
  return needles.every((needle) => source.includes(needle));
}

function pageHasPreviewGuard(source) {
  return includesAll(source, [
    'process.env.VERCEL_ENV === "preview"',
    "notFound()",
  ]);
}

function pageHasSessionBinding(source) {
  return /vantdomus_(session_id|access_token)|Authentication required|cookies\(/.test(source);
}

function apiHasSessionBinding(source) {
  return /vantdomus_(session_id|access_token)|Authentication required|bearerToken\(|cookies\(/.test(source);
}

export function auditP5ProductionRouteBindingSources(sources = {}) {
  const proxy = String(sources.proxy ?? "");
  const nextConfig = String(sources.nextConfig ?? "");
  const authProxy = String(sources.authProxy ?? "");
  const fieldPreflight = String(sources.fieldPreflight ?? "");
  const networkProbe = String(sources.networkProbe ?? "");
  const pages = sources.pages ?? {};

  const controls = {
    globalSecurityHeaders:
      includesAll(nextConfig, [
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
      ]),
    allApiNoStore:
      nextConfig.includes("source: '/api/:path*'")
      && nextConfig.includes("Cache-Control', value: 'no-store, max-age=0"),
    authenticatedProxyRequiresToken:
      includesAll(authProxy, [
        "bearerToken()",
        'Authentication required',
        "status: 401",
      ]),
    authenticatedProxyCsrf:
      includesAll(authProxy, [
        "validateCsrf",
        "CSRF validation failed",
        "Invalid request origin",
      ]),
    authenticatedProxyBodyLimit:
      includesAll(authProxy, [
        "AUTHENTICATED_PROXY_MAX_BODY_BYTES",
        "Request body too large",
        "status: 413",
      ]),
    authenticatedProxyNoStore:
      includesAll(authProxy, [
        'Cache-Control", "no-store, max-age=0',
        'cache: "no-store"',
      ]),
    localDemoFallbackFailClosed:
      includesAll(proxy, [
        "LOCAL_ENV_NAMES",
        "allowLocalDemoFallback",
        "NEXT_PUBLIC_ACCESS_TOKEN",
      ]),
    ownerAlphaInProtectedProxy:
      proxy.includes('"/owner-alpha"') || proxy.includes('"/owner-alpha-'),
    ownerAlphaNoStorePolicy:
      nextConfig.includes("source: '/owner-alpha/:path*'")
      || nextConfig.includes("source: '/owner-alpha-:path*'"),
    fieldPreflightPreviewOnly:
      includesAll(fieldPreflight, [
        'vercelEnv !== "preview"',
        "P5_FIELD_BETA_PREVIEW_ONLY",
        "status: 403",
      ]),
    fieldPreflightNoStore:
      fieldPreflight.includes("NO_STORE_HEADERS")
      && fieldPreflight.includes("no-store"),
    fieldPreflightSessionBound: apiHasSessionBinding(fieldPreflight),
    networkProbeNoStore:
      networkProbe.includes("NO_STORE_HEADERS")
      && networkProbe.includes("no-store"),
    networkProbePreviewOnly:
      networkProbe.includes('VERCEL_ENV')
      && networkProbe.includes('"preview"'),
    networkProbeSessionBound: apiHasSessionBinding(networkProbe),
  };

  const pageAudit = P5_PRODUCTION_ROUTE_SURFACES.map((surface) => {
    const source = String(pages[surface.id] ?? "");
    return Object.freeze({
      ...surface,
      sourcePresent: source.length > 0,
      previewGuard: pageHasPreviewGuard(source),
      sessionBound: pageHasSessionBinding(source),
    });
  });

  const blockers = [];

  if (!controls.ownerAlphaInProtectedProxy) {
    blockers.push("P5_OWNER_ALPHA_NOT_BOUND_TO_AUTHENTICATED_WEB_PROXY");
  }
  if (!controls.ownerAlphaNoStorePolicy) {
    blockers.push("P5_OWNER_ALPHA_PAGE_NO_STORE_POLICY_MISSING");
  }
  if (!controls.fieldPreflightSessionBound) {
    blockers.push("P5_FIELD_PREFLIGHT_SESSION_BINDING_MISSING");
  }
  if (!controls.networkProbePreviewOnly) {
    blockers.push("P5_NETWORK_PROBE_ENVIRONMENT_GUARD_MISSING");
  }
  if (!controls.networkProbeSessionBound) {
    blockers.push("P5_NETWORK_PROBE_SESSION_BINDING_MISSING");
  }

  for (const item of pageAudit) {
    if (
      item.disposition === "KEEP_PREVIEW_ONLY"
      || item.disposition === "KEEP_PREVIEW_ONLY_BLOCK_PRODUCTION_UNTIL_ROM_AUTHORIZED"
    ) {
      if (!item.previewGuard) blockers.push(`${item.id}_PREVIEW_GUARD_MISSING`);
      continue;
    }
    if (!item.previewGuard) blockers.push(`${item.id}_PREVIEW_GUARD_MISSING`);
    if (!item.sessionBound) blockers.push(`${item.id}_SESSION_BINDING_MISSING`);
  }

  blockers.push("P5_OWNER_TENANT_SCOPE_BINDING_NOT_IMPLEMENTED");
  blockers.push("P5_PRODUCTION_AUDIT_SECURITY_EVENT_BINDING_NOT_IMPLEMENTED");
  blockers.push("P5_PRODUCTION_RATE_LIMIT_POLICY_NOT_BOUND_TO_DIRECT_P5_PROBES");
  blockers.push("P5_PRODUCTION_MUTATION_CSRF_POLICY_NOT_APPLICABLE_YET_BUT_REQUIRED_FOR_ANY_FUTURE_MUTATION");

  return Object.freeze({
    version: DOMI_P5_PRODUCTION_ROUTE_BINDING_AUDIT_VERSION,
    pass: blockers.length === 0,
    decision: blockers.length === 0
      ? "ROUTE_BINDING_SPEC_SATISFIED"
      : "HOLD_PRODUCTION_ROUTE_BINDING",
    controls: Object.freeze(controls),
    pages: Object.freeze(pageAudit),
    blockers: Object.freeze(blockers),
    productionReady: false,
    productionMutationAllowed: false,
    executableBinding: false,
    recommendedArchitecture:
      "KEEP_OWNER_ALPHA_HARNESSES_PREVIEW_ONLY_AND_CREATE_SEPARATE_AUTHENTICATED_OWNER_SCOPED_PRODUCTION_SURFACE",
  });
}
