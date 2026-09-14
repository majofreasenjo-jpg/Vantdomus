import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_OWNER_AUTHORIZED_AT,
  G5_OWNER_AUTHORIZED_AT_UTC,
  G5_OWNER_DATA_CLASS,
  createG5OwnerActivationReceipt,
  validateG5ProspectiveOwnerDatum,
  admitG5ProspectiveOwnerDatum,
  projectG5ActivationState,
  revokeG5OwnerActivation,
  assertG5ActivationMintsNoScientificEvidence,
} from "../lib/domiG5OwnerActivation.mjs";

test("G5 explicit authorization opens only the governed owner boundary", () => {
  const receipt = createG5OwnerActivationReceipt();
  assert.equal(receipt.explicitOwnerAuthorization, true);
  assert.equal(receipt.activationAuthorized, true);
  assert.equal(receipt.activationState, "ACTIVE");
  assert.equal(receipt.g5Started, true);
  assert.equal(receipt.realOwnerMemoryBoundaryOpen, true);
  assert.equal(receipt.initialAdmissibleMemoryEntryCount, 0);
  assert.equal(receipt.realOwnerMemoryEntryCount, 0);
  assert.equal(receipt.priorConversationImported, false);
  assert.equal(receipt.familyDataAllowed, false);
  assert.equal(receipt.holdoutsAllowed, false);
  assert.equal(receipt.productionAllowed, false);
  assert.equal(receipt.retroactiveMemoryImportAllowed, false);
  assert.equal(receipt.canonicalAuthorizationTimestampUtc, G5_OWNER_AUTHORIZED_AT_UTC);
});

test("wrong authorization marker or timestamp fails closed", () => {
  assert.throws(() => createG5OwnerActivationReceipt({ authorizationMarker: "avancemos" }), /G5_EXPLICIT_OWNER_AUTHORIZATION_REQUIRED/);
  assert.throws(() => createG5OwnerActivationReceipt({ sourceAuthorizationTimestamp: "2026-09-07T10:42:59-03:00" }), /G5_AUTHORIZATION_TIMESTAMP_MISMATCH/);
});

test("prospective non-sensitive owner datum after activation is admissible", () => {
  const receipt = createG5OwnerActivationReceipt();
  const result = validateG5ProspectiveOwnerDatum(receipt, {
    observedAt: "2026-09-07T10:44:00-03:00",
    surfaceClass: "PERSONAL_DESKTOP",
    dataClass: G5_OWNER_DATA_CLASS,
    content: "Prefiero revisar primero los estados canónicos antes de ampliar alcance.",
  });
  assert.equal(result.pass, true);
  assert.equal(result.scientificEvidenceCredit, 0);
  assert.equal(result.developmentalCredit, 0);
});

test("observation before G5 activation is rejected as retroactive history", () => {
  const receipt = createG5OwnerActivationReceipt();
  const result = validateG5ProspectiveOwnerDatum(receipt, {
    observedAt: "2026-09-07T10:42:59-03:00",
    surfaceClass: "PERSONAL_DESKTOP",
    dataClass: G5_OWNER_DATA_CLASS,
    content: "old datum",
  });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes("OBSERVATION_PREDATES_G5_ACTIVATION"));
});

test("family, holdout, production, retroactive and out-of-scope surface inputs fail closed", () => {
  const receipt = createG5OwnerActivationReceipt();
  const common = {
    observedAt: "2026-09-07T10:44:00-03:00",
    dataClass: G5_OWNER_DATA_CLASS,
    content: "datum",
  };
  assert.equal(validateG5ProspectiveOwnerDatum(receipt, { ...common, surfaceClass: "SHARED_TV" }).pass, false);
  assert.equal(validateG5ProspectiveOwnerDatum(receipt, { ...common, surfaceClass: "PERSONAL_DESKTOP", familyData: true }).pass, false);
  assert.equal(validateG5ProspectiveOwnerDatum(receipt, { ...common, surfaceClass: "PERSONAL_DESKTOP", holdout: true }).pass, false);
  assert.equal(validateG5ProspectiveOwnerDatum(receipt, { ...common, surfaceClass: "PERSONAL_DESKTOP", production: true }).pass, false);
  assert.equal(validateG5ProspectiveOwnerDatum(receipt, { ...common, surfaceClass: "PERSONAL_DESKTOP", retroactiveImport: true }).pass, false);
});

test("first admitted owner datum is prospectively bound and remains non-scientific", () => {
  const receipt = createG5OwnerActivationReceipt();
  const entry = admitG5ProspectiveOwnerDatum(receipt, {
    entryId: "G5-E-0001-SYNTH",
    observedAt: "2026-09-07T10:44:00-03:00",
    surfaceClass: "PERSONAL_MOBILE",
    content: "Quiero que Domi mantenga separación entre producto y validación científica.",
  });
  assert.equal(entry.prospective, true);
  assert.equal(entry.retroactiveImport, false);
  assert.equal(entry.scientificEvidenceRootMinted, false);
  assert.equal(entry.developmentalCredit, 0);
  const state = projectG5ActivationState(receipt, [entry]);
  assert.equal(state.g5Started, true);
  assert.equal(state.realOwnerMemoryBoundaryOpen, true);
  assert.equal(state.realOwnerMemoryEntryCount, 1);
  assert.equal(state.scientificRootsMinted, 0);
});

test("activation itself mints no scientific evidence and claim wall remains false", () => {
  const receipt = createG5OwnerActivationReceipt();
  const audit = assertG5ActivationMintsNoScientificEvidence(receipt);
  assert.equal(audit.pass, true);
  assert.equal(receipt.claimWall.realDevelopmentDemonstrated, false);
  assert.equal(receipt.claimWall.subjecthoodDemonstrated, false);
  assert.equal(receipt.claimWall.selfSpecificityEstablished, false);
  assert.equal(receipt.claimWall.consciousnessDemonstrated, false);
  assert.equal(receipt.claimWall.phenomenalConsciousness, "UNKNOWN");
});

test("owner revocation closes G5 fail-closed and retains tombstone without content", () => {
  const receipt = createG5OwnerActivationReceipt();
  const tombstone = revokeG5OwnerActivation(receipt, {
    revokedAt: "2026-09-07T11:00:00-03:00",
    reason: "OWNER_TEST_REVOCATION",
  });
  assert.equal(tombstone.realOwnerMemoryBoundaryOpen, false);
  assert.equal(tombstone.g5Started, false);
  assert.equal(tombstone.contentRetained, false);
  assert.equal(tombstone.activeContextRetained, false);
  assert.equal(tombstone.scientificEvidenceRootMinted, false);
});

test("authorization timestamp is exactly the prospective cut", () => {
  const receipt = createG5OwnerActivationReceipt();
  assert.equal(receipt.sourceAuthorizationTimestamp, G5_OWNER_AUTHORIZED_AT);
  assert.equal(receipt.canonicalAuthorizationTimestampUtc, "2026-09-07T13:43:00.000Z");
});
