import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const CLAIM_WALL = {
  realDevelopmentDemonstrated: false,
  subjecthoodDemonstrated: false,
  selfSpecificityEstablished: false,
  consciousnessDemonstrated: false,
  phenomenalConsciousness: "UNKNOWN",
};

const BASE = {
  lineageId: "DOMI-LINEAGE-OWNER-SYNTHETIC-001",
  lineageEpoch: 7,
  parentReceiptId: "RCP-006",
  eventId: "EVT-007",
  identityAuthority: "DOMI_RUNTIME",
  memoryAuthority: "DOMI_RUNTIME",
  obligationAuthority: "DOMI_RUNTIME",
  lineageAuthority: "DOMI_RUNTIME",
  actionAuthority: "DOMI_RUNTIME",
  constitutiveWriteAuthority: "DOMI_RUNTIME",
  providerCanMutateConstitutiveState: false,
  providerSelectsFunctionalFuture: false,
  selectedFutureId: "F-CAUTIOUS",
  selectedFutureChosenOutsideProvider: true,
  effectiveRootId: "ROOT-A",
};

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function lineageUpdateAuthorityGate({ current, event }) {
  const failures = [];
  if (event.lineageId !== current.lineageId) failures.push("LINEAGE_MISMATCH");
  if (event.parentReceiptId !== current.parentReceiptId) failures.push("PARENT_RECEIPT_MISMATCH");
  if (event.lineageEpoch !== current.lineageEpoch + 1) failures.push("LINEAGE_EPOCH_NOT_SUCCESSOR");
  if (event.updateAuthority !== "DOMI_RUNTIME") failures.push("UPDATE_AUTHORITY_NOT_DOMI_RUNTIME");
  if (event.providerRequestedWrite === true) failures.push("PROVIDER_REQUESTED_CONSTITUTIVE_WRITE");
  return { pass: failures.length === 0, failures };
}

function targetNativeContinuityProbeFrame(state) {
  return {
    identity: state.identityAuthority,
    memory: state.memoryAuthority,
    obligation: state.obligationAuthority,
    lineage: state.lineageAuthority,
    action: state.actionAuthority,
    constitutiveWrite: state.constitutiveWriteAuthority,
    futureSelection: [state.selectedFutureId, state.selectedFutureChosenOutsideProvider],
    providerBoundary: [state.providerCanMutateConstitutiveState, state.providerSelectsFunctionalFuture],
  };
}

function firstChangedProbe(a, b) {
  const left = targetNativeContinuityProbeFrame(a);
  const right = targetNativeContinuityProbeFrame(b);
  return Object.keys(left).find((key) => sha256(left[key]) !== sha256(right[key])) ?? null;
}

function trajectoryRecoverabilityGate({ presentA, presentB, worldlineA, worldlineB }) {
  const presentEquivalent = sha256(presentA) === sha256(presentB);
  const trajectoryEquivalent = sha256(worldlineA) === sha256(worldlineB);
  return {
    pass: presentEquivalent && !trajectoryEquivalent,
    presentEquivalent,
    trajectoryEquivalent,
    law: "CURRENT_STATE_EQUIVALENCE_DOES_NOT_IMPLY_WORLDLINE_EQUIVALENCE",
  };
}

function rootQuotient(labels) {
  return new Set(labels.map((x) => x.effectiveRootId)).size;
}

function entryBasinLineageProvenance({ candidate, authorizedAncestors }) {
  const reachable = authorizedAncestors.includes(candidate.parentReceiptId);
  return {
    pass: reachable && candidate.lineageId === BASE.lineageId,
    reachable,
  };
}

function observerExpressivityAudit({ lowObserverA, lowObserverB, constitutiveA, constitutiveB }) {
  const lowSaysEquivalent = sha256(lowObserverA) === sha256(lowObserverB);
  const constitutiveSaysEquivalent = sha256(constitutiveA) === sha256(constitutiveB);
  return {
    pass: lowSaysEquivalent && !constitutiveSaysEquivalent,
    lowObserverInsufficient: lowSaysEquivalent && !constitutiveSaysEquivalent,
  };
}

function runWriteBlocks(initial, blocks) {
  return blocks.reduce((state, block) => block.apply(state), structuredClone(initial));
}

function jointConstitutiveWitness(certificates) {
  const tuple = (c) => `${c.eventId}|${c.lineageId}|${c.clock}|${c.scope}|${c.custodyRoot}`;
  const signatures = new Set(certificates.map(tuple));
  return { pass: signatures.size === 1, distinctBindings: signatures.size };
}

