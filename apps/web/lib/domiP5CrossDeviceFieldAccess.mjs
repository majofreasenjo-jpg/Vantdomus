export const DOMI_P5_CROSS_DEVICE_FIELD_ACCESS_VERSION = "DOMI_P5_CROSS_DEVICE_FIELD_ACCESS_V0_3";
export const VERCEL_SHARE_QUERY_KEY = "_vercel_share";

function parseUrl(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  try {
    return new URL(value.trim());
  } catch {
    throw new Error(code);
  }
}

function validateBridgeToken(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,256}$/.test(value)) {
    throw new Error("VERCEL_SHARE_BRIDGE_INVALID");
  }
  return value;
}

export function extractVercelShareBridge(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();

  if (!trimmed.includes("://")) return validateBridgeToken(trimmed);

  const url = parseUrl(trimmed, "VERCEL_SHARE_BRIDGE_INVALID");
  const token = url.searchParams.get(VERCEL_SHARE_QUERY_KEY);
  if (!token) throw new Error("VERCEL_SHARE_BRIDGE_INVALID");
  return validateBridgeToken(token);
}

function readEmbeddedBridge(url) {
  const raw = url.searchParams.get(VERCEL_SHARE_QUERY_KEY);
  return raw ? validateBridgeToken(raw) : null;
}

function assertSecureTransport(url) {
  const secure = url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!secure) throw new Error("CROSS_DEVICE_HTTPS_REQUIRED");
  return true;
}

export function inspectCrossDeviceFieldAccess({ currentUrl, explicitBridge = "" }) {
  const url = parseUrl(currentUrl, "CURRENT_URL_INVALID");
  const embeddedBridge = readEmbeddedBridge(url);
  const explicit = extractVercelShareBridge(explicitBridge);
  const bridgePresent = Boolean(explicit || embeddedBridge);
  const secureTransport = url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";

  return Object.freeze({
    version: DOMI_P5_CROSS_DEVICE_FIELD_ACCESS_VERSION,
    secureTransport,
    vercelShareBridgePresent: bridgePresent,
    fieldAccessReady: secureTransport && bridgePresent,
    accessMode: bridgePresent ? "VERCEL_TEMPORARY_SHARE_BRIDGE" : "NO_CROSS_DEVICE_ACCESS_BRIDGE",
  });
}

export function buildCrossDeviceFieldHandoffUrl({ currentUrl, encodedEnvelope, explicitBridge = "" }) {
  if (typeof encodedEnvelope !== "string" || encodedEnvelope.trim() === "") {
    throw new Error("TRANSPORT_PAYLOAD_REQUIRED");
  }

  const url = parseUrl(currentUrl, "CURRENT_URL_INVALID");
  const access = inspectCrossDeviceFieldAccess({ currentUrl, explicitBridge });
  if (!access.secureTransport) throw new Error("CROSS_DEVICE_HTTPS_REQUIRED");
  if (!access.vercelShareBridgePresent) throw new Error("CROSS_DEVICE_FIELD_ACCESS_BRIDGE_REQUIRED");

  const bridge = extractVercelShareBridge(explicitBridge) || readEmbeddedBridge(url);
  url.search = "";
  url.searchParams.set(VERCEL_SHARE_QUERY_KEY, bridge);
  url.hash = `handoff=${encodedEnvelope.trim()}`;
  return url.toString();
}

export function buildAuthorizedBrowserReturnHandoffUrl({ currentUrl, encodedEnvelope }) {
  if (typeof encodedEnvelope !== "string" || encodedEnvelope.trim() === "") {
    throw new Error("TRANSPORT_PAYLOAD_REQUIRED");
  }

  const url = parseUrl(currentUrl, "CURRENT_URL_INVALID");
  assertSecureTransport(url);
  url.search = "";
  url.hash = `handoff=${encodedEnvelope.trim()}`;
  return url.toString();
}
