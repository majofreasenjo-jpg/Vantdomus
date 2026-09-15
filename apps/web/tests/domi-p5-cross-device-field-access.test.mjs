import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCrossDeviceFieldHandoffUrl,
  extractVercelShareBridge,
  inspectCrossDeviceFieldAccess,
} from "../lib/domiP5CrossDeviceFieldAccess.mjs";

test("extracts Vercel temporary share bridge from protected preview URL", () => {
  assert.equal(
    extractVercelShareBridge("https://example.vercel.app/owner-alpha-cross-device?_vercel_share=AbCdEfGh1234"),
    "AbCdEfGh1234",
  );
});

test("field access is not ready on protected-preview style URL without explicit bridge", () => {
  const result = inspectCrossDeviceFieldAccess({
    currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
  });
  assert.equal(result.secureTransport, true);
  assert.equal(result.vercelShareBridgePresent, false);
  assert.equal(result.fieldAccessReady, false);
});

test("handoff URL preserves only the temporary access bridge plus fragment payload", () => {
  const url = buildCrossDeviceFieldHandoffUrl({
    currentUrl: "https://example.vercel.app/owner-alpha-cross-device?debug=1",
    encodedEnvelope: "PAYLOAD_123",
    explicitBridge: "AbCdEfGh1234",
  });
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.searchParams.get("_vercel_share"), "AbCdEfGh1234");
  assert.equal(parsed.searchParams.has("debug"), false);
  assert.equal(parsed.hash, "#handoff=PAYLOAD_123");
});

test("handoff URL fails closed when cross-device access bridge is missing", () => {
  assert.throws(
    () => buildCrossDeviceFieldHandoffUrl({
      currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
      encodedEnvelope: "PAYLOAD_123",
    }),
    /CROSS_DEVICE_FIELD_ACCESS_BRIDGE_REQUIRED/,
  );
});

test("handoff URL rejects insecure transport", () => {
  assert.throws(
    () => buildCrossDeviceFieldHandoffUrl({
      currentUrl: "http://example.test/owner-alpha-cross-device?_vercel_share=AbCdEfGh1234",
      encodedEnvelope: "PAYLOAD_123",
    }),
    /CROSS_DEVICE_HTTPS_REQUIRED/,
  );
});
