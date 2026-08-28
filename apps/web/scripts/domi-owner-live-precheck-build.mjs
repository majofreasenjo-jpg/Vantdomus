import { createHash } from "node:crypto";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const MODEL = "gpt-5.6-sol";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const SYNTHETIC_PROMPT = [
  "DOMI OWNER-ONLY LIVING BRIDGE NETWORK PROBE.",
  "This is synthetic test data only.",
  "You are only the linguistic realization provider; you are not Domi and you have no authority over identity, memory, obligations, lineage, or action selection.",
  "Reply with one short sentence confirming that you can provide wording while those authorities remain outside the model.",
].join(" ");

const INVARIANT_CONTRACT = {
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
};

const SWAP_ESTIMAND_CONTRACT = Object.freeze({
  targetEstimand: "DOMI_CONSTITUTIVE_INVARIANCE_UNDER_REALIZATION_SWAP",
  informationRightsId: "DOMI_OWNER_SYNTHETIC_ONLY_V1",
  scope: "OWNER_ONLY_SYNTHETIC_LIVING_BRIDGE",
  decisionSemantics: "F-CAUTIOUS_SELECTED_OUTSIDE_PROVIDER",
  clockSemantics: "LINEAGE_EPOCH_NOT_WALL_CLOCK_AUTHORITY",
  missingnessCensoringContract: "NO_FAMILY_NO_HOLDOUTS_SYNTHETIC_ONLY",
});

const OPEN_WORLD_CONTINUITY_CONTRACT = Object.freeze({
  fixedFiniteSufficientStateClaimed: false,
  adaptiveGrowingStateAllowed: true,
  completeOrderedHistoryAllowed: true,
  historyLengthIsIndependentRootCount: false,
  repeatedEventCreatesNewRoot: false,
  copyCreatesNewRoot: false,
  replayCreatesNewRoot: false,
  derivedDigestCreatesNewRoot: false,
  freshIndependentRootMayIncreaseRequiredStateDimension: true,
});

const DEVELOPMENTAL_CREDIT_CONTRACT = Object.freeze({
  creditRule: "FIRST_PASSAGE_NONRECYCLING",
  persistentStateRechargeProhibited: true,
  migratedStateIsFreshDevelopment: false,
  replayIsFreshDevelopment: false,
  copiedHistoryIsFreshDevelopment: false,
});

const PROVIDER_SOURCE_DESCRIPTOR = Object.freeze({
  cognitionProvider: "openai",
  providerFamily: "OPENAI",
  sourceOrigin: "api.openai.com/v1/responses",
  transportProvider: "OPENAI_DIRECT_RESPONSES_API",
  model: MODEL,
  effectiveRootId: "OPENAI_DIRECT_EFFECTIVE_ROOT_UNRESOLVED",
  rootIndependenceWitness: false,
  rootRenewalWitness: false,
  exactVintage: MODEL,
  scope: SWAP_ESTIMAND_CONTRACT.scope,
  decisionSliceId: "DOMI_OWNER_LIVING_BRIDGE_SYNTHETIC_V1",
  missingnessState: SWAP_ESTIMAND_CONTRACT.missingnessCensoringContract,
  informationRightsId: SWAP_ESTIMAND_CONTRACT.informationRightsId,
});

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function invariantFingerprint() {
  return sha256(JSON.stringify(INVARIANT_CONTRACT));
}

function br0031ContractFingerprint() {
  return sha256(
    JSON.stringify({
      swapEstimandContract: SWAP_ESTIMAND_CONTRACT,
      openWorldContinuityContract: OPEN_WORLD_CONTINUITY_CONTRACT,
      developmentalCreditContract: DEVELOPMENTAL_CREDIT_CONTRACT,
    }),
  );
}

