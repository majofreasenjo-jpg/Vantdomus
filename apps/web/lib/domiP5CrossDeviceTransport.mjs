export const DOMI_P5_CROSS_DEVICE_TRANSPORT_VERSION = "DOMI_P5_CROSS_DEVICE_TRANSPORT_V0_1";

function toBase64Url(text) {
  let base64;
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(text, "utf8").toString("base64");
  } else {
    base64 = btoa(unescape(encodeURIComponent(text)));
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded) {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(padded)));
}

function assertReceiptSafeForUrl(receipt) {
  if (!receipt || typeof receipt !== "object") throw new Error("RECEIPT_REQUIRED");
  if (receipt.rawMemoryContentIncluded !== false) throw new Error("RAW_MEMORY_TRANSPORT_FORBIDDEN");
  if (receipt.rawTranscriptContentIncluded !== false) throw new Error("RAW_TRANSCRIPT_TRANSPORT_FORBIDDEN");
  if (receipt.fullStateCopied !== false) throw new Error("FULL_STATE_TRANSPORT_FORBIDDEN");
  if (receipt.providerAuthorityTransferred !== false) throw new Error("PROVIDER_AUTHORITY_TRANSFER_FORBIDDEN");
  if (receipt.authorityMayExpand !== false) throw new Error("AUTHORITY_EXPANSION_FORBIDDEN");
}

export function createCrossDeviceTransportEnvelope({ receipt, fixtureBaseTime }) {
  assertReceiptSafeForUrl(receipt);
  const base = new Date(fixtureBaseTime);
  if (Number.isNaN(base.getTime())) throw new Error("FIXTURE_BASE_TIME_INVALID");
  return Object.freeze({
    transportVersion: DOMI_P5_CROSS_DEVICE_TRANSPORT_VERSION,
    fixtureClass: "P5_SYNTHETIC_ATLAS_V0_1",
    fixtureBaseTime: base.toISOString(),
    receipt,
    transportContainsRawMemory: false,
    transportContainsRawTranscript: false,
    transportContainsFullState: false,
    transportIsAuthorityGrant: false,
  });
}

export function encodeCrossDeviceTransportEnvelope(envelope) {
  if (!envelope || envelope.transportVersion !== DOMI_P5_CROSS_DEVICE_TRANSPORT_VERSION) {
    throw new Error("TRANSPORT_VERSION_INVALID");
  }
  assertReceiptSafeForUrl(envelope.receipt);
  return toBase64Url(JSON.stringify(envelope));
}

export function decodeCrossDeviceTransportEnvelope(encoded) {
  if (typeof encoded !== "string" || encoded.trim() === "") throw new Error("TRANSPORT_PAYLOAD_REQUIRED");
  let parsed;
  try {
    parsed = JSON.parse(fromBase64Url(encoded.trim()));
  } catch {
    throw new Error("TRANSPORT_PAYLOAD_INVALID");
  }
  if (parsed.transportVersion !== DOMI_P5_CROSS_DEVICE_TRANSPORT_VERSION) throw new Error("TRANSPORT_VERSION_INVALID");
  if (parsed.fixtureClass !== "P5_SYNTHETIC_ATLAS_V0_1") throw new Error("TRANSPORT_FIXTURE_INVALID");
  if (parsed.transportContainsRawMemory !== false) throw new Error("RAW_MEMORY_TRANSPORT_FORBIDDEN");
  if (parsed.transportContainsRawTranscript !== false) throw new Error("RAW_TRANSCRIPT_TRANSPORT_FORBIDDEN");
  if (parsed.transportContainsFullState !== false) throw new Error("FULL_STATE_TRANSPORT_FORBIDDEN");
  if (parsed.transportIsAuthorityGrant !== false) throw new Error("AUTHORITY_EXPANSION_FORBIDDEN");
  assertReceiptSafeForUrl(parsed.receipt);
  return Object.freeze(parsed);
}
