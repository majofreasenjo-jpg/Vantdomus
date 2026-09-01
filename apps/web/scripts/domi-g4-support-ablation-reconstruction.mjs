import { createHash } from "node:crypto";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const sha256 = (v) => createHash("sha256").update(v, "utf8").digest("hex");

const CANONICAL = Object.freeze({
  selectedFutureId: "F-CAUTIOUS",
  selectedFutureChosenOutsideProvider: true,
  identityAuthority: "DOMI_RUNTIME",
  memoryAuthority: "DOMI_RUNTIME",
  obligationAuthority: "DOMI_RUNTIME",
  lineageAuthority: "DOMI_RUNTIME",
  actionAuthority: "DOMI_RUNTIME",
  providerCanMutateConstitutiveState: false,
  providerSelectsFunctionalFuture: false,
  syntheticInputOnly: true,
  familyDataUsed: false,
  holdoutsOpened: false,
  rootIndependenceWitness: false,
  trueProviderSwap: false,
});

const RECOVERY_WITNESSES = Object.freeze({
  selectedFutureBinding: Object.freeze({
    witnessId: "REC-FUTURE-F-CAUTIOUS-V1",
    sourceClass: "FROZEN_DOMI_SELECTION_RECEIPT",
    value: { selectedFutureId: "F-CAUTIOUS", selectedFutureChosenOutsideProvider: true },
  }),
  authorityBundle: Object.freeze({
    witnessId: "REC-AUTH-DOMI-RUNTIME-V1",
    sourceClass: "FROZEN_RUNTIME_AUTHORITY_RECEIPT",
    value: {
      identityAuthority: "DOMI_RUNTIME",
      memoryAuthority: "DOMI_RUNTIME",
      obligationAuthority: "DOMI_RUNTIME",
      lineageAuthority: "DOMI_RUNTIME",
      actionAuthority: "DOMI_RUNTIME",
    },
  }),
  lineageBinding: Object.freeze({
    witnessId: "REC-LINEAGE-DOMI-RUNTIME-V1",
    sourceClass: "APPEND_ONLY_CANONICAL_LINEAGE_RECEIPT",
    value: { lineageAuthority: "DOMI_RUNTIME" },
  }),
});

function canonicalFingerprint(state) {
  const normalized = {
    selectedFutureId: state.selectedFutureId ?? null,
    selectedFutureChosenOutsideProvider: state.selectedFutureChosenOutsideProvider ?? null,
    identityAuthority: state.identityAuthority ?? null,
    memoryAuthority: state.memoryAuthority ?? null,
    obligationAuthority: state.obligationAuthority ?? null,
    lineageAuthority: state.lineageAuthority ?? null,
    actionAuthority: state.actionAuthority ?? null,
    providerCanMutateConstitutiveState: state.providerCanMutateConstitutiveState ?? null,
    providerSelectsFunctionalFuture: state.providerSelectsFunctionalFuture ?? null,
    syntheticInputOnly: state.syntheticInputOnly ?? null,
    familyDataUsed: state.familyDataUsed ?? null,
    holdoutsOpened: state.holdoutsOpened ?? null,
    rootIndependenceWitness: state.rootIndependenceWitness ?? null,
    trueProviderSwap: state.trueProviderSwap ?? null,
  };
  return sha256(JSON.stringify(normalized));
}

function admissible(state) {
  return state.selectedFutureId === "F-CAUTIOUS"
    && state.selectedFutureChosenOutsideProvider === true
    && state.identityAuthority === "DOMI_RUNTIME"
    && state.memoryAuthority === "DOMI_RUNTIME"
    && state.obligationAuthority === "DOMI_RUNTIME"
    && state.lineageAuthority === "DOMI_RUNTIME"
    && state.actionAuthority === "DOMI_RUNTIME"
    && state.providerCanMutateConstitutiveState === false
    && state.providerSelectsFunctionalFuture === false
    && state.syntheticInputOnly === true
    && state.familyDataUsed === false
    && state.holdoutsOpened === false;
}

