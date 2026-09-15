import test from "node:test";
import assert from "node:assert/strict";
import { buildP5SyntheticRoundTrip } from "../lib/domiP5FieldBetaRoundTrip.mjs";

test("P5 bounded synthetic round trip preserves expected continuity without raw transfer", () => {
  const result = buildP5SyntheticRoundTrip({
    baseTime: "2026-09-15T17:00:00.000Z",
    receiptTime: "2026-09-15T17:01:00.000Z",
    returnReceiptTime: "2026-09-15T17:02:00.000Z",
  });

  assert.equal(result.checks.forwardExpectedMemories, true);
  assert.equal(result.checks.returnExpectedMemories, true);
  assert.equal(result.checks.continuityKeyStable, true);
  assert.equal(result.checks.forwardRawMemoryTransported, false);
  assert.equal(result.checks.forwardRawTranscriptTransported, false);
  assert.equal(result.checks.returnRawMemoryTransported, false);
  assert.equal(result.checks.returnRawTranscriptTransported, false);
  assert.equal(result.checks.productionMutation, false);
  assert.equal(result.forwardReceipt.targetSurfaceClass, "PERSONAL_MOBILE");
  assert.equal(result.returnReceipt.targetSurfaceClass, "PERSONAL_DESKTOP");
});

test("P5 round trip uses distinct forward and return receipts", () => {
  const result = buildP5SyntheticRoundTrip({
    baseTime: "2026-09-15T18:00:00.000Z",
    receiptTime: "2026-09-15T18:01:00.000Z",
    returnReceiptTime: "2026-09-15T18:02:00.000Z",
  });
  assert.notEqual(result.forwardReceipt.receiptId, result.returnReceipt.receiptId);
  assert.notEqual(result.forwardReceipt.sourceSurfaceClass, result.returnReceipt.sourceSurfaceClass);
  assert.equal(result.forwardReceipt.continuityKey, result.returnReceipt.continuityKey);
});
