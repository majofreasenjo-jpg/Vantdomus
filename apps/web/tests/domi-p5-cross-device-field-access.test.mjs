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

test("extracts explicit raw Vercel share bridge token", () => {
  assert.equal(extractVercelShareBridge("AbCdEfGh1234"), "AbCdEfGh1234");
});

test("field access is not ready on protected-preview style URL without explicit bridge", () => {
  const result = inspectCrossDeviceFieldAccess({
    currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
  });
  assert.equal(result.secureTransport, true);
  assert.equal(result.vercelShareBridgePresent, false);
  assert.equal(result.fieldAccessReady, false);
});

test("field access becomes ready from explicit full temporary Vercel URL after upstream query consumption", () => {
  const result = inspectCrossDeviceFieldAccess({
    currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
    explicitBridge: "https://example.vercel.app/owner-alpha-cross-device?_vercel_share=AbCdEfGh1234",
  });
  assert.equal(result.secureTransport, true);
  assert.equal(result.vercelShareBridgePresent, true);
  assert.equal(result.fieldAccessReady, true);
  assert.equal(result.accessMode, "VERCEL_TEMPORARY_SHARE_BRIDGE");
});

test("field access becomes ready from explicit raw token", () => {
  const result = inspectCrossDeviceFieldAccess({
    currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
    explicitBridge: "AbCdEfGh1234",
  });
  assert.equal(result.fieldAccessReady, true);
});

test("handoff URL preserves only the temporary access bridge plus fragment payload", () => {
  const url = buildCrossDeviceFieldHandoffUrl({
    currentUrl: "https://example.vercel.app/owner-alpha-cross-device?debug=1&other=2",
    encodedEnvelope: "PAYLOAD_123",
    explicitBridge: "AbCdEfGh1234",
  });
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.searchParams.get("_vercel_share"), "AbCdEfGh1234");
  assert.equal(parsed.searchParams.has("debug"), false);
  assert.equal(parsed.searchParams.has("other"), false);
  assert.equal(Array.from(parsed.searchParams.keys()).length, 1);
  assert.equal(parsed.hash, "#handoff=PAYLOAD_123");
});

test("handoff URL can recover bridge from explicit full Vercel URL when current URL no longer contains it", () => {
  const url = buildCrossDeviceFieldHandoffUrl({
    currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
    encodedEnvelope: "PAYLOAD_456",
    explicitBridge: "https://example.vercel.app/owner-alpha-cross-device?_vercel_share=AbCdEfGh1234&ignored=1",
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("_vercel_share"), "AbCdEfGh1234");
  assert.equal(parsed.searchParams.has("ignored"), false);
  assert.equal(parsed.hash, "#handoff=PAYLOAD_456");
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

test("explicit malformed bridge fails closed", () => {
  assert.throws(
    () => inspectCrossDeviceFieldAccess({
      currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
      explicitBridge: "bad token with spaces",
    }),
    /VERCEL_SHARE_BRIDGE_INVALID/,
  );
});

test("explicit Vercel URL without share bridge fails closed", () => {
  assert.throws(
    () => inspectCrossDeviceFieldAccess({
      currentUrl: "https://example.vercel.app/owner-alpha-cross-device",
      explicitBridge: "https://example.vercel.app/owner-alpha-cross-device?foo=bar",
    }),
    /VERCEL_SHARE_BRIDGE_INVALID/,
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
