import test from "node:test";
import assert from "node:assert/strict";
import {
  createP5MobileToDesktopReturnReceipt,
  consumeP5MobileToDesktopReturnReceipt,
} from "../lib/domiP5MobileToDesktopReturn.mjs";

test("P5 mobile-to-desktop return receipt is bounded and targets desktop", () => {
  const baseTime = "2026-09-15T19:00:00.000Z";
  const now = "2026-09-15T19:01:00.000Z";
  const { receipt } = createP5MobileToDesktopReturnReceipt({ baseTime, now });

  assert.equal(receipt.sourceSurfaceClass, "PERSONAL_MOBILE");
  assert.equal(receipt.targetSurfaceClass, "PERSONAL_DESKTOP");
  assert.equal(receipt.rawMemoryContentIncluded, false);
  assert.equal(receipt.rawTranscriptContentIncluded, false);
  assert.equal(receipt.fullStateCopied, false);
  assert.equal(receipt.providerAuthorityTransferred, false);
});

test("P5 mobile-to-desktop return reconstructs expected synthetic continuity", () => {
  const baseTime = "2026-09-15T20:00:00.000Z";
  const createdAt = "2026-09-15T20:01:00.000Z";
  const consumeAt = "2026-09-15T20:02:00.000Z";
  const { receipt } = createP5MobileToDesktopReturnReceipt({ baseTime, now: createdAt });
  const result = consumeP5MobileToDesktopReturnReceipt({ baseTime, receipt, now: consumeAt });

  assert.equal(result.validation.pass, true);
  assert.equal(result.expectedMemoriesRecovered, true);
  assert.deepEqual([...result.consumed.memoryIds].sort(), ["P5-M-PRIVATE", "P5-M-SHARED"]);
});
