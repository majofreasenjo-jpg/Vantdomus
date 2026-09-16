import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionContinuationReceipt,
} from "../lib/domiMultiSurfaceContinuity.mjs";
import {
  seedP5SyntheticDesktopState,
  P5_SYNTHETIC_PERSON_ID,
  P5_SOURCE_SESSION_ID,
  P5_PRIVATE_MEMORY_ID,
  P5_SHARED_MEMORY_ID,
  P5_PRIVATE_TURN_ID,
  P5_SHARED_TURN_ID,
  P5_QUERY,
  P5_AUTHORIZED_SCOPES,
} from "../lib/domiP5SyntheticFixture.mjs";
import {
  P5_FORWARD_RECEIPT_PURPOSE,
  createP5ContinuityResumeArtifact,
  serializeP5ContinuityResumeArtifact,
  parseP5ContinuityResumeArtifact,
  validateP5ContinuityResumeArtifact,
  reconstructP5ContinuityFromResumeArtifact,
} from "../lib/domiP5ContinuityResumeArtifact.mjs";

const FIXTURE_BASE_TIME = "2026-09-15T22:00:00.000Z";
const CREATED_AT = "2026-09-15T22:01:00.000Z";
const EXPIRES_AT = "2026-09-16T01:01:00.000Z";

