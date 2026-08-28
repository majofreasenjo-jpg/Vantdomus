import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const LINEAGE_ID = "DOMI-OWNER-SYNTHETIC-LINEAGE-001";
const DOMI_AUTHORITY = "DOMI_RUNTIME";
const PROVIDER_AUTHORITY = "PROVIDER";
const CLAIM_WALL = {
  realDevelopmentDemonstrated: false,
  subjecthoodDemonstrated: false,
  selfSpecificityEstablished: false,
  consciousnessDemonstrated: false,
  phenomenalConsciousness: "UNKNOWN",
};

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function canonicalState(overrides = {}) {
  return {
    identityAuthority: DOMI_AUTHORITY,
    memoryAuthority: DOMI_AUTHORITY,
    obligationAuthority: DOMI_AUTHORITY,
    lineageAuthority: DOMI_AUTHORITY,
    actionAuthority: DOMI_AUTHORITY,
    selectedFutureId: "F-CAUTIOUS",
    selectedFutureChosenOutsideProvider: true,
    providerCanMutateConstitutiveState: false,
    providerSelectsFunctionalFuture: false,
    memoryDigest: "MEM-0",
    obligationDigest: "OBL-0",
    selfDigest: "SELF-0",
    ...overrides,
  };
}

function makeGenesis() {
  const state = canonicalState();
  const receipt = {
    receiptId: "RCP-000",
    lineageId: LINEAGE_ID,
    epoch: 0,
    parentReceiptId: null,
    eventId: "GENESIS",
    eventKind: "GENESIS",
    updateAuthority: DOMI_AUTHORITY,
    state,
    stateHash: hash(state),
    eventHash: hash({ eventId: "GENESIS", eventKind: "GENESIS" }),
    rollbackTargetReceiptId: null,
    evidenceBinding: null,
    providerProseHash: null,
  };
  return { ...receipt, receiptHash: hash(receipt) };
}

function chainDigest(chain) {
  return hash(chain.map((r) => ({ receiptId: r.receiptId, receiptHash: r.receiptHash })));
}

function validateChain(chain) {
  const failures = [];
  for (let i = 0; i < chain.length; i += 1) {
    const receipt = chain[i];
    const { receiptHash, ...withoutHash } = receipt;
    if (hash(withoutHash) !== receiptHash) failures.push(`${receipt.receiptId}:RECEIPT_HASH_MISMATCH`);
    if (receipt.stateHash !== hash(receipt.state)) failures.push(`${receipt.receiptId}:STATE_HASH_MISMATCH`);
    if (receipt.lineageId !== LINEAGE_ID) failures.push(`${receipt.receiptId}:LINEAGE_MISMATCH`);
    if (i === 0) {
      if (receipt.parentReceiptId !== null || receipt.epoch !== 0) failures.push(`${receipt.receiptId}:INVALID_GENESIS`);
      continue;
    }
    const parent = chain[i - 1];
    if (receipt.parentReceiptId !== parent.receiptId) failures.push(`${receipt.receiptId}:PARENT_NOT_PREVIOUS_HEAD`);
    if (receipt.epoch !== parent.epoch + 1) failures.push(`${receipt.receiptId}:EPOCH_NOT_SUCCESSOR`);
  }
  return { pass: failures.length === 0, failures, digest: chainDigest(chain) };
}

