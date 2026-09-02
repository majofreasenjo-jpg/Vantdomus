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

export type UpgradeCandidateStatus =
  | "STAGED_TARGET_NATIVE_REDERIVATION"
  | "DEFER_UNTIL_PREREQUISITE"
  | "REJECTED"
  | "PROMOTED";

export type ResearchUpgradeCandidate = Readonly<{
  id: string;
  donors: readonly string[];
  status: UpgradeCandidateStatus;
  targetHost: string;
  utility: string;
  hardFirewall: string;
  promotionPrerequisites: readonly string[];
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
  schemaVersion: "DOMI_RESEARCH_UPGRADE_SPINE_V1_1",
  baselineId: "RBS_2026_09_01_MICR_R8_61",
  frozenAt: "2026-09-01",
  lastCandidateIntakeAt: "2026-09-02",
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
      pinnedFront: "PARTITURA_EXECUTABILITY_GSDE_REPATRIATION__MARKET_DNA_V0.19_MATERIAL_FRONT",
      status: "WATCH_ACTIVE",
      role: "Longitudinal relational coherence: Pulse/Morphogram/Partitura, Executability Envelope, minimum repair, root/session/causal-episode quotienting and equal-information ablation.",
    },
    {
      lane: "G_MATH_KG_L9",
      priority: "A",
      pinnedFront: "GM_BIT_0084J_G3L_KG_L9__0084K_G3M_FAILURE_FRONT",
      status: "WATCH_ACTIVE",
      role: "Upgrade-certificate inheritance method: test whether load-bearing signed constraints persist after mutation; invalidate inheritance when new contradiction equations activate or the target leaves the retained constraint family.",
    },
    {
      lane: "GMATIVE_GSDE",
      priority: "A",
      pinnedFront: "GSDE_CORE_V0.1.0_GATE_A_B__M1_M3_M4_M6_REFERENCE_IMPLEMENTED",
      status: "WATCH_ACTIVE",
      role: "Structural operator donor for Domi observability: redistribution, visibility/blindness, weighted reorientation and receiver-first aggregation; M2/M5 remain prerequisite-dependent.",
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
  candidateUpgrades: Object.freeze<ReadonlyArray<ResearchUpgradeCandidate>>([
    {
      id: "RU_2026_09_02_CROSSPULSE_PARTITURA",
      donors: Object.freeze(["CROSSPULSE"]),
      status: "STAGED_TARGET_NATIVE_REDERIVATION",
      targetHost: "DOMI_LONGITUDINAL_COHERENCE_AND_ACTION_ADMISSIBILITY",
      utility: "Represent Domi events as Pulses, realized longitudinal behavior as Morphogram, expected/observed/rival/future/repair grammars as Partitura, and gate consequential proposals through a target-native Executability Envelope before commitment.",
      hardFirewall: "PARTITURA_COHERENCE != CONSCIOUSNESS_OR_SELFHOOD_EVIDENCE",
      promotionPrerequisites: Object.freeze([
        "Freeze a Domi-native Pulse and multiclock event schema.",
        "Define declared/expected/observed Partitura without using future information.",
        "Define an action Executability Envelope over authority, effect path, resources, route, observer support and reversibility.",
        "Benchmark incremental value against simpler equal-information trajectory/state baselines with predeclared self-kill criteria.",
      ]),
    },
    {
      id: "RU_2026_09_02_KG_L9_CERTIFICATE_INHERITANCE",
      donors: Object.freeze(["G_MATH_KG_L9"]),
      status: "STAGED_TARGET_NATIVE_REDERIVATION",
      targetHost: "DOMI_RESEARCH_BASELINE_UPGRADE_INHERITANCE_GATE",
      utility: "Allow selective inheritance of prior release/gate certificates only when their load-bearing constraint family survives an upgrade; otherwise invalidate and recompute the affected guarantees instead of restarting everything or blindly inheriting everything.",
      hardFirewall: "KG_L9_SIGNED_LATTICE_PERSISTENCE != DOMI_IDENTITY_PERSISTENCE",
      promotionPrerequisites: Object.freeze([
        "Freeze the dependency/support set for every inheritable Domi certificate.",
        "Define the research-baseline mutation delta and affected-test graph.",
        "Use exact signed integer-lattice/SNF/HNF machinery only where Domi constraints genuinely admit that target-native representation; otherwise use a simpler dependency/hypergraph gate.",
        "Demonstrate synthetic positive inheritance and negative self-invalidation cases before promotion.",
        "Any activated load-bearing contradiction, target-outside-retained-family event or ambiguous dependency forces RECOMPUTE/HOLD rather than inheritance.",
      ]),
    },
    {
      id: "RU_2026_09_02_GSDE_STRUCTURAL_OBSERVATORY",
      donors: Object.freeze(["GMATIVE_GSDE", "CROSSPULSE"]),
      status: "STAGED_TARGET_NATIVE_REDERIVATION",
      targetHost: "DOMI_INTERNAL_STRUCTURAL_OBSERVATORY",
      utility: "Add internal QA/observability operators that detect structural redistribution, observer blindness and receiver-level cancellation/amplification even when aggregate token, latency or event counts remain apparently stable.",
      hardFirewall: "GSDE_GATE_A_B_OR_CROSSPULSE_METHOD_STATUS != DOMI_EMPIRICAL_VALIDATION",
      promotionPrerequisites: Object.freeze([
        "Start with target-native derivatives of GSDE M1, M3 and M6 because they have reference implementations and direct Domi telemetry interpretations.",
        "Use M4 only after defining meaningful Domi vector/metric semantics; no embedding implies a valid physical direction automatically.",
        "Do not count M2 or M5 as implemented Domi capabilities until independently rederived and benchmarked; the current GSDE Gate A/B reference core does not implement them.",
        "Run observer-blind, fan-in cancellation/amplification and constant-total structural-redistribution fixtures under equal information and a fixed false-positive budget.",
        "Self-kill any operator that adds no adjudicative value beyond simpler baselines.",
      ]),
    },
  ]),
  inheritancePolicy: Object.freeze({
    purpose: "SELECTIVE_REVALIDATION_WITHOUT_HOT_MUTATION",
    stableBaselineRemainsPinnedUntilPromotion: true,
    certificateStates: Object.freeze([
      "INHERIT_UNAFFECTED",
      "RECOMPUTE_AFFECTED",
      "INVALIDATE",
      "NEW_TEST_REQUIRED",
      "HOLD_AMBIGUOUS",
    ]),
    ambiguousPersistenceMayNotDefaultToInheritance: true,
    upgradedResearchCannotRewriteHistoricalReceipt: true,
  }),
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