function makeArtifact() {
  const state = seedP5SyntheticDesktopState({ baseTime: FIXTURE_BASE_TIME });
  const receipt = createSessionContinuationReceipt(state, {
    receiptId: "P5-RESUME-TEST-1",
    sourceSessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    targetSurfaceClass: "PERSONAL_MOBILE",
    purpose: P5_FORWARD_RECEIPT_PURPOSE,
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
    transferableTurnIds: [P5_PRIVATE_TURN_ID, P5_SHARED_TURN_ID],
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
  return {
    receipt,
    artifact: createP5ContinuityResumeArtifact({
      receipt,
      fixtureBaseTime: FIXTURE_BASE_TIME,
    }),
  };
}

test("resume artifact persists only the governed minimal metadata allow-list", () => {
  const { artifact } = makeArtifact();
  assert.deepEqual(Object.keys(artifact).sort(), [
    "artifactDigest",
    "artifactVersion",
    "continuityKey",
    "fixtureBaseTime",
    "personId",
    "receiptCreatedAt",
    "receiptDigest",
    "receiptExpiresAt",
    "receiptId",
    "reconstructionClass",
    "sourceSessionId",
    "sourceSurfaceClass",
    "targetSurfaceClass",
  ].sort());

  const serialized = serializeP5ContinuityResumeArtifact(artifact);
  for (const forbidden of [
    "Proyecto Atlas",
    "prefiero trabajarlo temprano",
    "query",
    "projectedMemoryIds",
    "memoryScopes",
    "transferableTurnIds",
    "rawMemoryContentIncluded",
    "rawTranscriptContentIncluded",
    "fullStateCopied",
    "providerAuthorityTransferred",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `must not persist ${forbidden}`);
  }
  assert.equal(serialized.includes(P5_PRIVATE_MEMORY_ID), false);
  assert.equal(serialized.includes(P5_SHARED_MEMORY_ID), false);
});

test("serialized artifact reload reconstructs receipt and recovers expected synthetic references", () => {
  const { artifact } = makeArtifact();
  const parsed = parseP5ContinuityResumeArtifact(
    serializeP5ContinuityResumeArtifact(artifact),
  );
  const result = reconstructP5ContinuityFromResumeArtifact(parsed, {
    now: "2026-09-15T22:02:00.000Z",
    targetSessionId: "P5-PHONE-RELOAD-TEST",
  });

  assert.equal(result.checks.expectedSyntheticReferencesRecovered, true);
  assert.equal(result.checks.continuityKeyStable, true);
  assert.deepEqual(
    [...result.consumption.memoryIds].sort(),
    [P5_PRIVATE_MEMORY_ID, P5_SHARED_MEMORY_ID].sort(),
  );
  assert.equal(result.reconstructedReceipt.receiptDigest, artifact.receiptDigest);
  assert.equal(result.consumption.continuityKey, artifact.continuityKey);
});

test("missing and corrupt serialized artifacts fail closed", () => {
  assert.throws(
    () => parseP5ContinuityResumeArtifact(""),
    /P5_RESUME_ARTIFACT_REQUIRED/,
  );
  assert.throws(
    () => parseP5ContinuityResumeArtifact("{not-json"),
    /P5_RESUME_ARTIFACT_INVALID/,
  );
});

test("expired artifact fails closed", () => {
  const { artifact } = makeArtifact();
  const validation = validateP5ContinuityResumeArtifact(artifact, {
    now: EXPIRES_AT,
  });
  assert.equal(validation.pass, false);
  assert.equal(validation.failures.includes("ARTIFACT_EXPIRED"), true);
});

test("wrong target surface fails closed", () => {
  const { artifact } = makeArtifact();
  const validation = validateP5ContinuityResumeArtifact(
    { ...artifact, targetSurfaceClass: "PERSONAL_DESKTOP" },
    { now: "2026-09-15T22:02:00.000Z" },
  );
  assert.equal(validation.pass, false);
  assert.equal(validation.failures.includes("TARGET_SURFACE_INVALID"), true);
  assert.equal(validation.failures.includes("TARGET_SURFACE_MISMATCH"), true);
});

test("wrong source surface fails closed", () => {
  const { artifact } = makeArtifact();
  const validation = validateP5ContinuityResumeArtifact(
    { ...artifact, sourceSurfaceClass: "PERSONAL_MOBILE" },
    { now: "2026-09-15T22:02:00.000Z" },
  );
  assert.equal(validation.pass, false);
  assert.equal(validation.failures.includes("SOURCE_SURFACE_INVALID"), true);
  assert.equal(validation.failures.includes("SOURCE_SURFACE_MISMATCH"), true);
});

test("wrong continuity key fails closed against expected key", () => {
  const { artifact } = makeArtifact();
  const validation = validateP5ContinuityResumeArtifact(
    { ...artifact, continuityKey: "fnv1a32:00000000" },
    {
      now: "2026-09-15T22:02:00.000Z",
      expectedContinuityKey: artifact.continuityKey,
    },
  );
  assert.equal(validation.pass, false);
  assert.equal(validation.failures.includes("CONTINUITY_KEY_MISMATCH"), true);
});

for (const [field, failure] of [
  ["rawMemory", "RAW_MEMORY_PERSISTENCE_FORBIDDEN"],
  ["rawTranscript", "RAW_TRANSCRIPT_PERSISTENCE_FORBIDDEN"],
  ["fullState", "FULL_STATE_PERSISTENCE_FORBIDDEN"],
  ["authorityGrant", "AUTHORITY_PERSISTENCE_FORBIDDEN"],
  ["unboundedContext", "UNBOUNDED_CONTEXT_PERSISTENCE_FORBIDDEN"],
]) {
  test(`injected ${field} fails closed`, () => {
    const { artifact } = makeArtifact();
    const validation = validateP5ContinuityResumeArtifact(
      { ...artifact, [field]: "forbidden" },
      { now: "2026-09-15T22:02:00.000Z" },
    );
    assert.equal(validation.pass, false);
    assert.equal(validation.failures.includes(failure), true);
    assert.equal(validation.failures.includes(`UNEXPECTED_FIELD:${field}`), true);
  });
}

test("unexpected non-prohibited field still fails closed", () => {
  const { artifact } = makeArtifact();
  const validation = validateP5ContinuityResumeArtifact(
    { ...artifact, arbitraryExtra: "x" },
    { now: "2026-09-15T22:02:00.000Z" },
  );
  assert.equal(validation.pass, false);
  assert.equal(validation.failures.includes("UNEXPECTED_FIELD:arbitraryExtra"), true);
});
