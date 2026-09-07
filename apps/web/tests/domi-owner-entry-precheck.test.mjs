import test from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_ENTRY_OBLIGATIONS,
  createOwnerAuthorizationReceipt,
  validateOwnerAuthorizationAtIssuance,
  freezeProspectiveCheckpointGrammar,
  bindCheckpointObservation,
  assertNoFutureToPastLeakage,
  quotientEvidenceRoots,
  classifyRepresentationExtension,
  auditPersistenceVsReactivation,
  adjudicateIdentifiedSet,
  classifyHistoricalCoverage,
  ownerReviewDisposition,
  filterAuthorizedContext,
  appendCheckpointRecord,
  replaceCheckpointRecord,
  evaluateOwnerEntryPrecheck,
  makeSyntheticObligationResults,
} from "../lib/domiOwnerEntryPrecheck.mjs";

test("O01 authorization is issuance-bound, scoped and revocation-aware", () => {
  const receipt = createOwnerAuthorizationReceipt({
    authorizationId: "AUTH-P6-001",
    ownerId: "OWNER-SYNTH-1",
    issuedAt: "2026-09-06T15:00:00.000Z",
    validUntil: "2026-09-08T15:00:00.000Z",
    purposes: ["P6_PRECHECK"],
    dataClasses: ["SYNTHETIC_OWNER_FIXTURE"],
    surfaces: ["PERSONAL_DESKTOP"],
    retentionPolicy: "FIXTURE_ONLY_EPHEMERAL",
    revocationPolicy: "FAIL_CLOSED",
  });
  assert.equal(validateOwnerAuthorizationAtIssuance(receipt, {
    now: "2026-09-06T16:00:00.000Z",
    requiredPurpose: "P6_PRECHECK",
    requiredDataClass: "SYNTHETIC_OWNER_FIXTURE",
    requiredSurface: "PERSONAL_DESKTOP",
  }).pass, true);
  assert.equal(validateOwnerAuthorizationAtIssuance(receipt, {
    now: "2026-09-06T16:00:00.000Z",
    requiredPurpose: "P6_PRECHECK",
    requiredDataClass: "SYNTHETIC_OWNER_FIXTURE",
    requiredSurface: "PERSONAL_DESKTOP",
    revokedAuthorizationIds: ["AUTH-P6-001"],
  }).pass, false);
});

test("O02/O03 checkpoint grammar is prospective and later information does not rewrite earlier records", () => {
  const grammar = freezeProspectiveCheckpointGrammar({
    grammarId: "P6-GRAMMAR-1",
    frozenAt: "2026-09-06T15:00:00.000Z",
    checkpoints: [
      { id: "T0", horizon: "entry", slotCap: 1 },
      { id: "T1", horizon: "plus_1h", slotCap: 2 },
    ],
    windows: [{ id: "W0", startOffsetMinutes: 0, endOffsetMinutes: 60 }],
  });
  const t0 = bindCheckpointObservation({
    grammar,
    checkpointId: "T0",
    observedAt: "2026-09-06T15:05:00.000Z",
    availableInformationIds: ["I0"],
    sourceVintage: "V0",
  });
  const t1 = bindCheckpointObservation({
    grammar,
    checkpointId: "T1",
    observedAt: "2026-09-06T16:05:00.000Z",
    availableInformationIds: ["I0", "I1"],
    sourceVintage: "V1",
  });
  const audit = assertNoFutureToPastLeakage(t0, t1);
  assert.equal(audit.pass, true);
  assert.deepEqual(audit.laterOnlyInformationIds, ["I1"]);
});

test("O04 multiplicity is quotient-before-counting", () => {
  const result = quotientEvidenceRoots([
    { eventId: "E1", effectiveRootId: "R1" },
    { eventId: "E2", effectiveRootId: "R1" },
    { eventId: "E3", effectiveRootId: "R2" },
  ]);
  assert.equal(result.effectiveRootCount, 2);
});

test("O05 representation extension never becomes self/subjecthood evidence", () => {
  const result = classifyRepresentationExtension({
    baselineExplains: false,
    compressedHistoryExplains: false,
    historyDependentWitness: true,
    ambiguityRemaining: false,
  });
  assert.equal(result.classification, "POSSIBLE_GENUINE_HISTORY_STATE_EXTENSION");
  assert.equal(result.selfSpecificityEvidence, false);
  assert.equal(result.subjecthoodEvidence, false);
  assert.equal(result.consciousnessEvidence, false);
});

