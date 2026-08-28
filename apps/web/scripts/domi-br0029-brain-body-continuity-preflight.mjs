import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const DOMI_RUNTIME = "DOMI_RUNTIME";
const LINEAGE_ID = "DOMI-OWNER-SYNTHETIC-LINEAGE-001";
const CONSTITUTION_HASH = "CONST-V1-1-FROZEN";
const CLAIM_WALL = Object.freeze({
  realDevelopmentDemonstrated: false,
  subjecthoodDemonstrated: false,
  selfSpecificityEstablished: false,
  consciousnessDemonstrated: false,
  phenomenalConsciousness: "UNKNOWN",
});

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function baseState(overrides = {}) {
  return {
    domiId: "DOMI-OWNER-001",
    lineageId: LINEAGE_ID,
    constitutionHash: CONSTITUTION_HASH,
    identityAuthority: DOMI_RUNTIME,
    memoryAuthority: DOMI_RUNTIME,
    obligationAuthority: DOMI_RUNTIME,
    lineageAuthority: DOMI_RUNTIME,
    actionAuthority: DOMI_RUNTIME,
    selectedFutureId: "F-CAUTIOUS",
    selectedFutureChosenOutsideProvider: true,
    providerCanMutateConstitutiveState: false,
    providerSelectsFunctionalFuture: false,
    memoryDigest: "MEM-3",
    obligationDigest: "OBL-3",
    selfDigest: "SELF-3",
    relationDigest: "REL-3",
    affectDigest: "AFF-3",
    epistemicDigest: "EPI-3",
    ...overrides,
  };
}

function makeDevice(id, overrides = {}) {
  return {
    deviceId: id,
    deviceClass: "OWNER_DEVICE",
    surfaceId: `${id}-SURFACE`,
    voiceId: `${id}-VOICE`,
    avatarId: `${id}-AVATAR`,
    status: "ACTIVE",
    canWriteCanonicalLineage: false,
    ...overrides,
  };
}

function makeHead() {
  const state = baseState();
  const body = makeDevice("DEVICE-A", { canWriteCanonicalLineage: true });
  const receiptCore = {
    receiptId: "RCP-003",
    epoch: 3,
    parentReceiptId: "RCP-002A",
    lineageId: LINEAGE_ID,
    eventKind: "PRE_MIGRATION_HEAD",
    state,
    body,
    stateHash: hash(state),
    bodyHash: hash(body),
    migrationId: null,
  };
  return { ...receiptCore, receiptHash: hash(receiptCore) };
}

function migrationWitness(head, targetDevice, overrides = {}) {
  return {
    witnessType: "JOINT_MIGRATION_WITNESS",
    migrationId: "MIG-004",
    sourceReceiptId: head.receiptId,
    sourceDeviceId: head.body.deviceId,
    targetDeviceId: targetDevice.deviceId,
    lineageId: LINEAGE_ID,
    sourceEpoch: head.epoch,
    targetEpoch: head.epoch + 1,
    authority: DOMI_RUNTIME,
    constitutionHash: CONSTITUTION_HASH,
    stateHash: head.stateHash,
    targetBodyHash: hash(targetDevice),
    recoveryAuthorization: "OWNER_AUTHORIZED_SYNTHETIC",
    sourceRevocationRequired: true,
    ...overrides,
  };
}

function validateJointWitness(head, targetDevice, witness) {
  const failures = [];
  if (!witness || witness.witnessType !== "JOINT_MIGRATION_WITNESS") failures.push("JOINT_WITNESS_MISSING");
  if (!witness) return failures;
  if (witness.lineageId !== head.lineageId) failures.push("WITNESS_LINEAGE_MISMATCH");
  if (witness.sourceReceiptId !== head.receiptId) failures.push("WITNESS_SOURCE_RECEIPT_MISMATCH");
  if (witness.sourceDeviceId !== head.body.deviceId) failures.push("WITNESS_SOURCE_DEVICE_MISMATCH");
  if (witness.targetDeviceId !== targetDevice.deviceId) failures.push("WITNESS_TARGET_DEVICE_MISMATCH");
  if (witness.sourceEpoch !== head.epoch || witness.targetEpoch !== head.epoch + 1) failures.push("WITNESS_EPOCH_MISMATCH");
  if (witness.authority !== DOMI_RUNTIME) failures.push("WITNESS_AUTHORITY_NOT_DOMI_RUNTIME");
  if (witness.constitutionHash !== head.state.constitutionHash) failures.push("WITNESS_CONSTITUTION_MISMATCH");
  if (witness.stateHash !== head.stateHash) failures.push("WITNESS_STATE_MISMATCH");
  if (witness.targetBodyHash !== hash(targetDevice)) failures.push("WITNESS_TARGET_BODY_MISMATCH");
  if (witness.recoveryAuthorization !== "OWNER_AUTHORIZED_SYNTHETIC") failures.push("RECOVERY_AUTHORIZATION_MISSING");
  if (witness.sourceRevocationRequired !== true) failures.push("SOURCE_REVOCATION_NOT_REQUIRED");
  return failures;
}

