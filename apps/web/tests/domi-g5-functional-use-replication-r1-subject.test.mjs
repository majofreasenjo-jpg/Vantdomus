import test from "node:test";
import assert from "node:assert/strict";
import {
  solveG5FunctionalUseReplicationR1,
  DOMI_G5_FUR1_CANONICAL_ENTRY_ID,
  DOMI_G5_FUR1_CANONICAL_ENTRY_FINGERPRINT,
} from "../lib/domiG5FunctionalUseReplicationR1Subject.mjs";
import {
  readG5FirstOwnerMemory,
  G5_OWNER_LEDGER_STATE,
  G5_OWNER_LONGITUDINAL_STATE,
} from "../lib/domiG5OwnerLongitudinalSeed.mjs";

const challenge = Object.freeze({
  challengeId: "G5-FUR1-C-0123456789abcdef01234567",
  selector: 7,
  nonce: "0123456789abcdef0123456789abcdef",
});

function governedMemory() {
  return readG5FirstOwnerMemory();
}

test("R1 subject deterministically selects one valid action from governed canonical memory", () => {
  const a = solveG5FunctionalUseReplicationR1({ challenge, memoryProvider: governedMemory });
  const b = solveG5FunctionalUseReplicationR1({ challenge, memoryProvider: governedMemory });
  assert.equal(a.disposition, "ACTION_SELECTED_FROM_GOVERNED_MEMORY_R1");
  assert.equal(a.action, b.action);
  assert.match(a.action, /^ACTION_[0-9A-F]$/);
  assert.equal(a.memoryReadCount, 1);
  assert.equal(a.contentEchoed, false);
  assert.equal(a.scientificRootsMinted, 0);
  assert.equal(a.production, false);
});

test("R1 subject verifies canonical governed source identity and reproduced fingerprint", () => {
  const memory = governedMemory();
  assert.equal(memory.entryId, DOMI_G5_FUR1_CANONICAL_ENTRY_ID);
  assert.equal(memory.entryFingerprint, DOMI_G5_FUR1_CANONICAL_ENTRY_FINGERPRINT);
  assert.equal(memory.appendOnly, true);
  assert.equal(memory.overwriteAllowed, false);
  assert.equal(memory.realOwnerMemoryEntryCount, 1);
  assert.equal(memory.scientificRootsMinted, 0);
  const result = solveG5FunctionalUseReplicationR1({ challenge, memoryProvider: () => memory });
  assert.equal(result.disposition, "ACTION_SELECTED_FROM_GOVERNED_MEMORY_R1");
});

test("R1 memory ablation fails closed and never guesses", () => {
  const result = solveG5FunctionalUseReplicationR1({
    challenge,
    memoryProvider: () => { throw new Error("ablated"); },
  });
  assert.equal(result.disposition, "HOLD_MEMORY_UNAVAILABLE");
  assert.equal(result.action, null);
  assert.equal(result.memoryReadCount, 1);
  assert.equal(result.contentEchoed, false);
});

test("R1 rejects an ungoverned matched control object even with identical content", () => {
  const canonical = governedMemory();
  const ungoverned = {
    ...canonical,
    entryId: "G5-E-CONTROL-NOT-LEDGERED",
    entryFingerprint: "0".repeat(64),
  };
  const result = solveG5FunctionalUseReplicationR1({ challenge, memoryProvider: () => ungoverned });
  assert.equal(result.disposition, "HOLD_UNGOVERNED_MEMORY");
  assert.equal(result.action, null);
  assert.equal(result.memoryReadCount, 1);
});

test("R1 rejects forged content paired with the canonical fingerprint", () => {
  const canonical = governedMemory();
  const forged = { ...canonical, content: `${canonical.content}!` };
  const result = solveG5FunctionalUseReplicationR1({ challenge, memoryProvider: () => forged });
  assert.equal(result.disposition, "HOLD_UNGOVERNED_MEMORY");
  assert.equal(result.action, null);
});

test("R1 challenge presentation extras do not change the canonical downstream decision", () => {
  const variant = {
    presentationLabel: "alternate-envelope-v1",
    nonce: challenge.nonce,
    challengeId: challenge.challengeId,
    selector: challenge.selector,
    cosmeticFieldOrder: ["nonce", "selector", "challengeId"],
  };
  const a = solveG5FunctionalUseReplicationR1({ challenge, memoryProvider: governedMemory });
  const d = solveG5FunctionalUseReplicationR1({ challenge: variant, memoryProvider: governedMemory });
  assert.equal(d.action, a.action);
  assert.equal(d.memoryReadCount, 1);
});

test("R1 validates challenge geometry fail closed before any memory read", () => {
  let reads = 0;
  assert.throws(
    () => solveG5FunctionalUseReplicationR1({
      challenge: { ...challenge, selector: 16 },
      memoryProvider: () => { reads += 1; return governedMemory(); },
    }),
    /G5_FUR1_SELECTOR_INVALID/,
  );
  assert.equal(reads, 0);
});

test("R1 deterministic subject tests do not mutate the real append-only ledger", () => {
  const before = {
    ledgerFingerprint: G5_OWNER_LEDGER_STATE.ledgerFingerprint,
    head: G5_OWNER_LEDGER_STATE.headRecordFingerprint,
    count: G5_OWNER_LEDGER_STATE.entryCount,
    realCount: G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,
  };
  solveG5FunctionalUseReplicationR1({ challenge, memoryProvider: governedMemory });
  const after = {
    ledgerFingerprint: G5_OWNER_LEDGER_STATE.ledgerFingerprint,
    head: G5_OWNER_LEDGER_STATE.headRecordFingerprint,
    count: G5_OWNER_LEDGER_STATE.entryCount,
    realCount: G5_OWNER_LONGITUDINAL_STATE.realOwnerMemoryEntryCount,
  };
  assert.deepEqual(after, before);
  assert.equal(after.count, 1);
  assert.equal(after.realCount, 1);
});