test("O06 reappearance with gaps leaves reactivation alternative open", () => {
  const result = auditPersistenceVsReactivation({ observations: [
    { observedAt: "2026-09-06T15:00:00.000Z", loadBearingObserved: true, sameCauseWitness: false },
    { observedAt: "2026-09-06T17:00:00.000Z", loadBearingObserved: true, contiguousWithPrevious: false, reactivationPossible: true, sameCauseWitness: false },
  ] });
  assert.equal(result.continuousResidenceEstablished, false);
  assert.equal(result.reactivationAlternativeOpen, true);
  assert.equal(result.sameCauseEstablished, false);
});

test("O07 ambiguous compatible rivals produce set-valued HOLD", () => {
  const result = adjudicateIdentifiedSet([
    { id: "HISTORY_STATE", compatible: true },
    { id: "REACTIVATION", compatible: true },
  ]);
  assert.equal(result.status, "HOLD_SET_VALUED");
  assert.equal(result.identifiedSet.length, 2);
});

test("O08 prospective observation cannot backfill missing history", () => {
  const result = classifyHistoricalCoverage({
    requiredHistoryStart: "2026-09-01T00:00:00.000Z",
    capturedHistoryStart: "2026-09-06T00:00:00.000Z",
  });
  assert.equal(result.status, "PARTIAL_HISTORY_CAUSAL_AGE_GAP");
  assert.equal(result.canBackfillProspectively, false);
});

test("O09 owner acceptance is governance, not independent scientific evidence", () => {
  const result = ownerReviewDisposition({ reviewerIsOwner: true, disposition: "ACCEPT" });
  assert.equal(result.acceptedForGovernance, true);
  assert.equal(result.independentScientificEvidence, false);
  assert.equal(result.scientificRootMinted, false);
});

test("O10 revocation removes content from active context and leaves tombstone only", () => {
  const result = filterAuthorizedContext([
    { itemId: "M1", authorizationId: "A1", dataClass: "OWNER_MEMORY", content: "secret" },
    { itemId: "M2", authorizationId: "A2", dataClass: "OWNER_MEMORY", content: "keep" },
  ], { revokedAuthorizationIds: ["A1"], allowedDataClasses: ["OWNER_MEMORY"] });
  assert.deepEqual(result.active.map((x) => x.itemId), ["M2"]);
  assert.equal(result.tombstones[0].contentRetained, false);
});

test("O11 checkpoint truth is append-only", () => {
  const ledger = appendCheckpointRecord([], { recordId: "R1", value: "old" });
  const next = appendCheckpointRecord(ledger, { recordId: "R2", value: "new" }, { supersedesRecordId: "R1" });
  assert.equal(next.length, 2);
  assert.throws(() => replaceCheckpointRecord(), /APPEND_ONLY_CHECKPOINT_TRUTH_REPLACEMENT_FORBIDDEN/);
});

test("O12 precheck PASS does not start G5 without explicit activation", () => {
  const results = makeSyntheticObligationResults();
  assert.equal(results.length, OWNER_ENTRY_OBLIGATIONS.length);
  const precheck = evaluateOwnerEntryPrecheck({
    obligationResults: results,
    realOwnerMemoryRequested: false,
    explicitOwnerActivationAuthorization: false,
  });
  assert.equal(precheck.deterministicPrecheckPass, true);
  assert.equal(precheck.realOwnerMemoryOpened, false);
  assert.equal(precheck.g5Started, false);
  assert.equal(precheck.explicitActivationStillRequired, true);
});

test("all 12 synthetic deterministic obligations close while claim wall remains false", () => {
  const precheck = evaluateOwnerEntryPrecheck({ obligationResults: makeSyntheticObligationResults() });
  assert.deepEqual(precheck.missingObligations, []);
  assert.equal(precheck.claimWall.realDevelopmentDemonstrated, false);
  assert.equal(precheck.claimWall.subjecthoodDemonstrated, false);
  assert.equal(precheck.claimWall.selfSpecificityEstablished, false);
  assert.equal(precheck.claimWall.consciousnessDemonstrated, false);
  assert.equal(precheck.claimWall.phenomenalConsciousness, "UNKNOWN");
});