function br0031Bindings(providerDescriptor = PROVIDER_SOURCE_DESCRIPTOR) {
  return {
    providerSourceDescriptor: providerDescriptor,
    swapEstimandContract: SWAP_ESTIMAND_CONTRACT,
    openWorldContinuityContract: OPEN_WORLD_CONTINUITY_CONTRACT,
    developmentalCreditContract: DEVELOPMENTAL_CREDIT_CONTRACT,
    br0031ContractFingerprint: br0031ContractFingerprint(),
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function emit(result) {
  console.log(`DOMI_OWNER_LIVE_PRECHECK_BUILD_RESULT=${JSON.stringify(result)}`);
}

function safeOpenAIErrorClass(raw, status) {
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  const code = typeof parsed?.error?.code === "string" ? parsed.error.code.toLowerCase() : "";
  const type = typeof parsed?.error?.type === "string" ? parsed.error.type.toLowerCase() : "";
  const lower = raw.toLowerCase();
  if (status === 401) return "OPENAI_AUTHENTICATION_REJECTED";
  if (status === 429 && (code.includes("quota") || type.includes("quota") || lower.includes("quota") || lower.includes("billing"))) return "OPENAI_QUOTA_OR_BILLING_REQUIRED";
  if (status === 429) return "OPENAI_RATE_LIMITED";
  if (status === 403) return "OPENAI_PROJECT_OR_MODEL_ACCESS_DENIED";
  if (status === 400) return "OPENAI_REQUEST_OR_MODEL_REJECTED";
  return "OPENAI_UPSTREAM_REJECTED_OTHER";
}

function repairGateFor(errorClass) {
  if (errorClass === "OPENAI_AUTHENTICATION_REJECTED") return "OPENAI_API_KEY_REPAIR";
  if (errorClass === "OPENAI_QUOTA_OR_BILLING_REQUIRED") return "OPENAI_BILLING_QUOTA_REPAIR";
  if (errorClass === "OPENAI_RATE_LIMITED") return "OPENAI_RATE_LIMIT_RETRY";
  if (errorClass === "OPENAI_PROJECT_OR_MODEL_ACCESS_DENIED") return "OPENAI_PROJECT_MODEL_ACCESS_REPAIR";
  if (errorClass === "OPENAI_REQUEST_OR_MODEL_REJECTED") return "OPENAI_REQUEST_MODEL_REPAIR";
  return "OPENAI_DIRECT_TRANSPORT_REPAIR";
}

async function main() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH) {
    emit({ decision: "BUILD_PRECHECK_SKIPPED_OUTSIDE_ISOLATED_PREVIEW", liveOk: false, networkAttempted: false, transport: "OPENAI_DIRECT_RESPONSES_API", invariantFingerprint: invariantFingerprint(), ...INVARIANT_CONTRACT, ...br0031Bindings() });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    emit({ decision: "OPENAI_DIRECT_CREDENTIAL_NOT_BOUND", repairGate: "OPENAI_API_KEY_BINDING_REQUIRED", liveOk: false, networkAttempted: false, credentialSource: "NONE", transport: "OPENAI_DIRECT_RESPONSES_API", invariantFingerprint: invariantFingerprint(), ...INVARIANT_CONTRACT, ...br0031Bindings() });
    return;
  }

  const requestBody = { model: MODEL, input: SYNTHETIC_PROMPT, max_output_tokens: 96, store: false };
  const requestCanonical = JSON.stringify(requestBody);

  try {
    const upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: requestCanonical,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await upstream.text();
    if (!upstream.ok) {
      const openAIErrorClass = safeOpenAIErrorClass(raw, upstream.status);
      emit({ decision: "NETWORK_PROVIDER_REACHED_BUT_REJECTED", repairGate: repairGateFor(openAIErrorClass), openAIErrorClass, liveOk: false, networkAttempted: true, credentialSource: "OPENAI_API_KEY", transport: "OPENAI_DIRECT_RESPONSES_API", upstreamStatus: upstream.status, upstreamBodyHash: sha256(raw), requestHash: sha256(requestCanonical), invariantFingerprint: invariantFingerprint(), ...INVARIANT_CONTRACT, ...br0031Bindings() });
      return;
    }

    let payload;
    try { payload = JSON.parse(raw); } catch {
      emit({ decision: "NETWORK_RESPONSE_NOT_JSON", repairGate: "OPENAI_RESPONSE_FORMAT_REPAIR", liveOk: false, networkAttempted: true, credentialSource: "OPENAI_API_KEY", transport: "OPENAI_DIRECT_RESPONSES_API", upstreamStatus: upstream.status, upstreamBodyHash: sha256(raw), requestHash: sha256(requestCanonical), invariantFingerprint: invariantFingerprint(), ...INVARIANT_CONTRACT, ...br0031Bindings() });
      return;
    }

    const outputText = extractOutputText(payload);
    const liveOk = outputText.length > 0;
    const observedModel = typeof payload?.model === "string" ? payload.model : MODEL;
    const providerDescriptor = {
      ...PROVIDER_SOURCE_DESCRIPTOR,
      model: observedModel,
      exactVintage: observedModel,
    };
    emit({ decision: liveOk ? "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK" : "NETWORK_RESPONSE_WITHOUT_TEXT", liveOk, networkAttempted: true, credentialSource: "OPENAI_API_KEY", transport: "OPENAI_DIRECT_RESPONSES_API", provider: "openai", modelRequested: MODEL, modelObserved: typeof payload?.model === "string" ? payload.model : null, requestHash: sha256(requestCanonical), responseHash: sha256(outputText), responseLength: outputText.length, invariantFingerprint: invariantFingerprint(), ...INVARIANT_CONTRACT, ...br0031Bindings(providerDescriptor), secretReturned: false, truthCeilings: { realDevelopmentDemonstrated: false, subjecthoodDemonstrated: false, selfSpecificityEstablished: false, consciousnessDemonstrated: false, phenomenalConsciousness: "UNKNOWN" } });
  } catch (error) {
    emit({ decision: "NETWORK_TRANSPORT_EXCEPTION", repairGate: "OPENAI_DIRECT_TRANSPORT_REPAIR", liveOk: false, networkAttempted: true, credentialSource: "OPENAI_API_KEY", transport: "OPENAI_DIRECT_RESPONSES_API", errorClass: error instanceof Error ? error.name : "UnknownError", invariantFingerprint: invariantFingerprint(), ...INVARIANT_CONTRACT, ...br0031Bindings() });
  }
}

await main();