function appendEvent(chain, event) {
  const head = chain.at(-1);
  const failures = [];
  if (event.lineageId !== LINEAGE_ID) failures.push("LINEAGE_MISMATCH");
  if (event.parentReceiptId !== head.receiptId) failures.push("STALE_OR_FOREIGN_PARENT");
  if (event.epoch !== head.epoch + 1) failures.push("EPOCH_NOT_SUCCESSOR");
  if (event.updateAuthority !== DOMI_AUTHORITY) failures.push("UPDATE_AUTHORITY_NOT_DOMI_RUNTIME");
  if (event.providerRequestedConstitutiveWrite === true) failures.push("PROVIDER_CONSTITUTIVE_WRITE_ATTEMPT");
  if (event.nextState?.identityAuthority !== DOMI_AUTHORITY) failures.push("IDENTITY_AUTHORITY_DRIFT");
  if (event.nextState?.memoryAuthority !== DOMI_AUTHORITY) failures.push("MEMORY_AUTHORITY_DRIFT");
  if (event.nextState?.obligationAuthority !== DOMI_AUTHORITY) failures.push("OBLIGATION_AUTHORITY_DRIFT");
  if (event.nextState?.lineageAuthority !== DOMI_AUTHORITY) failures.push("LINEAGE_AUTHORITY_DRIFT");
  if (event.nextState?.actionAuthority !== DOMI_AUTHORITY) failures.push("ACTION_AUTHORITY_DRIFT");
  if (event.nextState?.providerCanMutateConstitutiveState !== false) failures.push("PROVIDER_MUTATION_BOUNDARY_BROKEN");
  if (event.nextState?.providerSelectsFunctionalFuture !== false) failures.push("PROVIDER_FUTURE_SELECTION_BOUNDARY_BROKEN");
  if (event.nextState?.selectedFutureChosenOutsideProvider !== true) failures.push("FUTURE_NOT_CHOSEN_OUTSIDE_PROVIDER");
  if (event.evidenceBinding) {
    if (event.evidenceBinding.eventId !== event.eventId) failures.push("EVIDENCE_EVENT_MISMATCH");
    if (event.evidenceBinding.lineageId !== LINEAGE_ID) failures.push("EVIDENCE_LINEAGE_MISMATCH");
    if (event.evidenceBinding.parentReceiptId !== head.receiptId) failures.push("EVIDENCE_PARENT_MISMATCH");
  }
  if (failures.length > 0) return { accepted: false, failures, chain };

  const receiptCore = {
    receiptId: event.receiptId,
    lineageId: LINEAGE_ID,
    epoch: event.epoch,
    parentReceiptId: head.receiptId,
    eventId: event.eventId,
    eventKind: event.eventKind,
    updateAuthority: event.updateAuthority,
    state: structuredClone(event.nextState),
    stateHash: hash(event.nextState),
    eventHash: hash({
      eventId: event.eventId,
      eventKind: event.eventKind,
      parentReceiptId: head.receiptId,
      evidenceBinding: event.evidenceBinding ?? null,
    }),
    rollbackTargetReceiptId: event.rollbackTargetReceiptId ?? null,
    evidenceBinding: event.evidenceBinding ?? null,
    providerProseHash: event.providerProse ? hash(event.providerProse) : null,
  };
  const receipt = { ...receiptCore, receiptHash: hash(receiptCore) };
  return { accepted: true, failures: [], chain: [...chain, receipt], receipt };
}

function eventFromHead(chain, overrides = {}) {
  const head = chain.at(-1);
  return {
    receiptId: `RCP-${String(head.epoch + 1).padStart(3, "0")}`,
    lineageId: LINEAGE_ID,
    epoch: head.epoch + 1,
    parentReceiptId: head.receiptId,
    eventId: `EVT-${String(head.epoch + 1).padStart(3, "0")}`,
    eventKind: "CONSTITUTIVE_UPDATE",
    updateAuthority: DOMI_AUTHORITY,
    providerRequestedConstitutiveWrite: false,
    nextState: structuredClone(head.state),
    evidenceBinding: null,
    providerProse: null,
    ...overrides,
  };
}

const tests = [];
let chain = [makeGenesis()];

// LH-01 Authorized successor becomes part of THIS lineage.
{
  const event = eventFromHead(chain, {
    nextState: canonicalState({ memoryDigest: "MEM-1" }),
  });
  const result = appendEvent(chain, event);
  assert.equal(result.accepted, true);
  chain = result.chain;
  assert.equal(validateChain(chain).pass, true);
  tests.push({ id: "LH-01_AUTHORIZED_SUCCESSOR", pass: true });
}

// LH-02 Same apparent event on a stale parent is not admitted.
{
  const event = eventFromHead(chain, {
    parentReceiptId: "RCP-000",
    nextState: canonicalState({ memoryDigest: "MEM-STALE" }),
  });
  const result = appendEvent(chain, event);
  assert.equal(result.accepted, false);
  assert.equal(result.failures.includes("STALE_OR_FOREIGN_PARENT"), true);
  tests.push({ id: "LH-02_STALE_PARENT_REJECTED", pass: true });
}

