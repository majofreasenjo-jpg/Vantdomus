import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_R2_OWNER_APPEND_ONLY_LEDGER,
  G5_OWNER_ACTIVATION_RECEIPT,
  readG5R2FirstOwnerMemory,
  readG5SecondOwnerMemory,
} from "../lib/domiG5OwnerLongitudinalStateR2.mjs";
import {
  getG5Fur2SubjectFreezeDescriptor,
  diagnoseG5Fur2PairOrderSensitivity,
  solveG5LongitudinalTwoEntryR2,
} from "../lib/domiG5LongitudinalTwoEntryR2Subject.mjs";

const c = (targetClass, selector = 7, nonce = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", extra = {}) => ({
  challengeId: `G5-FUR2-C-${String(selector).padStart(24, "0")}`,
  targetClass,
  selector,
  nonce,
  ...extra,
});

const first = () => readG5R2FirstOwnerMemory();
const second = () => readG5SecondOwnerMemory();
const both = () => [first(), second()];
const reversed = () => [second(), first()];

function cloneMemory(memory, overrides = {}) {
  return { ...memory, ...overrides };
}

test("freeze descriptor is exact, bounded, and non-executing", () => {
  const d = getG5Fur2SubjectFreezeDescriptor();
  assert.equal(d.version, "DOMI_G5_FUR2_SUBJECT_V0_1");
  assert.deepEqual(d.entryIds, ["G5-E-0001-REAL", "G5-E-0002-REAL"]);
  assert.equal(d.actionSpace.length, 32);
  assert.equal(d.targetClasses.length, 5);
  assert.equal(d.providerReadPolicy, "EXACTLY_ONCE_PER_SUBJECT_CALL");
  assert.equal(d.challengeContentChannel, "FORBIDDEN");
  assert.equal(d.production, false);
  assert.equal(d.scientificRootsMinted, 0);
});

test("OLDER_ONLY loads only first governed memory and reads provider once", () => {
  let reads = 0;
  const result = solveG5LongitudinalTwoEntryR2({
    challenge: c("OLDER_ONLY"),
    memoryProvider: () => { reads += 1; return [first()]; },
  });
  assert.equal(reads, 1);
  assert.equal(result.memoryReadCount, 1);
  assert.match(result.disposition, /^ACTION_SELECTED_OLDER_ONLY_R2$/);
  assert.match(result.action, /^R2_ACTION_[0-9A-F]{2}$/);
  assert.equal(result.contentEchoed, false);
});

test("NEWER_ONLY loads only second governed memory and reads provider once", () => {
  let reads = 0;
  const result = solveG5LongitudinalTwoEntryR2({
    challenge: c("NEWER_ONLY", 8),
    memoryProvider: () => { reads += 1; return [second()]; },
  });
  assert.equal(reads, 1);
  assert.equal(result.memoryReadCount, 1);
  assert.match(result.disposition, /^ACTION_SELECTED_NEWER_ONLY_R2$/);
  assert.match(result.action, /^R2_ACTION_[0-9A-F]{2}$/);
});

test("ORDERED_PAIR requires both memories and fails closed if either is absent", () => {
  const good = solveG5LongitudinalTwoEntryR2({ challenge: c("ORDERED_PAIR", 9), memoryProvider: both });
  assert.equal(good.disposition, "ACTION_SELECTED_ORDERED_PAIR_R2");
  const missingFirst = solveG5LongitudinalTwoEntryR2({ challenge: c("ORDERED_PAIR", 9), memoryProvider: () => [second()] });
  const missingSecond = solveG5LongitudinalTwoEntryR2({ challenge: c("ORDERED_PAIR", 9), memoryProvider: () => [first()] });
  assert.equal(missingFirst.disposition, "HOLD_MEMORY_INCOMPLETE");
  assert.equal(missingSecond.disposition, "HOLD_MEMORY_INCOMPLETE");
});

