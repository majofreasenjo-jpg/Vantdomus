/**
 * R84 synthetic-only manual transfer.
 *
 * This file intentionally has no network, authentication or cloud code.
 * The owner must explicitly attest that data is fictitious before file export/import.
 * It is NOT cross-device synchronisation or real-family persistence.
 */
import { LOCAL_PILOT_LIMIT, LOCAL_PILOT_SCHEMA, restorePilot } from "./domiLocalFamilyPilot.mjs";

export const SYNTHETIC_TRANSFER_FORMAT = "domi-manual-fictional-pilot-transfer-v1";

function fail() {
  throw new Error("INVALID_SYNTHETIC_TRANSFER");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const plain = Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
    if (!plain) fail();
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function validateSyntheticState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) fail();
  if (candidate.schema !== LOCAL_PILOT_SCHEMA || candidate.mode !== "synthetic_only") fail();
  const original = JSON.stringify(candidate);
  if (!original || new TextEncoder().encode(original).length > LOCAL_PILOT_LIMIT) fail();
  const cleaned = restorePilot(original);
  // A transfer must be lossless. Never silently drop rogue properties,
  // real-memory fields, invalid events, unsupported versions or over-limit rows.
  if (JSON.stringify(canonical(candidate)) !== JSON.stringify(canonical(cleaned))) fail();
  for (const collection of ["members", "events", "groceries", "recipes"]) {
    const ids = cleaned[collection].map(row => row.id);
    if (new Set(ids).size !== ids.length) fail();
  }
  return cleaned;
}

export function encodeSyntheticTransfer(state) {
  const payload = validateSyntheticState(state);
  const raw = JSON.stringify({
    format: SYNTHETIC_TRANSFER_FORMAT,
    schema: LOCAL_PILOT_SCHEMA,
    payload,
  });
  if (new TextEncoder().encode(raw).length > LOCAL_PILOT_LIMIT) fail();
  return raw;
}

export function decodeSyntheticTransfer(raw) {
  if (typeof raw !== "string" ||
      new TextEncoder().encode(raw).length > LOCAL_PILOT_LIMIT) fail();
  let envelope;
  try { envelope = JSON.parse(raw); } catch { fail(); }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
      Object.keys(envelope).sort().join("|") !== "format|payload|schema" ||
      envelope.format !== SYNTHETIC_TRANSFER_FORMAT ||
      envelope.schema !== LOCAL_PILOT_SCHEMA) fail();
  return validateSyntheticState(envelope.payload);
}
