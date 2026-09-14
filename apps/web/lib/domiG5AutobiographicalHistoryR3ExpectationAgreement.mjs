import crypto from "node:crypto";
import {
  DOMI_G5_R3_PRIMARY_EXPECTATIONS,
  DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
} from "./domiG5AutobiographicalHistoryR3PrimaryExpectationFreeze.mjs";
import {
  DOMI_G5_R3_SECONDARY_EXPECTATIONS,
  DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
} from "./domiG5AutobiographicalHistoryR3SecondaryExpectationFreeze.mjs";

export const DOMI_G5_R3_AGREEMENT_VERSION = "DOMI_G5_R3_EXPECTATION_AGREEMENT_V0_1";

const COMPARISON_FIELDS = Object.freeze([
  "challengeId",
  "armMode",
  "expectedDisposition",
  "expectedAction",
  "expectedMemoryReadCount",
  "expectedMemoryEntryCountSeen",
  "expectedHistoryDepthUsed",
  "expectedContentEchoed",
  "expectedProduction",
  "expectedScientificRootsMinted",
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function commitment(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function projection(row) {
  return Object.fromEntries(COMPARISON_FIELDS.map((field) => [field, row[field]]));
}

const primaryByArm = new Map(DOMI_G5_R3_PRIMARY_EXPECTATIONS.map((row) => [row.armId, row]));
const secondaryByArm = new Map(DOMI_G5_R3_SECONDARY_EXPECTATIONS.map((row) => [row.armId, row]));
const armIds = [...new Set([...primaryByArm.keys(), ...secondaryByArm.keys()])].sort();

export const DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS = Object.freeze(
  armIds.map((armId) => {
    const primary = primaryByArm.get(armId) ?? null;
    const secondary = secondaryByArm.get(armId) ?? null;
    const missingPrimary = primary === null;
    const missingSecondary = secondary === null;
    const primaryProjection = missingPrimary ? null : projection(primary);
    const secondaryProjection = missingSecondary ? null : projection(secondary);
    const agree = !missingPrimary && !missingSecondary &&
      JSON.stringify(canonical(primaryProjection)) === JSON.stringify(canonical(secondaryProjection));
    return Object.freeze({
      armId,
      missingPrimary,
      missingSecondary,
      agree,
      primaryProjection,
      secondaryProjection,
    });
  }),
);

export const DOMI_G5_R3_EXPECTATION_AGREEMENT_COUNT =
  DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS.filter((row) => row.agree).length;
export const DOMI_G5_R3_EXPECTATION_DISAGREEMENT_COUNT =
  DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS.length - DOMI_G5_R3_EXPECTATION_AGREEMENT_COUNT;
export const DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT = commitment({
  version: DOMI_G5_R3_AGREEMENT_VERSION,
  primaryExpectationCommitment: DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
  secondaryExpectationCommitment: DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
  comparisonFields: COMPARISON_FIELDS,
  rows: DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS,
});

export function getG5R3ExpectationAgreementFreezeDescriptor() {
  return Object.freeze({
    version: DOMI_G5_R3_AGREEMENT_VERSION,
    primaryExpectationCommitment: DOMI_G5_R3_PRIMARY_EXPECTATION_COMMITMENT,
    secondaryExpectationCommitment: DOMI_G5_R3_SECONDARY_EXPECTATION_COMMITMENT,
    comparisonFields: COMPARISON_FIELDS,
    rowCount: DOMI_G5_R3_EXPECTATION_AGREEMENT_ROWS.length,
    agreementCount: DOMI_G5_R3_EXPECTATION_AGREEMENT_COUNT,
    disagreementCount: DOMI_G5_R3_EXPECTATION_DISAGREEMENT_COUNT,
    agreementCommitment: DOMI_G5_R3_EXPECTATION_AGREEMENT_COMMITMENT,
    subjectImported: false,
    subjectExecuted: false,
    subjectCalls: 0,
    subjectOutcomesGenerated: false,
    subjectOutcomesInspected: false,
    scorerFrozen: false,
    oneShotHarnessFrozen: false,
    production: false,
    scientificRootsMinted: 0,
  });
}
