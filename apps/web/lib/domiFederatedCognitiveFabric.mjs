export const DOMI_FCF_VERSION = "DOMI_FEDERATED_COGNITIVE_FABRIC_V0_1";

export const CONSEQUENCE_WEIGHT = Object.freeze({
  LOW: 0,
  MEDIUM: 0.15,
  HIGH: 0.35,
  CRITICAL: 0.6,
});

export const PRIVACY_RANK = Object.freeze({
  PUBLIC: 0,
  HOUSEHOLD: 1,
  PRIVATE_SELF: 2,
  RESTRICTED: 3,
});

export function normalizeEngine(engine) {
  if (!engine?.id) throw new Error("ENGINE_ID_REQUIRED");
  return Object.freeze({
    id: engine.id,
    provider: engine.provider ?? "LOCAL_OR_INTERNAL",
    capabilities: Object.freeze([...(engine.capabilities ?? [])]),
    modalities: Object.freeze([...(engine.modalities ?? ["text"])]),
    maxPrivacyClass: engine.maxPrivacyClass ?? "PUBLIC",
    quality: Number(engine.quality ?? 0.5),
    speed: Number(engine.speed ?? 0.5),
    costEfficiency: Number(engine.costEfficiency ?? 0.5),
    specialization: Number(engine.specialization ?? 0.5),
    enabled: engine.enabled !== false,
    paidRoute: engine.paidRoute === true,
    ownerApprovedPaidRoute: engine.ownerApprovedPaidRoute === true,
    constitutiveAuthority: false,
  });
}

export function engineIsAdmissible(engine, task) {
  if (!engine.enabled) return { admissible: false, reason: "ENGINE_DISABLED" };
  if (engine.constitutiveAuthority === true) return { admissible: false, reason: "ENGINE_MAY_NOT_HOLD_CONSTITUTIVE_AUTHORITY" };
  if (engine.paidRoute && !engine.ownerApprovedPaidRoute) return { admissible: false, reason: "PAID_ROUTE_NOT_OWNER_APPROVED" };

  const requiredCapabilities = task.requiredCapabilities ?? [];
  const missing = requiredCapabilities.filter((cap) => !engine.capabilities.includes(cap));
  if (missing.length) return { admissible: false, reason: "MISSING_CAPABILITY", detail: missing };

  const modality = task.modality ?? "text";
  if (!engine.modalities.includes(modality)) return { admissible: false, reason: "MODALITY_UNSUPPORTED" };

  const requiredPrivacy = PRIVACY_RANK[task.privacyClass ?? "PUBLIC"] ?? 0;
  const enginePrivacy = PRIVACY_RANK[engine.maxPrivacyClass ?? "PUBLIC"] ?? 0;
  if (enginePrivacy < requiredPrivacy) return { admissible: false, reason: "PRIVACY_CLASS_TOO_LOW" };

  return { admissible: true, reason: "ADMISSIBLE" };
}

export function scoreEngine(engine, task) {
  const fit = (task.requiredCapabilities ?? []).length === 0
    ? 1
    : (task.requiredCapabilities ?? []).filter((cap) => engine.capabilities.includes(cap)).length /
      (task.requiredCapabilities ?? []).length;

  const requiredQuality = Number(task.requiredQuality ?? 0.5);
  const complexity = Number(task.complexity ?? 0.5);
  const latencyPreference = Number(task.latencyPreference ?? 0.5);
  const costPreference = Number(task.costPreference ?? 0.5);
  const specializationNeed = Number(task.specializationNeed ?? complexity);
  const consequence = CONSEQUENCE_WEIGHT[task.consequenceClass ?? "LOW"] ?? 0;

  const qualityScore = 1 - Math.min(1, Math.abs(engine.quality - requiredQuality));
  const speedScore = engine.speed * latencyPreference + (1 - latencyPreference) * 0.5;
  const costScore = engine.costEfficiency * costPreference + (1 - costPreference) * 0.5;
  const specializationScore = engine.specialization * specializationNeed + (1 - specializationNeed) * 0.5;
  const highConsequenceQualityBonus = consequence * engine.quality;

  const score =
    0.3 * fit +
    0.23 * qualityScore +
    0.14 * speedScore +
    0.13 * costScore +
    0.12 * specializationScore +
    0.08 * highConsequenceQualityBonus;

  return Number(score.toFixed(6));
}

export function routeCognitiveTask({ task, engines }) {
  if (!task?.id) throw new Error("TASK_ID_REQUIRED");
  const normalized = engines.map(normalizeEngine);
  const evaluations = normalized.map((engine) => {
    const admissibility = engineIsAdmissible(engine, task);
    return {
      engineId: engine.id,
      provider: engine.provider,
      admissible: admissibility.admissible,
      reason: admissibility.reason,
      detail: admissibility.detail ?? null,
      score: admissibility.admissible ? scoreEngine(engine, task) : null,
    };
  });

  const candidates = evaluations
    .filter((entry) => entry.admissible)
    .sort((a, b) => b.score - a.score || a.engineId.localeCompare(b.engineId));

  if (!candidates.length) {
    return Object.freeze({
      fabricVersion: DOMI_FCF_VERSION,
      taskId: task.id,
      decision: "HOLD_NO_ADMISSIBLE_ROUTE",
      selectedEngineId: null,
      evaluations: Object.freeze(evaluations),
      constitutiveAuthorityTransferred: false,
    });
  }

  const selected = candidates[0];
  return Object.freeze({
    fabricVersion: DOMI_FCF_VERSION,
    taskId: task.id,
    decision: "ROUTE_SELECTED",
    selectedEngineId: selected.engineId,
    selectedProvider: selected.provider,
    selectedScore: selected.score,
    evaluations: Object.freeze(evaluations),
    constitutiveAuthorityTransferred: false,
  });
}