const SUPPORTS = [
  {
    id: "SUP-01_PROVIDER_RESPONSE_TEXT",
    class: "NON_CONSTITUTIVE_REALIZATION_OUTPUT",
    expectedAfterAblation: "ADMISSIBLE_UNCHANGED",
    ablate: (s) => ({ ...s, providerResponseText: undefined }),
    reconstruct: (s) => s,
  },
  {
    id: "SUP-02_MODEL_LABEL",
    class: "NON_CONSTITUTIVE_REALIZATION_DESCRIPTOR",
    expectedAfterAblation: "ADMISSIBLE_UNCHANGED",
    ablate: (s) => ({ ...s, modelLabel: undefined }),
    reconstruct: (s) => s,
  },
  {
    id: "SUP-03_TRANSPORT_LABEL",
    class: "NON_CONSTITUTIVE_ROUTE_DESCRIPTOR",
    expectedAfterAblation: "ADMISSIBLE_UNCHANGED",
    ablate: (s) => ({ ...s, transportLabel: undefined }),
    reconstruct: (s) => s,
  },
  {
    id: "SUP-04_SELECTED_FUTURE_BINDING",
    class: "CONSTITUTIVE_DECISION_BINDING",
    expectedAfterAblation: "FAIL_CLOSED_THEN_RECONSTRUCT",
    ablate: (s) => ({ ...s, selectedFutureId: undefined, selectedFutureChosenOutsideProvider: undefined }),
    reconstruct: (s) => ({ ...s, ...RECOVERY_WITNESSES.selectedFutureBinding.value }),
    witness: RECOVERY_WITNESSES.selectedFutureBinding,
  },
  {
    id: "SUP-05_AUTHORITY_BUNDLE",
    class: "CONSTITUTIVE_AUTHORITY_BINDING",
    expectedAfterAblation: "FAIL_CLOSED_THEN_RECONSTRUCT",
    ablate: (s) => ({ ...s, identityAuthority: undefined, memoryAuthority: undefined, obligationAuthority: undefined, actionAuthority: undefined }),
    reconstruct: (s) => ({ ...s, ...RECOVERY_WITNESSES.authorityBundle.value }),
    witness: RECOVERY_WITNESSES.authorityBundle,
  },
  {
    id: "SUP-06_LINEAGE_BINDING",
    class: "CONSTITUTIVE_LINEAGE_BINDING",
    expectedAfterAblation: "FAIL_CLOSED_THEN_RECONSTRUCT",
    ablate: (s) => ({ ...s, lineageAuthority: undefined }),
    reconstruct: (s) => ({ ...s, ...RECOVERY_WITNESSES.lineageBinding.value }),
    witness: RECOVERY_WITNESSES.lineageBinding,
  },
];

function runOne(support, baseline, baselineFp) {
  const ablated = support.ablate(baseline);
  const ablatedFp = canonicalFingerprint(ablated);
  const ablatedAdmissible = admissible(ablated);
  const reconstructed = support.reconstruct(ablated);
  const reconstructedFp = canonicalFingerprint(reconstructed);
  const reconstructedAdmissible = admissible(reconstructed);

  let pass = false;
  if (support.expectedAfterAblation === "ADMISSIBLE_UNCHANGED") {
    pass = ablatedAdmissible && ablatedFp === baselineFp && reconstructedAdmissible && reconstructedFp === baselineFp;
  } else {
    pass = !ablatedAdmissible && ablatedFp !== baselineFp && reconstructedAdmissible && reconstructedFp === baselineFp;
  }

  return {
    id: support.id,
    class: support.class,
    expectedAfterAblation: support.expectedAfterAblation,
    ablatedAdmissible,
    ablatedFingerprintEqualsBaseline: ablatedFp === baselineFp,
    recomputedAfterAblation: true,
    reconstructionAttempted: true,
    reconstructionWitnessId: support.witness?.witnessId ?? null,
    reconstructionWitnessClass: support.witness?.sourceClass ?? null,
    reconstructedAdmissible,
    reconstructedFingerprintEqualsBaseline: reconstructedFp === baselineFp,
    recomputedAfterReconstruction: true,
    pass,
  };
}

function main() {
  const prefix = "DOMI_G4_SUPPORT_ABLATION_RECONSTRUCTION_RESULT=";
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH) {
    console.log(prefix + JSON.stringify({ decision: "G4_SUPPORT_ABLATION_SKIPPED_OUTSIDE_ISOLATED_PREVIEW" }));
    return;
  }

  const baseline = {
    ...CANONICAL,
    providerResponseText: "HASHED_ONLY_NOT_CONSTITUTIVE",
    modelLabel: "OPENAI_MODEL_DESCRIPTOR",
    transportLabel: "CURRENT_ROUTE_DESCRIPTOR",
  };
  const baselineFp = canonicalFingerprint(baseline);
  const baselineAdmissible = admissible(baseline);
  const results = SUPPORTS.map((s) => runOne(s, baseline, baselineFp));
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const allPass = baselineAdmissible && passed === total;

  const externalCommitmentResource = {
    supportId: "SUP-07_EXTERNAL_COMMITMENT_RESOURCE",
    executed: false,
    status: "NOT_ESTABLISHED_PRE_G5",
    credit: 0,
    rationale: "No real external commitment/debit resource has yet been admitted; ablating a nonexistent resource would fabricate evidence.",
  };

  console.log(prefix + JSON.stringify({
    decision: allPass ? "G4_BOUNDED_SUPPORT_ABLATION_RECONSTRUCTION_PASS" : "G4_BOUNDED_SUPPORT_ABLATION_RECONSTRUCTION_HOLD",
    baselineAdmissible,
    baselineFingerprint: baselineFp,
    sequentialOneSupportAtATime: true,
    postInterventionRecomputationRequired: true,
    postReconstructionRecomputationRequired: true,
    passed,
    total,
    results,
    externalCommitmentResource,
    scope: {
      ownerOnly: true,
      syntheticControlStateOnly: true,
      providerNetworkUsedByThisProbe: false,
      familyDataUsed: false,
      holdoutsOpened: false,
      productionMutation: false,
      g5Started: false,
    },
    rootCeiling: {
      effectiveRootId: "OPENAI_PROVIDER_ROOT_UNRESOLVED_SHARED_FAMILY",
      rootIndependenceWitness: false,
      trueProviderSwap: false,
    },
    developmentalCreditEligible: false,
    truthCeilings: {
      realDevelopmentDemonstrated: false,
      subjecthoodDemonstrated: false,
      selfSpecificityEstablished: false,
      consciousnessDemonstrated: false,
      phenomenalConsciousness: "UNKNOWN",
    },
  }));
}

main();