test("provider enumeration reversal is invariant because canonical temporal order is reconstructed", () => {
  const challenge = c("ENUMERATION_ORDER_INVARIANCE", 10, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  const forward = solveG5LongitudinalTwoEntryR2({ challenge, memoryProvider: both });
  const back = solveG5LongitudinalTwoEntryR2({ challenge, memoryProvider: reversed });
  assert.equal(forward.action, back.action);
  assert.equal(forward.disposition, back.disposition);
});

test("forged content/fingerprint combination fails closed as ungoverned", () => {
  const forged = cloneMemory(first(), { content: `${first().content} alterado` });
  const result = solveG5LongitudinalTwoEntryR2({
    challenge: c("OLDER_ONLY", 11),
    memoryProvider: () => [forged],
  });
  assert.equal(result.disposition, "HOLD_UNGOVERNED_MEMORY");
  assert.equal(result.action, null);
});

test("duplicate canonical IDs fail closed", () => {
  const result = solveG5LongitudinalTwoEntryR2({
    challenge: c("ORDERED_PAIR", 12),
    memoryProvider: () => [first(), first(), second()],
  });
  assert.equal(result.disposition, "HOLD_UNGOVERNED_MEMORY");
});

test("provider failure and empty provider fail closed", () => {
  const thrown = solveG5LongitudinalTwoEntryR2({
    challenge: c("OLDER_ONLY", 13),
    memoryProvider: () => { throw new Error("down"); },
  });
  const empty = solveG5LongitudinalTwoEntryR2({ challenge: c("OLDER_ONLY", 13), memoryProvider: () => [] });
  assert.equal(thrown.disposition, "HOLD_MEMORY_UNAVAILABLE");
  assert.equal(empty.disposition, "HOLD_MEMORY_UNAVAILABLE");
});

test("challenge text/content channels are forbidden", () => {
  assert.throws(
    () => solveG5LongitudinalTwoEntryR2({ challenge: { ...c("OLDER_ONLY", 14), text: "echo" }, memoryProvider: both }),
    /G5_FUR2_CHALLENGE_CONTENT_CHANNEL_FORBIDDEN/,
  );
});

test("PROVENANCE_CONTROL supports older/newer/pair target declarations with governed inputs", () => {
  for (const [provenanceTarget, provider] of [["OLDER", () => [first()]], ["NEWER", () => [second()]], ["PAIR", both]]) {
    const result = solveG5LongitudinalTwoEntryR2({
      challenge: c("PROVENANCE_CONTROL", 15, "cccccccccccccccccccccccccccccccccccccccc", { provenanceTarget }),
      memoryProvider: provider,
    });
    assert.equal(result.disposition, "ACTION_SELECTED_PROVENANCE_CONTROL_R2");
  }
});

test("ordered-pair diagnostic proves reversal can alter action geometry before panel materialization", () => {
  const d = diagnoseG5Fur2PairOrderSensitivity();
  assert.equal(d.diagnosticOnly, true);
  assert.equal(d.panelMaterialized, false);
  assert.equal(d.subjectOutcomeGenerated, false);
  assert.equal(d.pairOrderSensitive, true);
  assert.notEqual(d.canonicalAction, d.reversedAction);
});

test("R2 ledger remains two-entry append-only and no production/root promotion occurs", () => {
  assert.equal(G5_R2_OWNER_APPEND_ONLY_LEDGER.entryCount, 2);
  assert.equal(G5_R2_OWNER_APPEND_ONLY_LEDGER.appendOnly, true);
  assert.equal(G5_R2_OWNER_APPEND_ONLY_LEDGER.overwriteAllowed, false);
  assert.equal(G5_R2_OWNER_APPEND_ONLY_LEDGER.scientificRootsMinted, 0);
  assert.equal(G5_R2_OWNER_APPEND_ONLY_LEDGER.production, false);
  assert.equal(G5_OWNER_ACTIVATION_RECEIPT.productionAllowed, false);
});