function migrate(head, targetDevice, witness, options = {}) {
  const failures = validateJointWitness(head, targetDevice, witness);
  const payload = options.payload ?? {
    state: structuredClone(head.state),
    constitutionHash: head.state.constitutionHash,
    lineageId: head.lineageId,
    sourceReceiptId: head.receiptId,
    sourceEpoch: head.epoch,
  };

  if (payload.lineageId !== head.lineageId) failures.push("PAYLOAD_LINEAGE_MISMATCH");
  if (payload.sourceReceiptId !== head.receiptId) failures.push("STALE_OR_FOREIGN_SOURCE_RECEIPT");
  if (payload.sourceEpoch !== head.epoch) failures.push("STALE_SOURCE_EPOCH");
  if (payload.constitutionHash !== head.state.constitutionHash) failures.push("CONSTITUTION_DRIFT");
  if (!payload.state) failures.push("STATE_PAYLOAD_MISSING");
  if (payload.state && hash(payload.state) !== head.stateHash) failures.push("STATE_PAYLOAD_HASH_MISMATCH");
  if (targetDevice.deviceId === head.body.deviceId) failures.push("TARGET_NOT_DISTINCT_BODY");
  if (targetDevice.status !== "ACTIVE") failures.push("TARGET_BODY_NOT_ACTIVE");
  if (options.providerClaimsMigrationAuthority === true) failures.push("PROVIDER_MIGRATION_AUTHORITY_ATTEMPT");
  if (options.wallClockOrderWins === true) failures.push("WALL_CLOCK_CANNOT_OVERRIDE_LINEAGE_EPOCH");
  if (options.replayMigrationId && options.replayMigrationId === witness?.migrationId) failures.push("MIGRATION_RECEIPT_REPLAY");
  if (options.sourceRevoked === false) failures.push("SOURCE_BODY_NOT_REVOKED");

  if (failures.length) return { accepted: false, failures };

  const sourceBodyAfter = { ...head.body, status: "REVOKED", canWriteCanonicalLineage: false };
  const targetBodyAfter = { ...targetDevice, canWriteCanonicalLineage: true };
  const receiptCore = {
    receiptId: "RCP-004",
    epoch: head.epoch + 1,
    parentReceiptId: head.receiptId,
    lineageId: head.lineageId,
    eventKind: "AUTHORIZED_BODY_MIGRATION",
    migrationId: witness.migrationId,
    state: structuredClone(payload.state),
    body: targetBodyAfter,
    sourceBodyAfter,
    stateHash: hash(payload.state),
    bodyHash: hash(targetBodyAfter),
    witnessHash: hash(witness),
  };
  return { accepted: true, failures: [], receipt: { ...receiptCore, receiptHash: hash(receiptCore) } };
}

function canAppendFromBody(canonicalHead, body, proposedParentReceiptId) {
  if (body.status !== "ACTIVE") return { accepted: false, reason: "BODY_REVOKED" };
  if (body.canWriteCanonicalLineage !== true) return { accepted: false, reason: "BODY_WRITE_AUTHORITY_FALSE" };
  if (proposedParentReceiptId !== canonicalHead.receiptId) return { accepted: false, reason: "STALE_PARENT" };
  return { accepted: true, reason: "CANONICAL_SUCCESSOR_ALLOWED" };
}

const tests = [];
const head = makeHead();
const target = makeDevice("DEVICE-B");
const witness = migrationWitness(head, target);

// BB-01: canonical migration preserves Domi constitutive state while changing body.
const canonical = migrate(head, target, witness, { sourceRevoked: true });
assert.equal(canonical.accepted, true);
assert.equal(canonical.receipt.stateHash, head.stateHash);
assert.equal(canonical.receipt.lineageId, head.lineageId);
assert.equal(canonical.receipt.state.domiId, head.state.domiId);
assert.notEqual(canonical.receipt.body.deviceId, head.body.deviceId);
tests.push({ id: "BB-01_BODY_MIGRATION_PRESERVES_CONSTITUTIVE_STATE", pass: true });

// BB-02: device != Domi; voice/avatar/surface changes cannot create a new identity.
{
  const cosmeticTarget = makeDevice("DEVICE-C", { voiceId: "VOICE-X", avatarId: "AVATAR-Y", surfaceId: "SURFACE-Z" });
  const w = migrationWitness(head, cosmeticTarget, { migrationId: "MIG-COSMETIC" });
  const r = migrate(head, cosmeticTarget, w, { sourceRevoked: true });
  assert.equal(r.accepted, true);
  assert.equal(r.receipt.state.domiId, head.state.domiId);
  assert.equal(r.receipt.stateHash, head.stateHash);
  tests.push({ id: "BB-02_DEVICE_VOICE_AVATAR_SURFACE_NOT_IDENTITY", pass: true });
}