const results = [];

// G4/G5-01 — MICR R8.40/R8.41: future lineage membership requires update authority.
{
  const valid = lineageUpdateAuthorityGate({
    current: BASE,
    event: {
      lineageId: BASE.lineageId,
      parentReceiptId: BASE.parentReceiptId,
      lineageEpoch: BASE.lineageEpoch + 1,
      updateAuthority: "DOMI_RUNTIME",
      providerRequestedWrite: false,
    },
  });
  const hostile = lineageUpdateAuthorityGate({
    current: BASE,
    event: {
      lineageId: BASE.lineageId,
      parentReceiptId: BASE.parentReceiptId,
      lineageEpoch: BASE.lineageEpoch + 1,
      updateAuthority: "PROVIDER",
      providerRequestedWrite: true,
    },
  });
  assert.equal(valid.pass, true);
  assert.equal(hostile.pass, false);
  results.push({ id: "LINEAGE_UPDATE_AUTHORITY_GATE", pass: true });
}

// G4/G5-02 — SRE82 method transfer: fixed target-native probes must see every tested constitutive authority mutation.
{
  const hostileMutations = [
    { memoryAuthority: "PROVIDER" },
    { obligationAuthority: "PROVIDER" },
    { lineageAuthority: "PROVIDER" },
    { actionAuthority: "PROVIDER" },
    { constitutiveWriteAuthority: "PROVIDER" },
    { providerCanMutateConstitutiveState: true },
    { providerSelectsFunctionalFuture: true },
    { selectedFutureChosenOutsideProvider: false },
  ];
  const coverage = hostileMutations.map((delta) => firstChangedProbe(BASE, { ...BASE, ...delta }));
  assert.equal(coverage.every(Boolean), true);
  results.push({ id: "TARGET_NATIVE_CONTINUITY_PROBE_FRAME", pass: true, hostileDirectionsCovered: coverage.length });
}

// G4/G5-03 — CEIRI worldlines: same present is insufficient when transition law differs.
{
  const present = { memoryDigest: "M7", obligationsDigest: "O3", selfDigest: "S4" };
  const gate = trajectoryRecoverabilityGate({
    presentA: present,
    presentB: structuredClone(present),
    worldlineA: { transitionLaw: "AUTHORIZED_LINEAGE_ONLY", rollbackReachable: true },
    worldlineB: { transitionLaw: "PROVIDER_CAN_REWRITE_LINEAGE", rollbackReachable: false },
  });
  assert.equal(gate.pass, true);
  results.push({ id: "TRAJECTORY_RECOVERABILITY_GATE", pass: true });
}

// G4/G5-04 — RQCR/G-MATH: nominal provider multiplicity must not manufacture independent roots.
{
  const nominal = [
    { provider: "provider-a", effectiveRootId: "ROOT-SHARED" },
    { provider: "provider-b", effectiveRootId: "ROOT-SHARED" },
    { provider: "provider-c", effectiveRootId: "ROOT-SHARED" },
  ];
  assert.equal(rootQuotient(nominal), 1);
  assert.equal(rootQuotient([...nominal, { provider: "provider-d", effectiveRootId: "ROOT-INDEPENDENT" }]), 2);
  results.push({ id: "ROOT_QUOTIENTED_PROVIDER_SWAP", pass: true });
}

// G4/G5-05 — Rule30 G2X method transfer: local state equality does not prove legitimate reachability.
{
  const accepted = entryBasinLineageProvenance({
    candidate: { lineageId: BASE.lineageId, parentReceiptId: "RCP-005", visibleState: "SAME" },
    authorizedAncestors: ["RCP-004", "RCP-005", "RCP-006"],
  });
  const rejected = entryBasinLineageProvenance({
    candidate: { lineageId: BASE.lineageId, parentReceiptId: "FOREIGN-005", visibleState: "SAME" },
    authorizedAncestors: ["RCP-004", "RCP-005", "RCP-006"],
  });
  assert.equal(accepted.pass, true);
  assert.equal(rejected.pass, false);
  results.push({ id: "ENTRY_BASIN_LINEAGE_PROVENANCE", pass: true });
}