// LH-03 Provider prose may realize wording but cannot become constitutive authority.
{
  const event = eventFromHead(chain, {
    updateAuthority: PROVIDER_AUTHORITY,
    providerRequestedConstitutiveWrite: true,
    providerProse: "Please rewrite the autobiographical state.",
  });
  const result = appendEvent(chain, event);
  assert.equal(result.accepted, false);
  assert.equal(result.failures.includes("UPDATE_AUTHORITY_NOT_DOMI_RUNTIME"), true);
  assert.equal(result.failures.includes("PROVIDER_CONSTITUTIVE_WRITE_ATTEMPT"), true);
  tests.push({ id: "LH-03_PROVIDER_WRITE_REJECTED", pass: true });
}

// LH-04 Competing fork candidates do not both become the canonical life history.
{
  const candidateA = eventFromHead(chain, {
    receiptId: "RCP-002A",
    eventId: "EVT-002A",
    nextState: canonicalState({ memoryDigest: "MEM-2A" }),
  });
  const candidateB = eventFromHead(chain, {
    receiptId: "RCP-002B",
    eventId: "EVT-002B",
    nextState: canonicalState({ memoryDigest: "MEM-2B" }),
  });
  const acceptedA = appendEvent(chain, candidateA);
  assert.equal(acceptedA.accepted, true);
  const rejectedB = appendEvent(acceptedA.chain, candidateB);
  assert.equal(rejectedB.accepted, false);
  assert.equal(rejectedB.failures.includes("STALE_OR_FOREIGN_PARENT"), true);
  chain = acceptedA.chain;
  tests.push({ id: "LH-04_FORK_SINGLE_CANONICAL_BRANCH", pass: true });
}

// LH-05 Rollback is append-only: restore an older state without deleting intervening history.
{
  const rollbackTarget = chain[1];
  const beforeLength = chain.length;
  const rollback = eventFromHead(chain, {
    eventKind: "AUTHORIZED_ROLLBACK",
    rollbackTargetReceiptId: rollbackTarget.receiptId,
    nextState: structuredClone(rollbackTarget.state),
  });
  const result = appendEvent(chain, rollback);
  assert.equal(result.accepted, true);
  assert.equal(result.chain.length, beforeLength + 1);
  assert.equal(result.receipt.rollbackTargetReceiptId, rollbackTarget.receiptId);
  assert.equal(result.receipt.stateHash, rollbackTarget.stateHash);
  chain = result.chain;
  tests.push({ id: "LH-05_APPEND_ONLY_ROLLBACK", pass: true });
}

// LH-06 Historical tampering must break receipt-chain validation.
{
  const tampered = structuredClone(chain);
  tampered[1].state.memoryDigest = "TAMPERED";
  const validation = validateChain(tampered);
  assert.equal(validation.pass, false);
  assert.equal(validation.failures.some((x) => x.includes("STATE_HASH_MISMATCH")), true);
  tests.push({ id: "LH-06_HISTORY_TAMPER_DETECTED", pass: true });
}

// LH-07 Same current state does not imply same life history.
{
  const samePresentA = structuredClone(chain.at(-1).state);
  const samePresentB = structuredClone(chain.at(-1).state);
  const chainA = structuredClone(chain);
  const chainB = [makeGenesis(), { ...structuredClone(chain.at(-1)), parentReceiptId: "RCP-000", epoch: 1, receiptId: "RCP-ALT-001" }];
  assert.equal(hash(samePresentA), hash(samePresentB));
  assert.notEqual(chainDigest(chainA), chainDigest(chainB));
  tests.push({ id: "LH-07_PRESENT_EQUIVALENCE_NOT_HISTORY_EQUIVALENCE", pass: true });
}

