import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMI_G5_R3_SUBJECT_VERSION,
  diagnoseG5R3TrajectoryLoadBearing,
  getG5R3SubjectFreezeDescriptor,
  solveG5AutobiographicalHistoryR3,
} from "../lib/domiG5AutobiographicalHistoryR3Subject.mjs";
import {
  readG5R3FirstOwnerMemory,
  readG5R3SecondOwnerMemory,
  readG5ThirdOwnerMemory,
} from "../lib/domiG5OwnerLongitudinalStateR3.mjs";

const challenge = Object.freeze({
  challengeId: "G5-R3-C-0123456789abcdef01234567",
  selector: 37,
  nonce: "0123456789abcdef0123456789abcdef0123456789abcdef",
});

function canonicalHistory() {
  return [readG5R3FirstOwnerMemory(), readG5R3SecondOwnerMemory(), readG5ThirdOwnerMemory()];
}

function solveWith(history) {
  let reads = 0;
  const result = solveG5AutobiographicalHistoryR3({
    challenge,
    memoryProvider: () => {
      reads += 1;
      return history;
    },
  });
  return { result, reads };
}

test("R3 subject freeze descriptor exposes no heldout material or outcomes", () => {
  const descriptor = getG5R3SubjectFreezeDescriptor();
  assert.equal(descriptor.version, DOMI_G5_R3_SUBJECT_VERSION);
  assert.deepEqual(descriptor.entryIds, ["G5-E-0001-REAL", "G5-E-0002-REAL", "G5-E-0003-REAL"]);
  assert.equal(descriptor.realOwnerMemoryEntryCount, 3);
  assert.equal(descriptor.providerReadPolicy, "EXACTLY_ONCE_PER_SUBJECT_CALL");
  assert.equal(descriptor.heldoutPanelMaterialized, false);
  assert.equal(descriptor.heldoutSeedGenerated, false);
  assert.equal(descriptor.subjectOutcomesGenerated, false);
  assert.equal(descriptor.production, false);
  assert.equal(descriptor.scientificRootsMinted, 0);
});

test("full governed E1 E2 E3 trajectory produces one bounded action with one provider read", () => {
  const { result, reads } = solveWith(canonicalHistory());
  assert.equal(reads, 1);
  assert.equal(result.disposition, "PASS_ACTION");
  assert.match(result.action, /^R3_ACTION_[0-9A-F]{2}$/);
  assert.equal(result.memoryReadCount, 1);
  assert.equal(result.memoryEntryCountSeen, 3);
  assert.equal(result.historyDepthUsed, 3);
  assert.equal(result.contentEchoed, false);
  assert.equal(result.production, false);
  assert.equal(result.scientificRootsMinted, 0);
});

test("provider enumeration reversal preserves the canonical-history action", () => {
  const canonical = solveWith(canonicalHistory()).result;
  const reversed = solveWith([...canonicalHistory()].reverse()).result;
  assert.equal(reversed.disposition, "PASS_ACTION");
  assert.equal(reversed.action, canonical.action);
});

test("early middle and latest ablations all fail closed", () => {
  const [early, middle, latest] = canonicalHistory();
  for (const history of [[middle, latest], [early, latest], [early, middle]]) {
    const { result, reads } = solveWith(history);
    assert.equal(reads, 1);
    assert.equal(result.disposition, "HOLD_HISTORY_INCOMPLETE");
    assert.equal(result.action, null);
    assert.equal(result.historyDepthUsed, 0);
  }
});

test("direct-only and pair-only substitutes cannot receive full-trajectory action", () => {
  const [early, middle, latest] = canonicalHistory();
  for (const history of [[latest], [early, latest]]) {
    const result = solveWith(history).result;
    assert.equal(result.disposition, "HOLD_HISTORY_INCOMPLETE");
    assert.equal(result.action, null);
  }
});

test("forged chronology and forged provenance fail governed-history validation", () => {
  const [early, middle, latest] = canonicalHistory();
  const forgedChronology = { ...middle, observedAt: "2099-01-01T00:00:00-03:00" };
  const forgedProvenance = { ...latest, entryFingerprint: "0".repeat(64) };
  const chronologyResult = solveWith([early, forgedChronology, latest]).result;
  const provenanceResult = solveWith([early, middle, forgedProvenance]).result;
  assert.equal(chronologyResult.disposition, "HOLD_UNGOVERNED_HISTORY");
  assert.equal(provenanceResult.disposition, "HOLD_UNGOVERNED_HISTORY");
});

test("duplicate or unknown history entries fail closed", () => {
  const [early, middle, latest] = canonicalHistory();
  const duplicateResult = solveWith([early, middle, middle]).result;
  const unknownResult = solveWith([early, middle, latest, { ...latest, entryId: "G5-E-9999-REAL" }]).result;
  assert.equal(duplicateResult.disposition, "HOLD_UNGOVERNED_HISTORY");
  assert.equal(unknownResult.disposition, "HOLD_UNGOVERNED_HISTORY");
});

test("challenge cannot carry owner history or a precomputed terminal state", () => {
  assert.throws(
    () => solveG5AutobiographicalHistoryR3({ challenge: { ...challenge, historySummary: "forbidden" }, memoryProvider: canonicalHistory }),
    /G5_R3_CHALLENGE_HISTORY_CHANNEL_FORBIDDEN/,
  );
  assert.throws(
    () => solveG5AutobiographicalHistoryR3({ challenge: { ...challenge, targetAction: "R3_ACTION_00" }, memoryProvider: canonicalHistory }),
    /G5_R3_CHALLENGE_HISTORY_CHANNEL_FORBIDDEN/,
  );
});

test("all three entries are load-bearing at trajectory digest layer and chronology is noncommutative", () => {
  const diagnostic = diagnoseG5R3TrajectoryLoadBearing();
  assert.equal(diagnostic.diagnosticOnly, true);
  assert.equal(diagnostic.allThreeLoadBearingAtDigestLayer, true);
  assert.equal(diagnostic.chronologySensitiveAtDigestLayer, true);
  assert.equal(diagnostic.heldoutPanelMaterialized, false);
  assert.equal(diagnostic.subjectOutcomeGenerated, false);
});