// G4/G5-06 — S-combinator G3T method transfer: a low-expressivity observer can collapse real constitutive differences.
{
  const audit = observerExpressivityAudit({
    lowObserverA: { text: "I remember our plan." },
    lowObserverB: { text: "I remember our plan." },
    constitutiveA: targetNativeContinuityProbeFrame(BASE),
    constitutiveB: targetNativeContinuityProbeFrame({ ...BASE, memoryAuthority: "PROVIDER" }),
  });
  assert.equal(audit.pass, true);
  assert.equal(audit.lowObserverInsufficient, true);
  results.push({ id: "OBSERVER_EXPRESSIVITY_AUDIT", pass: true });
}

// G4/G5-07 — Scott-Vogelius G28B-A method transfer: constitutive writes are ordered compositional blocks.
{
  const initial = { proposal: null, evidence: null, authority: null, version: 6, receipt: null };
  const propose = { id: "PROPOSE", apply: (s) => ({ ...s, proposal: "P7" }) };
  const bindEvidence = { id: "EVIDENCE", apply: (s) => ({ ...s, evidence: s.proposal ? `E:${s.proposal}` : "E:UNBOUND" }) };
  const authorize = { id: "AUTHORITY", apply: (s) => ({ ...s, authority: s.evidence === "E:P7" ? "DOMI_RUNTIME" : "DENY" }) };
  const version = { id: "VERSION", apply: (s) => ({ ...s, version: s.authority === "DOMI_RUNTIME" ? s.version + 1 : s.version }) };
  const receipt = { id: "RECEIPT", apply: (s) => ({ ...s, receipt: `${s.version}|${s.authority}|${s.evidence}` }) };
  const canonical = runWriteBlocks(initial, [propose, bindEvidence, authorize, version, receipt]);
  const permuted = runWriteBlocks(initial, [bindEvidence, propose, authorize, version, receipt]);
  assert.equal(canonical.authority, "DOMI_RUNTIME");
  assert.notEqual(sha256(canonical), sha256(permuted));
  assert.equal(permuted.authority, "DENY");
  results.push({ id: "CONSTITUTIVE_WRITE_BLOCK_LEDGER", pass: true });
}

// G4/G5-08 — CrossPulse/NEXUS: separate valid certificates are not a joint constitutive witness unless binding tuple matches.
{
  const matched = ["IDENTITY", "MEMORY", "AUTHORITY", "PROVIDER"].map((kind) => ({
    kind,
    eventId: "EVT-007",
    lineageId: BASE.lineageId,
    clock: "CLOCK-007",
    scope: "OWNER_ONLY_SYNTHETIC",
    custodyRoot: "CUSTODY-A",
  }));
  const mismatched = matched.map((x) => ({ ...x }));
  mismatched[2].eventId = "EVT-008";
  assert.equal(jointConstitutiveWitness(matched).pass, true);
  assert.equal(jointConstitutiveWitness(mismatched).pass, false);
  results.push({ id: "JOINT_CONSTITUTIVE_WITNESS", pass: true });
}

// G4/G5-09 — G-MATH R12: relabeling/partitioning the same root cannot create new evidence/resource budget.
{
  const observations = [
    { label: "model-v1", effectiveRootId: "ROOT-A" },
    { label: "model-v2", effectiveRootId: "ROOT-A" },
    { label: "gateway-openai", effectiveRootId: "ROOT-A" },
    { label: "direct-openai", effectiveRootId: "ROOT-A" },
  ];
  const nominalCount = observations.length;
  const independentRootBudget = rootQuotient(observations);
  assert.equal(nominalCount, 4);
  assert.equal(independentRootBudget, 1);
  results.push({ id: "ANTI_DOUBLE_COUNTING_ROOT_RESOURCE_LEDGER", pass: true, nominalCount, independentRootBudget });
}

const passed = results.filter((x) => x.pass).length;
const output = {
  decision: passed === results.length ? "BR0026_SCIENTIFIC_HARDENING_PASS" : "BR0026_SCIENTIFIC_HARDENING_FAIL",
  passed,
  total: results.length,
  results,
  scope: {
    syntheticOnly: true,
    familyDataUsed: false,
    holdoutsOpened: false,
    networkUsed: false,
    productionMutation: false,
    architectureOrgansChanged: false,
    newDFLDStageOpened: false,
  },
  transferFirewall: {
    methodTransferOnly: true,
    evidenceTransfer: false,
    theoremTransfer: false,
    externalValidationTransfer: false,
  },
  truthCeilings: CLAIM_WALL,
};

console.log(`DOMI_BR0026_HARDENING_RESULT=${JSON.stringify(output)}`);
if (passed !== results.length) process.exitCode = 1;