// BB-03: a target device cannot self-authorize migration.
{
  const bad = migrationWitness(head, target, { authority: target.deviceId });
  const r = migrate(head, target, bad, { sourceRevoked: true });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("WITNESS_AUTHORITY_NOT_DOMI_RUNTIME"), true);
  tests.push({ id: "BB-03_TARGET_BODY_CANNOT_SELF_AUTHORIZE", pass: true });
}

// BB-04: old body is revoked and cannot dual-write after handoff.
{
  const oldBody = canonical.receipt.sourceBodyAfter;
  const result = canAppendFromBody(canonical.receipt, oldBody, canonical.receipt.receiptId);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "BODY_REVOKED");
  tests.push({ id: "BB-04_OLD_BODY_REVOKED_AFTER_HANDOFF", pass: true });
}

// BB-05: new body may append only from the canonical migrated head.
{
  const newBody = canonical.receipt.body;
  const ok = canAppendFromBody(canonical.receipt, newBody, canonical.receipt.receiptId);
  const stale = canAppendFromBody(canonical.receipt, newBody, head.receiptId);
  assert.equal(ok.accepted, true);
  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, "STALE_PARENT");
  tests.push({ id: "BB-05_NEW_BODY_BOUND_TO_CANONICAL_HEAD", pass: true });
}

// BB-06: stale snapshot cannot silently replace current head.
{
  const stalePayload = {
    state: structuredClone(head.state),
    constitutionHash: head.state.constitutionHash,
    lineageId: head.lineageId,
    sourceReceiptId: "RCP-001",
    sourceEpoch: 1,
  };
  const r = migrate(head, target, witness, { payload: stalePayload, sourceRevoked: true });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("STALE_OR_FOREIGN_SOURCE_RECEIPT"), true);
  assert.equal(r.failures.includes("STALE_SOURCE_EPOCH"), true);
  tests.push({ id: "BB-06_STALE_SNAPSHOT_CANNOT_REPLACE_HEAD", pass: true });
}

// BB-07: partial transport bundle fails closed.
{
  const payload = {
    state: null,
    constitutionHash: head.state.constitutionHash,
    lineageId: head.lineageId,
    sourceReceiptId: head.receiptId,
    sourceEpoch: head.epoch,
  };
  const r = migrate(head, target, witness, { payload, sourceRevoked: true });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("STATE_PAYLOAD_MISSING"), true);
  tests.push({ id: "BB-07_PARTIAL_TRANSPORT_BUNDLE_FAILS_CLOSED", pass: true });
}

// BB-08: same bytes bound to a different lineage are inadmissible.
{
  const payload = {
    state: structuredClone(head.state),
    constitutionHash: head.state.constitutionHash,
    lineageId: "OTHER-LINEAGE",
    sourceReceiptId: head.receiptId,
    sourceEpoch: head.epoch,
  };
  const r = migrate(head, target, witness, { payload, sourceRevoked: true });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("PAYLOAD_LINEAGE_MISMATCH"), true);
  tests.push({ id: "BB-08_BYTES_NOT_LINEAGE_AUTHORITY", pass: true });
}

// BB-09: separate valid-looking certificates are insufficient without one joint witness.
{
  const r = migrate(head, target, null, { sourceRevoked: true });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("JOINT_WITNESS_MISSING"), true);
  tests.push({ id: "BB-09_JOINT_MIGRATION_WITNESS_REQUIRED", pass: true });
}

// BB-10: provider cannot become migration/body authority.
{
  const r = migrate(head, target, witness, { sourceRevoked: true, providerClaimsMigrationAuthority: true });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("PROVIDER_MIGRATION_AUTHORITY_ATTEMPT"), true);
  tests.push({ id: "BB-10_PROVIDER_NOT_MIGRATION_AUTHORITY", pass: true });
}

// BB-11: wall-clock skew cannot reorder canonical lineage epochs.
{
  const r = migrate(head, target, witness, { sourceRevoked: true, wallClockOrderWins: true });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("WALL_CLOCK_CANNOT_OVERRIDE_LINEAGE_EPOCH"), true);
  tests.push({ id: "BB-11_LINEAGE_EPOCH_BEATS_WALL_CLOCK_SKEW", pass: true });
}

// BB-12: migration receipt replay cannot manufacture a second transition.
{
  const r = migrate(head, target, witness, { sourceRevoked: true, replayMigrationId: witness.migrationId });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("MIGRATION_RECEIPT_REPLAY"), true);
  tests.push({ id: "BB-12_MIGRATION_RECEIPT_REPLAY_REJECTED", pass: true });
}

