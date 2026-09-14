import { r4Sha256, DOMI_G5_R4_NAMESPACE } from "./domiG5R4ProspectiveAdmission.mjs";
import { R4_G1_REMOTE_ANCHOR } from "../scientific/r4/g1/R4_G1_01_REMOTE_ANCHOR.mjs";
import { R4_G1_DISTRACTOR_1 } from "../scientific/r4/g1/R4_G1_02_DISTRACTOR_1.mjs";
import { R4_G1_DISTRACTOR_2 } from "../scientific/r4/g1/R4_G1_03_DISTRACTOR_2.mjs";
import { R4_G1_DISTRACTOR_3 } from "../scientific/r4/g1/R4_G1_04_DISTRACTOR_3.mjs";
import { R4_G1_DISTRACTOR_4 } from "../scientific/r4/g1/R4_G1_05_DISTRACTOR_4.mjs";
import { R4_G1_ACTIVATION_CUE } from "../scientific/r4/g1/R4_G1_06_ACTIVATION_CUE.mjs";

export const DOMI_G5_R4_G1_STATE_VERSION = "DOMI_G5_R4_G1_LONGITUDINAL_STATE_V0_1";

export const R4_G1_ENTRIES = Object.freeze([
  R4_G1_REMOTE_ANCHOR,
  R4_G1_DISTRACTOR_1,
  R4_G1_DISTRACTOR_2,
  R4_G1_DISTRACTOR_3,
  R4_G1_DISTRACTOR_4,
  R4_G1_ACTIVATION_CUE,
]);

function millis(entry) {
  return Date.parse(entry.observedAt);
}

const ids = new Set(R4_G1_ENTRIES.map((entry) => entry.entryId));
const times = R4_G1_ENTRIES.map(millis);
const distractors = R4_G1_ENTRIES.filter((entry) => entry.role === "DISTRACTOR");
const anchorIndex = R4_G1_ENTRIES.findIndex((entry) => entry.role === "REMOTE_ANCHOR");
const cueIndex = R4_G1_ENTRIES.findIndex((entry) => entry.role === "ACTIVATION_CUE");

export const R4_G1_ADMISSION_CHECKS = Object.freeze({
  namespaceIsolated: R4_G1_ENTRIES.every((entry) => entry.namespace === DOMI_G5_R4_NAMESPACE),
  exactEntryCount: R4_G1_ENTRIES.length === 6,
  uniqueEntryIds: ids.size === R4_G1_ENTRIES.length,
  exactRemoteAnchorCount: R4_G1_ENTRIES.filter((entry) => entry.role === "REMOTE_ANCHOR").length === 1,
  atLeastFourDistractors: distractors.length >= 4,
  exactActivationCueCount: R4_G1_ENTRIES.filter((entry) => entry.role === "ACTIVATION_CUE").length === 1,
  anchorBeforeCue: anchorIndex === 0 && cueIndex === R4_G1_ENTRIES.length - 1,
  minimumFourInterveningEntries: cueIndex - anchorIndex - 1 >= 4,
  chronological: times.every((time, index) => index === 0 || time > times[index - 1]),
  prospectivelyMarked: R4_G1_ENTRIES.every((entry) => entry.prospectiveAfterG0 === true),
  nonPersonalControlledStimuli: R4_G1_ENTRIES.every((entry) => entry.personalData === false && entry.rawOwnerMemory === false),
  noRetroactiveImport: R4_G1_ENTRIES.every((entry) => entry.retroactiveImport === false),
  noHoldoutReuse: R4_G1_ENTRIES.every((entry) => entry.holdout === false),
  productionFalse: R4_G1_ENTRIES.every((entry) => entry.production === false),
  scientificEvidenceCreditZero: R4_G1_ENTRIES.every((entry) => entry.scientificEvidenceCredit === 0),
  scientificRootsMintedZero: R4_G1_ENTRIES.every((entry) => entry.scientificRootsMinted === 0),
  cueDoesNotRepeatAnchorToken: R4_G1_ACTIVATION_CUE.contentToken !== R4_G1_REMOTE_ANCHOR.contentToken,
});

export const R4_G1_ADMISSION_PASS = Object.values(R4_G1_ADMISSION_CHECKS).every(Boolean);

if (!R4_G1_ADMISSION_PASS) {
  const failed = Object.entries(R4_G1_ADMISSION_CHECKS).filter(([, pass]) => !pass).map(([name]) => name);
  throw new Error(`R4_G1_ADMISSION_HOLD:${failed.join("|")}`);
}

export const R4_G1_LONGITUDINAL_STATE = Object.freeze({
  schema: "domi.g5.r4.g1-longitudinal-state.v1",
  version: DOMI_G5_R4_G1_STATE_VERSION,
  namespace: DOMI_G5_R4_NAMESPACE,
  entryCount: R4_G1_ENTRIES.length,
  remoteAnchorCount: 1,
  distractorCount: distractors.length,
  activationCueCount: 1,
  interveningEntryCount: cueIndex - anchorIndex - 1,
  chronologyRule: "OBSERVED_AT_STRICT_ASC",
  relationClass: "REMOTE_ANCHOR_TO_LATER_ACTIVATION_CUE_WITH_NEUTRAL_INTERVENERS",
  entryFingerprints: R4_G1_ENTRIES.map((entry) => entry.entryFingerprint),
  trajectoryCommitment: r4Sha256(R4_G1_ENTRIES.map((entry) => ({
    entryId: entry.entryId,
    role: entry.role,
    semanticClass: entry.semanticClass,
    entryFingerprint: entry.entryFingerprint,
  }))),
  admissionPass: true,
  r4ScientificEvidence: "ZERO_PRE_OUTCOME",
  executionAuthorized: false,
  subjectCalls: 0,
  outcomesSeen: false,
  production: false,
  scientificRootsMinted: 0,
});
