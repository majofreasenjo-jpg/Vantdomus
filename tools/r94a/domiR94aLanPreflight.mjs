/**
 * DOMI R94-A — OFFLINE DESIGN-ONLY LAN topology preflight.
 *
 * This module validates a proposed configuration. It never binds a socket,
 * probes a device, modifies DNS/firewall, generates certificates, starts a
 * process, or authenticates a user. A passing result is NOT authorization to
 * deploy or evidence of PC-phone continuity.
 *
 * Usage: node tools/r94a/domiR94aLanPreflight.mjs tools/r94a/example.plan.json
 * The CLI reads only a local JSON file and prints non-sensitive result codes.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const R94A_SCHEMA = "DOMI_R94A_PRIVATE_HTTPS_LAN_DESIGN_V1";
const LOOPBACK_WEB = "http://127.0.0.1:3000";
const LOOPBACK_API = "http://127.0.0.1:8001";
const UNRESOLVED = Object.freeze([
  "TLS_TRUST_UNVERIFIED",
  "PRIVATE_DNS_UNVERIFIED",
  "LAN_FIREWALL_UNVERIFIED",
  "SERVER_TO_API_HOST_ROUTING_UNRESOLVED",
  "INITIAL_INVITATION_BOOTSTRAP_UNRESOLVED",
  "CROSS_DEVICE_SESSION_REVOCATION_UNVERIFIED",
  "PHYSICAL_PHONE_E2E_NOT_RUN",
]);

const plain = v => v !== null && typeof v === "object" &&
  !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function asSingleHttpsOrigin(value) {
  if (typeof value !== "string" || !value || value.length > 256) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== value || url.username ||
        url.password || url.search || url.hash || url.pathname !== "/" ||
        url.port !== "") return null;
    const host = url.hostname.toLowerCase();
    // Never allow an IP literal, localhost, wildcard or a non-DNS name as
    // the candidate family origin. Private split-DNS names are still allowed.
    if (host === "localhost" || host.endsWith(".localhost") ||
        host === "0.0.0.0" || host === "::1" || host.includes(":") ||
        /^[0-9.]+$/.test(host) || host.startsWith(".") ||
        host.endsWith(".") || host.includes("*")) return null;
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host)) return null;
    if (host.split(".").some(label => label.startsWith("-") || label.endsWith("-"))) return null;
    return Object.freeze({ origin: url.origin, host });
  } catch { return null; }
}

function onlyThis(array, value) {
  return Array.isArray(array) && array.length === 1 && array[0] === value;
}

function check(errors, isValid, code) {
  if (!isValid) errors.push(code);
}

export function assessR94aLanDesign(plan) {
  const errors = [];
  if (!plain(plan)) {
    return Object.freeze({
      schema: R94A_SCHEMA,
      status: "REJECTED",
      errors: ["PLAN_NOT_OBJECT"],
      unresolved: UNRESOLVED,
      canInstall: false,
      canDeploy: false,
      physicalDeviceCertified: false,
    });
  }

  const origin = asSingleHttpsOrigin(plan.familyOrigin);
  check(errors, plan.schema === R94A_SCHEMA, "SCHEMA_MISMATCH");
  check(errors, plan.intent === "DESIGN_ONLY", "LIVE_EXECUTION_NOT_AUTHORIZED");
  check(errors, Boolean(origin), "PUBLIC_ORIGIN_NOT_EXACT_HTTPS_DNS");
  check(errors, onlyThis(plan.allowedHosts, origin?.host), "HOST_ALLOWLIST_NOT_EXACT");
  check(errors, onlyThis(plan.corsOrigins, origin?.origin), "CORS_ORIGINS_NOT_EXACT");
  check(errors, plan.webUpstream === LOOPBACK_WEB, "WEB_UPSTREAM_NOT_LOOPBACK");
  check(errors, plan.apiUpstream === LOOPBACK_API, "API_UPSTREAM_NOT_LOOPBACK");
  check(errors, plan.apiReachableFromLan === false, "DIRECT_API_LAN_ACCESS_FORBIDDEN");
  check(errors, plan.publicRegistration === false, "PUBLIC_REGISTRATION_FORBIDDEN");
  check(errors, plan.secureCookies === true, "SECURE_COOKIES_REQUIRED");
  check(errors, plan.mockAiOnly === true, "EXTERNAL_AI_NOT_AUTHORIZED");
  check(errors, plan.familyProfile === "family-pilot", "FAMILY_PILOT_REQUIRED");
  check(errors, plan.tlsTrust === "UNRESOLVED", "TLS_TRUST_CANNOT_BE_ASSERTED");
  check(errors, plan.privateDns === "UNRESOLVED", "DNS_CANNOT_BE_ASSERTED");
  check(errors, plan.apiHostRouting === "UNRESOLVED", "API_HOST_ROUTING_CANNOT_BE_ASSERTED");
  check(errors, plan.invitationBootstrap === "UNRESOLVED", "INVITATION_CANNOT_BE_ASSERTED");
  check(errors, plan.physicalPhoneTest === "NOT_RUN", "PHYSICAL_TEST_CANNOT_BE_ASSERTED");
  check(errors, plan.firewallState === "UNMODIFIED", "FIREWALL_CHANGE_NOT_AUTHORIZED");
  check(errors, plan.caInstallState === "NOT_INSTALLED", "CA_INSTALL_NOT_AUTHORIZED");
  check(errors, plan.listenerState === "NOT_STARTED", "LISTENER_START_NOT_AUTHORIZED");
  check(errors, plan.wanExposure === false, "WAN_EXPOSURE_FORBIDDEN");
  check(errors, Array.isArray(plan.mutationsApplied) && plan.mutationsApplied.length === 0,
        "INFRASTRUCTURE_MUTATION_NOT_AUTHORIZED");
  // The design file must contain a minimal, inspectable allowlist. Unknown
  // keys are rejected instead of silently passing potentially dangerous flags.
  const allowed = new Set([
    "schema", "intent", "familyOrigin", "allowedHosts", "corsOrigins",
    "webUpstream", "apiUpstream", "apiReachableFromLan",
    "publicRegistration", "secureCookies", "mockAiOnly", "familyProfile",
    "tlsTrust", "privateDns", "apiHostRouting", "invitationBootstrap",
    "physicalPhoneTest", "firewallState", "caInstallState", "listenerState",
    "wanExposure", "mutationsApplied",
  ]);
  for (const key of Object.keys(plan)) {
    if (!allowed.has(key)) errors.push("UNKNOWN_PLAN_FIELD");
  }

  return Object.freeze({
    schema: R94A_SCHEMA,
    status: errors.length === 0 ? "DESIGN_ONLY_VALID" : "REJECTED",
    errors: [...new Set(errors)],
    unresolved: UNRESOLVED,
    canInstall: false,
    canDeploy: false,
    physicalDeviceCertified: false,
  });
}

const invokedAsCli = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsCli) {
  const path = process.argv[2];
  let result;
  try {
    if (!path || process.argv.length !== 3) throw new Error("ARGUMENTS_INVALID");
    const file = readFileSync(path);
    if (file.length > 16384) throw new Error("PLAN_TOO_LARGE");
    const parsed = JSON.parse(file.toString("utf8"));
    result = assessR94aLanDesign(parsed);
  } catch {
    result = {
      schema: R94A_SCHEMA, status: "REJECTED",
      errors: ["FILE_OR_JSON_INVALID"], unresolved: UNRESOLVED,
      canInstall: false, canDeploy: false, physicalDeviceCertified: false,
    };
  }
  // Never display raw input, filenames, certificates, tokens or secrets.
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.status !== "DESIGN_ONLY_VALID") process.exitCode = 2;
}
