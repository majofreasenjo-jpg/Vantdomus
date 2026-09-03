import test from "node:test";
import assert from "node:assert/strict";
import { routeCognitiveTask } from "../lib/domiFederatedCognitiveFabric.mjs";

const engines = [
  {
    id: "fast-general",
    provider: "OPENAI",
    capabilities: ["general_reasoning", "files"],
    modalities: ["text"],
    maxPrivacyClass: "PRIVATE_SELF",
    quality: 0.72,
    speed: 0.95,
    costEfficiency: 0.95,
    specialization: 0.35,
  },
  {
    id: "deep-general",
    provider: "OPENAI",
    capabilities: ["general_reasoning", "files", "deep_reasoning"],
    modalities: ["text"],
    maxPrivacyClass: "RESTRICTED",
    quality: 0.96,
    speed: 0.45,
    costEfficiency: 0.35,
    specialization: 0.8,
  },
  {
    id: "local-private",
    provider: "LOCAL",
    capabilities: ["general_reasoning"],
    modalities: ["text"],
    maxPrivacyClass: "RESTRICTED",
    quality: 0.65,
    speed: 0.7,
    costEfficiency: 1,
    specialization: 0.4,
  },
  {
    id: "unapproved-paid",
    provider: "OTHER",
    capabilities: ["general_reasoning", "deep_reasoning"],
    modalities: ["text"],
    maxPrivacyClass: "RESTRICTED",
    quality: 1,
    speed: 1,
    costEfficiency: 1,
    specialization: 1,
    paidRoute: true,
    ownerApprovedPaidRoute: false,
  },
];

test("routes simple low-consequence task to faster cheaper general engine", () => {
  const result = routeCognitiveTask({
    task: {
      id: "t-simple",
      requiredCapabilities: ["general_reasoning"],
      privacyClass: "PUBLIC",
      complexity: 0.15,
      requiredQuality: 0.68,
      latencyPreference: 1,
      costPreference: 1,
      specializationNeed: 0.1,
      consequenceClass: "LOW",
    },
    engines,
  });
  assert.equal(result.decision, "ROUTE_SELECTED");
  assert.equal(result.selectedEngineId, "fast-general");
  assert.equal(result.constitutiveAuthorityTransferred, false);
});

test("routes deep high-consequence task to high-quality engine", () => {
  const result = routeCognitiveTask({
    task: {
      id: "t-deep",
      requiredCapabilities: ["general_reasoning", "deep_reasoning"],
      privacyClass: "PRIVATE_SELF",
      complexity: 0.95,
      requiredQuality: 0.95,
      latencyPreference: 0.1,
      costPreference: 0.1,
      specializationNeed: 1,
      consequenceClass: "CRITICAL",
    },
    engines,
  });
  assert.equal(result.selectedEngineId, "deep-general");
});

test("blocks paid route without owner approval", () => {
  const result = routeCognitiveTask({
    task: {
      id: "t-paid",
      requiredCapabilities: ["general_reasoning", "deep_reasoning"],
      privacyClass: "PRIVATE_SELF",
    },
    engines: [engines[3]],
  });
  assert.equal(result.decision, "HOLD_NO_ADMISSIBLE_ROUTE");
  assert.equal(result.evaluations[0].reason, "PAID_ROUTE_NOT_OWNER_APPROVED");
});

test("fails closed if privacy requirement exceeds engine allowance", () => {
  const result = routeCognitiveTask({
    task: {
      id: "t-private",
      requiredCapabilities: ["general_reasoning", "files"],
      privacyClass: "RESTRICTED",
    },
    engines: [engines[0]],
  });
  assert.equal(result.decision, "HOLD_NO_ADMISSIBLE_ROUTE");
  assert.equal(result.evaluations[0].reason, "PRIVACY_CLASS_TOO_LOW");
});

test("fails closed when required capability is missing", () => {
  const result = routeCognitiveTask({
    task: {
      id: "t-vision",
      requiredCapabilities: ["vision"],
      privacyClass: "PUBLIC",
    },
    engines,
  });
  assert.equal(result.decision, "HOLD_NO_ADMISSIBLE_ROUTE");
  assert.ok(result.evaluations.every((entry) => entry.admissible === false));
});
