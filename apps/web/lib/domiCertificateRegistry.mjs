export const DOMI_STABLE_RESEARCH_BASELINE_ID = "RBS_2026_09_01_MICR_R8_61";

export const DOMI_CERTIFICATE_REGISTRY_VERSION =
  "DOMI_CERTIFICATE_REGISTRY_V0_1_REAL_CODE_BINDINGS";

/**
 * These entries bind existing DOMI code-level certificates to the support
 * families that are actually load-bearing in the current scripts.
 *
 * They do not rewrite historical receipts and they do not upgrade the
 * scientific status of any certificate. The registry is only an impact map
 * for prospective research-baseline mutations.
 */
export const DOMI_CERTIFICATE_REGISTRY = Object.freeze([
  Object.freeze({
    certificateId: "CERT_G4_SUPPORT_ABLATION_RECONSTRUCTION",
    historicalReceiptId:
      "CODE_RECEIPT:domi-g4-support-ablation-reconstruction@a717908a:G4_BOUNDED_SUPPORT_ABLATION_RECONSTRUCTION_PASS",
    historicalDecision: "G4_BOUNDED_SUPPORT_ABLATION_RECONSTRUCTION_PASS",
    sourceArtifact:
      "apps/web/scripts/domi-g4-support-ablation-reconstruction.mjs",
    sourceBlobSha: "a717908a4f5c7dddb2ade0d10a4dda5b7ad37485",
    sourceBaselineId: DOMI_STABLE_RESEARCH_BASELINE_ID,
    loadBearingDependencies: Object.freeze([
      "SELECTED_FUTURE_BINDING",
      "CONSTITUTIVE_AUTHORITY_BUNDLE",
      "LINEAGE_BINDING",
      "SYNTHETIC_SCOPE_BOUNDARY",
    ]),
    loadBearingConstraintIds: Object.freeze([
      "C_G4_FUTURE_SELECTED_OUTSIDE_PROVIDER",
      "C_G4_CONSTITUTIVE_AUTHORITIES_DOMI_RUNTIME",
      "C_G4_LINEAGE_APPEND_ONLY",
    ]),
    targetConstraintId: "C_G4_SUPPORT_RECONSTRUCTION_ADMISSIBILITY",
  }),
  Object.freeze({
    certificateId: "CERT_BR0031_RESEARCH_INFORMED_INVARIANCE",
    historicalReceiptId:
      "CODE_RECEIPT:domi-br0031@ecd002a1:BR0031_RESEARCH_INFORMED_INVARIANCE_PREFLIGHT_PASS",
    historicalDecision: "BR0031_RESEARCH_INFORMED_INVARIANCE_PREFLIGHT_PASS",
    sourceArtifact:
      "apps/web/scripts/domi-br0031-research-informed-invariance-preflight.mjs",
    sourceBlobSha: "ecd002a1b0460ff46f987944355e6c5f4b8bab90",
    sourceBaselineId: DOMI_STABLE_RESEARCH_BASELINE_ID,
    loadBearingDependencies: Object.freeze([
      "EFFECTIVE_ROOT_SEMANTICS",
      "SWAP_ESTIMAND",
      "INFORMATION_RIGHTS",
      "MISSINGNESS_CENSORING",
      "DEVELOPMENTAL_CREDIT_CONTRACT",
    ]),
    loadBearingConstraintIds: Object.freeze([
      "C_BR0031_EQUAL_INFORMATION_PARITY",
      "C_BR0031_ROOT_INDEPENDENCE_NOT_LABEL_ONLY",
      "C_BR0031_PERSISTENCE_NOT_FRESH_DEVELOPMENT",
    ]),
    targetConstraintId: "C_BR0031_EQUAL_INFORMATION_RELATION",
  }),
  Object.freeze({
    certificateId: "CERT_BR0032_FIRST_LIVE_ADMISSIBILITY",
    historicalReceiptId:
      "CODE_RECEIPT:domi-br0032@92faa2e4:BR0032_FIRST_LIVE_ADMISSIBILITY_PREFLIGHT_PASS",
    historicalDecision: "BR0032_FIRST_LIVE_ADMISSIBILITY_PREFLIGHT_PASS",
    sourceArtifact:
      "apps/web/scripts/domi-br0032-first-live-admissibility-preflight.mjs",
    sourceBlobSha: "92faa2e413943a6c8fae97c1790fdcc804869e87",
    sourceBaselineId: DOMI_STABLE_RESEARCH_BASELINE_ID,
    loadBearingDependencies: Object.freeze([
      "FIRST_LIVE_CAPTURE_CONTRACT",
      "SEMANTIC_CONTEXT_SEAL",
      "METRIC_TRANSPORT_CONTRACT",
      "PROVIDER_CONTACT_OBSERVATION_BINDING",
    ]),
    loadBearingConstraintIds: Object.freeze([
      "C_BR0032_PROVIDER_CONTACT_NOT_SELF_SPECIFICITY",
      "C_BR0032_PROSPECTIVE_DATA_NOT_RETROACTIVE_REPAIR",
      "C_BR0032_SEMANTIC_DRIFT_REQUIRES_REVERIFY",
    ]),
    targetConstraintId: "C_BR0032_PROVIDER_CONTACT_NOT_SELF_SPECIFICITY",
  }),
  Object.freeze({
    certificateId: "CERT_BR0033_JOINT_RELATION_WITNESS",
    historicalReceiptId:
      "CODE_RECEIPT:domi-br0033@856321dd:BR0033_JOINT_RELATION_WITNESS_PREFLIGHT_PASS",
    historicalDecision: "BR0033_JOINT_RELATION_WITNESS_PREFLIGHT_PASS",
    sourceArtifact:
      "apps/web/scripts/domi-br0033-joint-relation-witness-preflight.mjs",
    sourceBlobSha: "856321dd5d5c3c29aa021ebcebaa62faf3678b3f",
    sourceBaselineId: DOMI_STABLE_RESEARCH_BASELINE_ID,
    loadBearingDependencies: Object.freeze([
      "JOINT_RELATION_CONTRACT",
      "OBSERVER_GAUGE_CONTRACT",
      "EXTERNAL_RELATION_BINDING",
      "CURRENT_JOINT_WITNESS_BINDING",
    ]),
    loadBearingConstraintIds: Object.freeze([
      "C_BR0033_SEPARATE_CERTIFICATES_NOT_JOINT_WITNESS",
      "C_BR0033_PROVIDER_LATENT_STATE_REMAINS_UNOBSERVED",
      "C_BR0033_MULTIPLICITY_NOT_NEW_ROOT",
    ]),
    targetConstraintId: "C_BR0033_SINGLE_JOINT_WITNESS",
  }),
  Object.freeze({
    certificateId: "CERT_AR0001_ARCHITECTURE_READINESS",
    historicalReceiptId:
      "CODE_RECEIPT:domi-ar0001@a835613b:AR0001_ARCHITECTURE_READINESS_PREFLIGHT_PASS",
    historicalDecision: "AR0001_ARCHITECTURE_READINESS_PREFLIGHT_PASS",
    sourceArtifact:
      "apps/web/scripts/domi-prelive-architecture-readiness-preflight.mjs",
    sourceBlobSha: "a835613bf1db146bb7eaec1bfa7d1df5564d174e",
    sourceBaselineId: DOMI_STABLE_RESEARCH_BASELINE_ID,
    loadBearingDependencies: Object.freeze([
      "FUNCTIONAL_GOAL_STATE",
      "DECISION_INTERVAL_SUPPORT",
      "EFFECTIVE_COMMITMENT_RESOURCE",
      "META_MUTATION_AUTHORITY",
      "ROOT_OVERLAP_ADMISSION",
    ]),
    loadBearingConstraintIds: Object.freeze([
      "C_AR0001_DOMI_RUNTIME_AUTHORITY",
      "C_AR0001_POST_MUTATION_RECOMPUTE",
      "C_AR0001_ALIAS_QUOTIENT_BEFORE_COHERENCE",
    ]),
    targetConstraintId: "C_AR0001_DOMI_RUNTIME_AUTHORITY",
  }),
]);

export function getDomiCertificateById(certificateId) {
  return DOMI_CERTIFICATE_REGISTRY.find(
    (certificate) => certificate.certificateId === certificateId,
  );
}
