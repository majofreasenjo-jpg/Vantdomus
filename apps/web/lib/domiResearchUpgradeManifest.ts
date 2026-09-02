export type ResearchLaneStatus =
  | "PINNED_BASELINE"
  | "WATCH_ACTIVE"
  | "READY_NOT_EXECUTED"
  | "METHOD_ONLY"
  | "ZERO_FRESH_CREDIT";

export type ResearchLane = Readonly<{
  lane: string;
  priority: "A+" | "A" | "B+" | "B";
  pinnedFront: string;
  status: ResearchLaneStatus;
  role: string;
}>;

/**
 * DOMI Research Upgrade Spine
 *
 * Product releases consume a PINNED research baseline. New scientific/mathematical
 * work is observed continuously but never mutates a released runtime implicitly.
 * Every upgrade must be re-derived target-natively and pass compatibility/regression
 * checks before promotion.
 *
 * METHOD_TRANSFER != EVIDENCE_TRANSFER
 * ARCHITECTURE_TRANSFER != VALIDATION_TRANSFER
 * PRODUCT_SUCCESS != SCIENTIFIC_VALIDATION
 */
export const DOMI_RESEARCH_UPGRADE_MANIFEST = Object.freeze({
  schemaVersion: "DOMI_RESEARCH_UPGRADE_SPINE_V1",
  baselineId: "RBS_2026_09_01_MICR_R8_61",
  frozenAt: "2026-09-01",
  productPolicy: "OPENAI_FIRST_STABLE_RUNTIME",
  releasePolicy: "PIN_BASELINE_THEN_UPGRADE_PROSPECTIVELY",
  researchNeverHotMutatesReleasedRuntime: true,
  g5ScientificGateIndependentFromProductAlpha: true,
  claimWall: Object.freeze({
    realDevelopmentDemonstrated: false,
    subjecthoodDemonstrated: false,
    selfSpecificityEstablished: false,
    consciousnessDemonstrated: false,
    phenomenalConsciousness: "UNKNOWN",
  }),
  lanes: Object.freeze<ReadonlyArray<ResearchLane>>([
    {
      lane: "MICR",
      priority: "A+",
      pinnedFront: "R8.61_COMPLETE__R8.62_READY_NOT_EXECUTED",
      status: "PINNED_BASELINE",
      role: "Primary adaptation lead: effective-root ancestry, symmetry breaking, identified-set and reconstruction discipline.",
    },
    {
      lane: "MRAE",
      priority: "A",
      pinnedFront: "GATE22_PASS_INTERNAL__GATE23_DISCOVERY_SCREEN",
      status: "WATCH_ACTIVE",
      role: "Independence hard gates, authorization, external-role separation and fail-closed adjudication.",
    },
    {
      lane: "CEIRI",
      priority: "A",
      pinnedFront: "G6D_ACLR",
      status: "WATCH_ACTIVE",
      role: "Tested-vs-operating configuration, current action path and evidence-receipt discipline.",
    },
    {
      lane: "CROSSPULSE_MARKET_DNA",
      priority: "A",
      pinnedFront: "T3B__MARKET_DNA_V0.19_MATERIAL_FRONT",
      status: "WATCH_ACTIVE",
      role: "Root/provider-family/session/causal-episode quotienting, equal-information ablation and evidence rank.",
    },
    {
      lane: "PPAR_NS",
      priority: "B+",
      pinnedFront: "SF54_CLOSED__SRE113_ACTIVE",
      status: "WATCH_ACTIVE",
      role: "Narrow no-go discipline, mechanism-vs-envelope separation and support-scale rigor.",
    },
    {
      lane: "BIOCLIMATOGENESIS",
      priority: "B",
      pinnedFront: "BC2_GR003_PREREGISTRATION_FREEZE",
      status: "METHOD_ONLY",
      role: "Equivalent-root identified sets, intervention/recoverability and causal-authority discipline.",
    },
    {
      lane: "URDP_CLIMATOGENESIS",
      priority: "B",
      pinnedFront: "URDP_CUT_G__CLIMATOGENESIS_H19_METHOD_FRONT",
      status: "METHOD_ONLY",
      role: "Cross-stream clock, temporal-support and causal-resolution discipline.",
    },
    {
      lane: "VIGIA",
      priority: "B",
      pinnedFront: "D116_D117",
      status: "METHOD_ONLY",
      role: "Current-decision participation, recomputation after material mutation and right-output/wrong-reason testing.",
    },
  ]),
  upgradeContract: Object.freeze({
    candidateDoesNotMutateStableRelease: true,
    donorResultDoesNotTransferAsTargetEvidence: true,
    requiresTargetNativeRederivation: true,
    requiresCompatibilityCheck: true,
    requiresRegressionCheck: true,
    requiresClaimCeilingRecheck: true,
    requiresExplicitPromotionReceipt: true,
    possibleAdjudications: Object.freeze([
      "PROMOTE",
      "DEFER",
      "REJECT",
      "IDENTIFIED_SET",
      "HOLD",
    ]),
  }),
});

export function getDomiResearchUpgradeStatus() {
  return DOMI_RESEARCH_UPGRADE_MANIFEST;
}