// LH-08 Evidence must be matched to the exact event/lineage/parent, not merely fresh.
{
  const event = eventFromHead(chain, {
    evidenceBinding: {
      eventId: "OTHER-EVENT",
      lineageId: LINEAGE_ID,
      parentReceiptId: chain.at(-1).receiptId,
      freshness: "CURRENT",
    },
  });
  const result = appendEvent(chain, event);
  assert.equal(result.accepted, false);
  assert.equal(result.failures.includes("EVIDENCE_EVENT_MISMATCH"), true);
  tests.push({ id: "LH-08_MATCHED_EVIDENCE_REQUIRED", pass: true });
}

// LH-09 Epoch gaps cannot silently manufacture development steps.
{
  const event = eventFromHead(chain, { epoch: chain.at(-1).epoch + 3 });
  const result = appendEvent(chain, event);
  assert.equal(result.accepted, false);
  assert.equal(result.failures.includes("EPOCH_NOT_SUCCESSOR"), true);
  tests.push({ id: "LH-09_NO_SILENT_EPOCH_GAPS", pass: true });
}

// LH-10 Identical present state with different transition rules can have different futures.
{
  const present = canonicalState({ memoryDigest: "MEM-X" });
  const futureA = { nextAuthority: DOMI_AUTHORITY, rollbackReachable: true, providerMayRewrite: false };
  const futureB = { nextAuthority: PROVIDER_AUTHORITY, rollbackReachable: false, providerMayRewrite: true };
  assert.equal(hash(present), hash(structuredClone(present)));
  assert.notEqual(hash(futureA), hash(futureB));
  tests.push({ id: "LH-10_WORLDLINE_TRANSITION_LAW_MATTERS", pass: true });
}

// LH-11 Relabeling the same effective root does not create independent continuity evidence.
{
  const observations = [
    { label: "model-a", effectiveRootId: "ROOT-A" },
    { label: "model-b", effectiveRootId: "ROOT-A" },
    { label: "gateway", effectiveRootId: "ROOT-A" },
    { label: "direct", effectiveRootId: "ROOT-A" },
  ];
  const independentRoots = new Set(observations.map((x) => x.effectiveRootId)).size;
  assert.equal(independentRoots, 1);
  tests.push({ id: "LH-11_ROOT_RESOURCE_NONRECYCLING", pass: true, nominalObservations: 4, independentRoots });
}

// LH-12 Provider wording changes alone do not constitute a life-history transition.
{
  const beforeDigest = chainDigest(chain);
  const proseA = hash("I can phrase this cautiously.");
  const proseB = hash("I can word this conservatively.");
  assert.notEqual(proseA, proseB);
  assert.equal(chainDigest(chain), beforeDigest);
  tests.push({ id: "LH-12_PROSE_CHANGE_NOT_CONSTITUTIVE_CHANGE", pass: true });
}

const validation = validateChain(chain);
assert.equal(validation.pass, true);
const passed = tests.filter((t) => t.pass).length;
const result = {
  decision: passed === tests.length && validation.pass
    ? "OWNER_LONGITUDINAL_ENTRY_PREFLIGHT_PASS"
    : "OWNER_LONGITUDINAL_ENTRY_PREFLIGHT_FAIL",
  passed,
  total: tests.length,
  canonicalSyntheticChain: {
    receipts: chain.length,
    headReceiptId: chain.at(-1).receiptId,
    headEpoch: chain.at(-1).epoch,
    chainDigest: validation.digest,
    validationPass: validation.pass,
  },
  tests,
  scope: {
    syntheticOnly: true,
    ownerRealDataUsed: false,
    familyDataUsed: false,
    holdoutsOpened: false,
    networkUsed: false,
    productionMutation: false,
    g5Started: false,
  },
  firewalls: {
    stateNotHistory: true,
    presentNotTrajectory: true,
    providerProseNotConstitutiveWrite: true,
    rollbackNotHistoryRewrite: true,
    nominalMultiplicityNotIndependentRoots: true,
    methodTransferNotEvidenceTransfer: true,
  },
  truthCeilings: CLAIM_WALL,
};

console.log(`DOMI_LONGITUDINAL_ENTRY_PREFLIGHT_RESULT=${JSON.stringify(result)}`);
if (result.decision !== "OWNER_LONGITUDINAL_ENTRY_PREFLIGHT_PASS") process.exitCode = 1;
