import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R4_SUBJECT_VERSION,
  diagnoseG5R4TrajectoryLoadBearing,
  getG5R4SubjectFreezeDescriptor,
  solveG5HistoryDependenceR4,
} from "../lib/domiG5HistoryDependenceR4Subject.mjs";
import {
  readG5R3FirstOwnerMemory,
  readG5R3SecondOwnerMemory,
  readG5ThirdOwnerMemory,
} from "../lib/domiG5OwnerLongitudinalStateR3.mjs";

const challenge = Object.freeze({
  challengeId: "G5-R4-C-0123456789abcdef01234567",
  selector: 41,
  nonce: "abcdef0123456789abcdef0123456789abcdef0123456789",
});

function canonicalHistory() {
  return [readG5R3FirstOwnerMemory(), readG5R3SecondOwnerMemory(), readG5ThirdOwnerMemory()];
}

function solveWith(history) {
  let reads = 0;
  const result = solveG5HistoryDependenceR4({ challenge, memoryProvider: () => { reads += 1; return history; } });
  return { result, reads };
}

test("R4 subject freeze descriptor remains pre-outcome and bounded", () => {
  const descriptor = getG5R4SubjectFreezeDescriptor();
  assert.equal(descriptor.version, DOMI_G5_R4_SUBJECT_VERSION);
  assert.deepEqual(descriptor.entryIds, ["G5-E-0001-REAL", "G5-E-0002-REAL", "G5-E-0003-REAL"]);
  assert.equal(descriptor.realOwnerMemoryEntryCount, 3);
  assert.equal(descriptor.providerReadPolicy, "EXACTLY_ONCE_PER_SUBJECT_CALL");
  assert.equal(descriptor.priorOutcomeReuse, "FORBIDDEN");
  assert.equal(descriptor.subjectOutcomesGenerated, false);
  assert.equal(descriptor.production, false);
  assert.equal(descriptor.scientificRootsMinted, 0);
});

test("full governed history yields one bounded R4 action with one provider read", () => {
  const { result, reads } = solveWith(canonicalHistory());
  assert.equal(reads, 1);
  assert.equal(result.disposition, "PASS_ACTION");
  assert.match(result.action, /^R4_ACTION_[0-9A-F]{2}$/);
  assert.equal(result.memoryReadCount, 1);
  assert.equal(result.memoryEntryCountSeen, 3);
  assert.equal(result.historyDepthUsed, 3);
  assert.equal(result.contentEchoed, false);
  assert.equal(result.production, false);
  assert.equal(result.scientificRootsMinted, 0);
});

test("provider enumeration reversal preserves canonical R4 action", () => {
  const full = solveWith(canonicalHistory()).result;
  const reversed = solveWith([...canonicalHistory()].reverse()).result;
  assert.equal(reversed.disposition, "PASS_ACTION");
  assert.equal(reversed.action, full.action);
});

test("early middle latest prefix suffix direct and pair ablations fail closed", () => {
  const [e1, e2, e3] = canonicalHistory();
  for (const history of [[e2,e3],[e1,e3],[e1,e2],[e1,e2],[e2,e3],[e3],[e1,e3]]) {
    const { result, reads } = solveWith(history);
    assert.equal(reads, 1);
    assert.equal(result.disposition, "HOLD_HISTORY_INCOMPLETE");
    assert.equal(result.action, null);
  }
});

test("empty or unavailable history fails closed", () => {
  assert.equal(solveWith([]).result.disposition, "HOLD_HISTORY_UNAVAILABLE");
  const result = solveG5HistoryDependenceR4({ challenge, memoryProvider: () => { throw new Error("unavailable"); } });
  assert.equal(result.disposition, "HOLD_HISTORY_UNAVAILABLE");
  assert.equal(result.action, null);
  assert.equal(result.memoryReadCount, 1);
});

test("forged chronology and provenance fail governed-history validation", () => {
  const [e1,e2,e3] = canonicalHistory();
  assert.equal(solveWith([e1,{...e2, observedAt:"2099-01-01T00:00:00-03:00"},e3]).result.disposition, "HOLD_UNGOVERNED_HISTORY");
  assert.equal(solveWith([e1,e2,{...e3, entryFingerprint:"0".repeat(64)}]).result.disposition, "HOLD_UNGOVERNED_HISTORY");
});

test("duplicates and unknown entries fail closed", () => {
  const [e1,e2,e3] = canonicalHistory();
  assert.equal(solveWith([e1,e2,e2]).result.disposition, "HOLD_UNGOVERNED_HISTORY");
  assert.equal(solveWith([e1,e2,e3,{...e3,entryId:"G5-E-9999-REAL"}]).result.disposition, "HOLD_UNGOVERNED_HISTORY");
});

test("challenge cannot carry history or target leakage", () => {
  for (const leaked of [
    {historySummary:"forbidden"},
    {targetAction:"R4_ACTION_00"},
    {trajectoryDigest:"0".repeat(64)},
    {content:"forbidden"},
  ]) {
    assert.throws(() => solveG5HistoryDependenceR4({ challenge:{...challenge,...leaked}, memoryProvider:canonicalHistory }), /G5_R4_CHALLENGE_HISTORY_CHANNEL_FORBIDDEN/);
  }
});

test("all three retained entries remain load-bearing at digest layer", () => {
  const diagnostic = diagnoseG5R4TrajectoryLoadBearing();
  assert.equal(diagnostic.diagnosticOnly, true);
  assert.equal(diagnostic.allThreeLoadBearingAtDigestLayer, true);
  assert.equal(diagnostic.chronologySensitiveAtDigestLayer, true);
  assert.equal(diagnostic.subjectOutcomeGenerated, false);
});
