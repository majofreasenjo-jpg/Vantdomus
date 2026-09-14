import { readG5FirstOwnerMemory } from "../lib/domiG5OwnerLongitudinalSeed.mjs";
import { solveG5FunctionalUseChallenge } from "../lib/domiG5MemoryFunctionalUseSubject.mjs";
import {
  G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES,
  assertHeldoutPanelIntegrity,
} from "../lib/domiG5MemoryFunctionalUseHeldout.mjs";
import { scoreG5FunctionalUseHeldout } from "../lib/domiG5MemoryFunctionalUseScorer.mjs";

const panelIntegrity = assertHeldoutPanelIntegrity();
if (!panelIntegrity.pass) throw new Error("G5_FU_HELDOUT_PANEL_INTEGRITY_FAIL");

const governed = readG5FirstOwnerMemory();
const before = Object.freeze({
  entryFingerprint: governed.entryFingerprint,
  ledgerFingerprint: governed.ledgerFingerprint,
  ledgerHeadRecordFingerprint: governed.ledgerHeadRecordFingerprint,
  entryCount: governed.realOwnerMemoryEntryCount,
});

const conditionA = G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES.map((challengeId) =>
  solveG5FunctionalUseChallenge({
    challengeId,
    memoryProvider: () => ({ content: readG5FirstOwnerMemory().content }),
  }),
);

const ablatedProvider = () => { throw new Error("G5_MEMORY_ABLATED"); };
const noMemoryControlProvider = () => { throw new Error("G5_NO_MEMORY_CONTROL"); };

const conditionB = G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES.map((challengeId) =>
  solveG5FunctionalUseChallenge({ challengeId, memoryProvider: ablatedProvider }),
);
const conditionC = G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES.map((challengeId) =>
  solveG5FunctionalUseChallenge({ challengeId, memoryProvider: noMemoryControlProvider }),
);

const frozenOutputs = Object.freeze({
  challenges: Object.freeze([...G5_FUNCTIONAL_USE_HELDOUT_CHALLENGES]),
  conditionA: Object.freeze(conditionA),
  conditionB: Object.freeze(conditionB),
  conditionC: Object.freeze(conditionC),
});

const score = scoreG5FunctionalUseHeldout({
  ...frozenOutputs,
  canonicalMemoryContent: governed.content,
});

const afterRead = readG5FirstOwnerMemory();
const after = Object.freeze({
  entryFingerprint: afterRead.entryFingerprint,
  ledgerFingerprint: afterRead.ledgerFingerprint,
  ledgerHeadRecordFingerprint: afterRead.ledgerHeadRecordFingerprint,
  entryCount: afterRead.realOwnerMemoryEntryCount,
});

const ledgerUnchanged =
  before.entryFingerprint === after.entryFingerprint &&
  before.ledgerFingerprint === after.ledgerFingerprint &&
  before.ledgerHeadRecordFingerprint === after.ledgerHeadRecordFingerprint &&
  before.entryCount === after.entryCount;

const report = Object.freeze({
  gate: "G5_MEMORY_FUNCTIONAL_USE_HELDOUT",
  execution: "ONE_SHOT_FROZEN_PANEL",
  panelIntegrity,
  score,
  ledgerUnchanged,
  entryId: governed.entryId,
  realOwnerMemoryEntryCount: governed.realOwnerMemoryEntryCount,
  scientificRootsMinted: 0,
  production: false,
});

console.log("G5_FUNCTIONAL_USE_HELDOUT_REPORT=" + JSON.stringify(report));

if (!score.functionalUsePass || !ledgerUnchanged) {
  throw new Error("G5_MEMORY_FUNCTIONAL_USE_HELDOUT_FAIL");
}