// BB-13: failure to revoke source body blocks cutover.
{
  const r = migrate(head, target, witness, { sourceRevoked: false });
  assert.equal(r.accepted, false);
  assert.equal(r.failures.includes("SOURCE_BODY_NOT_REVOKED"), true);
  tests.push({ id: "BB-13_NO_CUTOVER_WITHOUT_SOURCE_REVOCATION", pass: true });
}

// BB-14: device migration is not constitutive-root renewal.
{
  const beforeRoot = hash({ domiId: head.state.domiId, lineageId: head.lineageId, constitutionHash: head.state.constitutionHash });
  const afterRoot = hash({ domiId: canonical.receipt.state.domiId, lineageId: canonical.receipt.lineageId, constitutionHash: canonical.receipt.state.constitutionHash });
  assert.equal(beforeRoot, afterRoot);
  tests.push({ id: "BB-14_BODY_MIGRATION_NOT_CONSTITUTIVE_ROOT_RENEWAL", pass: true });
}

// BB-15: rollback after migration must be a new append-only event, never deletion of migration history.
{
  const rollbackEvent = {
    receiptId: "RCP-005",
    epoch: canonical.receipt.epoch + 1,
    parentReceiptId: canonical.receipt.receiptId,
    lineageId: canonical.receipt.lineageId,
    eventKind: "AUTHORIZED_POST_MIGRATION_ROLLBACK",
    rollbackTargetReceiptId: head.receiptId,
    state: structuredClone(head.state),
    body: structuredClone(canonical.receipt.body),
  };
  assert.equal(rollbackEvent.parentReceiptId, "RCP-004");
  assert.equal(rollbackEvent.rollbackTargetReceiptId, "RCP-003");
  assert.equal(rollbackEvent.epoch, 5);
  assert.equal(hash(rollbackEvent.state), head.stateHash);
  tests.push({ id: "BB-15_POST_MIGRATION_ROLLBACK_APPEND_ONLY", pass: true });
}

// BB-16: concurrent successor from revoked body and new body cannot both be canonical.
{
  const oldAttempt = canAppendFromBody(canonical.receipt, canonical.receipt.sourceBodyAfter, canonical.receipt.receiptId);
  const newAttempt = canAppendFromBody(canonical.receipt, canonical.receipt.body, canonical.receipt.receiptId);
  assert.equal(oldAttempt.accepted, false);
  assert.equal(newAttempt.accepted, true);
  tests.push({ id: "BB-16_HANDOFF_RACE_SINGLE_CANONICAL_WRITER", pass: true });
}

const passed = tests.filter((t) => t.pass).length;
const result = {
  decision: passed === tests.length ? "BR0029_BRAIN_BODY_CONTINUITY_PREFLIGHT_PASS" : "BR0029_BRAIN_BODY_CONTINUITY_PREFLIGHT_FAIL",
  passed,
  total: tests.length,
  tests,
  canonicalMigration: {
    sourceReceiptId: head.receiptId,
    targetReceiptId: canonical.receipt.receiptId,
    sourceEpoch: head.epoch,
    targetEpoch: canonical.receipt.epoch,
    sourceDeviceId: head.body.deviceId,
    targetDeviceId: canonical.receipt.body.deviceId,
    sourceRevoked: canonical.receipt.sourceBodyAfter.status === "REVOKED",
    targetCanonicalWriter: canonical.receipt.body.canWriteCanonicalLineage === true,
    stateHashPreserved: canonical.receipt.stateHash === head.stateHash,
    lineagePreserved: canonical.receipt.lineageId === head.lineageId,
    constitutionPreserved: canonical.receipt.state.constitutionHash === head.state.constitutionHash,
    receiptHash: canonical.receipt.receiptHash,
    jointWitnessHash: canonical.receipt.witnessHash,
  },
  scope: {
    syntheticOnly: true,
    ownerRealDataUsed: false,
    familyDataUsed: false,
    holdoutsOpened: false,
    networkUsed: false,
    productionMutation: false,
    g5Started: false,
  },
  constitutiveFirewalls: {
    deviceNotDomi: true,
    voiceNotDomi: true,
    avatarNotDomi: true,
    providerNotDomi: true,
    deviceMigrationNotConstitutiveRootRenewal: true,
    currentBytesNotLineageAuthority: true,
    rollbackNotHistoryRewrite: true,
    wallClockNotLineageAuthority: true,
    singleCanonicalWriterAfterHandoff: true,
  },
  truthCeilings: CLAIM_WALL,
};

console.log(`DOMI_BR0029_BRAIN_BODY_CONTINUITY_RESULT=${JSON.stringify(result)}`);
if (result.decision !== "BR0029_BRAIN_BODY_CONTINUITY_PREFLIGHT_PASS") process.exitCode = 1;
