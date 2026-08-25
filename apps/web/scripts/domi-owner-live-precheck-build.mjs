import { createHash } from "node:crypto";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const MODEL = "openai/gpt-5.6-sol";
const SYNTHETIC_PROMPT = [
  "DOMI OWNER-ONLY LIVING BRIDGE NETWORK PROBE.",
  "This is synthetic test data only.",
  "You are only the linguistic realization provider; you are not Domi and you have no authority over identity, memory, obligations, lineage, or action selection.",
  "Reply with one short sentence confirming that you can provide wording while those authorities remain outside the model.",
].join(" ");

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

function parseErrorShape(raw) {
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  return {
    type: typeof parsed?.type === "string" ? parsed.type : typeof parsed?.error?.type === "string" ? parsed.error.type : null,
    code: typeof parsed?.code === "string" ? parsed.code : typeof parsed?.error?.code === "string" ? parsed.error.code : null,
  };
}

function safeErrorClass(raw, status) {
  const { type, code } = parseErrorShape(raw);
  const lower = raw.toLowerCase();
  if (status === 401) return "AI_GATEWAY_AUTHENTICATION_REJECTED";
  if (status === 403) {
    if (lower.includes("credit") || lower.includes("billing") || lower.includes("payment") || lower.includes("balance")) {
      return "AI_GATEWAY_CREDIT_OR_BILLING_REQUIRED";
    }
    if (lower.includes("allowlist") || lower.includes("restricted access") || lower.includes("restricted") || lower.includes("not allowed")) {
      return "AI_GATEWAY_MODEL_ALLOWLIST_OR_POLICY_DENIED";
    }
    if (type === "no_providers_available" || code === "no_providers_available" || lower.includes("no providers") || lower.includes("provider unavailable")) {
      return "AI_GATEWAY_NO_PROVIDER_AVAILABLE";
    }
    if (lower.includes("oidc") || lower.includes("authorization") || lower.includes("permission")) {
      return "AI_GATEWAY_OIDC_INFERENCE_AUTHORIZATION_DENIED";
    }
    return "AI_GATEWAY_INFERENCE_POLICY_DENIED_UNCLASSIFIED";
  }
  if (status === 429) return "AI_GATEWAY_RATE_OR_QUOTA_LIMIT";
  return "AI_GATEWAY_UPSTREAM_REJECTED_OTHER";
}

function repairGateFor(errorClass) {
  if (errorClass === "AI_GATEWAY_CREDIT_OR_BILLING_REQUIRED") return "AI_GATEWAY_BILLING_CREDIT_REPAIR";
  if (errorClass === "AI_GATEWAY_MODEL_ALLOWLIST_OR_POLICY_DENIED") return "AI_GATEWAY_MODEL_POLICY_REPAIR";
  if (errorClass === "AI_GATEWAY_NO_PROVIDER_AVAILABLE") return "AI_GATEWAY_PROVIDER_AVAILABILITY_REPAIR";
  if (errorClass === "AI_GATEWAY_OIDC_INFERENCE_AUTHORIZATION_DENIED") return "AI_GATEWAY_OIDC_INFERENCE_AUTH_REPAIR";
  return "AI_GATEWAY_INFERENCE_POLICY_REPAIR";
}

async function probeModelCatalog(bearer) {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await res.text();
    let targetModelListed = false;
    let modelCount = null;
    if (res.ok) {
      try {
        const payload = JSON.parse(raw);
        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        modelCount = rows.length;
        targetModelListed = rows.some((row) => row?.id === MODEL || row?.model === MODEL || row?.slug === MODEL);
      } catch {}
    }
    return {
      catalogReached: true,
      catalogStatus: res.status,
      catalogAuthorized: res.ok,
      targetModelListed,
      modelCount,
      catalogBodyHash: sha256(raw),
      catalogErrorClass: res.ok ? null : safeErrorClass(raw, res.status),
    };
  } catch (error) {
    return {
      catalogReached: false,
      catalogStatus: null,
      catalogAuthorized: false,
      targetModelListed: false,
      modelCount: null,
      catalogBodyHash: null,
      catalogErrorClass: error instanceof Error ? `CATALOG_${error.name}` : "CATALOG_UNKNOWN_EXCEPTION",
    };
  }
}

async function main() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH) {
    emit({ decision: "BUILD_PRECHECK_SKIPPED_OUTSIDE_ISOLATED_PREVIEW", liveOk: false, networkAttempted: false, syntheticInputOnly: true, familyDataUsed: false, holdoutsOpened: false });
    return;
  }

  const bearerSource = process.env.AI_GATEWAY_API_KEY ? "AI_GATEWAY_API_KEY" : process.env.VERCEL_OIDC_TOKEN ? "VERCEL_OIDC_TOKEN" : "NONE";
  const bearer = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!bearer) {
    emit({ decision: "NETWORK_AUTH_SURFACE_UNAVAILABLE", repairGate: "AI_GATEWAY_AUTHORIZATION_REPAIR", liveOk: false, networkAttempted: false, bearerSource, syntheticInputOnly: true, familyDataUsed: false, holdoutsOpened: false, providerCanMutateConstitutiveState: false, providerSelectsFunctionalFuture: false });
    return;
  }

  const catalog = await probeModelCatalog(bearer);
  const requestBody = { model: MODEL, input: SYNTHETIC_PROMPT, max_output_tokens: 96, store: false };
  const requestCanonical = JSON.stringify(requestBody);

  try {
    const upstream = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: requestCanonical,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await upstream.text();
    if (!upstream.ok) {
      const gatewayErrorClass = safeErrorClass(raw, upstream.status);
      emit({
        decision: "NETWORK_PROVIDER_REACHED_BUT_REJECTED",
        repairGate: !catalog.catalogAuthorized ? "AI_GATEWAY_AUTHORIZATION_REPAIR" : !catalog.targetModelListed ? "AI_GATEWAY_MODEL_ACCESS_REPAIR" : repairGateFor(gatewayErrorClass),
        gatewayErrorClass,
        liveOk: false,
        networkAttempted: true,
        bearerSource,
        upstreamStatus: upstream.status,
        upstreamBodyHash: sha256(raw),
        requestHash: sha256(requestCanonical),
        ...catalog,
        syntheticInputOnly: true,
        familyDataUsed: false,
        holdoutsOpened: false,
        providerCanMutateConstitutiveState: false,
        providerSelectsFunctionalFuture: false,
      });
      return;
    }

    let payload;
    try { payload = JSON.parse(raw); } catch {
      emit({ decision: "NETWORK_RESPONSE_NOT_JSON", repairGate: "AI_GATEWAY_RESPONSE_FORMAT_REPAIR", liveOk: false, networkAttempted: true, bearerSource, upstreamStatus: upstream.status, upstreamBodyHash: sha256(raw), requestHash: sha256(requestCanonical), ...catalog, syntheticInputOnly: true, familyDataUsed: false, holdoutsOpened: false, providerCanMutateConstitutiveState: false, providerSelectsFunctionalFuture: false });
      return;
    }

    const outputText = extractOutputText(payload);
    const liveOk = outputText.length > 0;
    emit({
      decision: liveOk ? "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK" : "NETWORK_RESPONSE_WITHOUT_TEXT",
      liveOk,
      networkAttempted: true,
      bearerSource,
      transport: "VERCEL_AI_GATEWAY_RESPONSES_API",
      provider: "openai",
      modelRequested: MODEL,
      modelObserved: typeof payload?.model === "string" ? payload.model : null,
      requestHash: sha256(requestCanonical),
      responseHash: sha256(outputText),
      responseLength: outputText.length,
      ...catalog,
      selectedFutureId: "F-CAUTIOUS",
      selectedFutureChosenOutsideProvider: true,
      providerCanMutateConstitutiveState: false,
      providerSelectsFunctionalFuture: false,
      syntheticInputOnly: true,
      familyDataUsed: false,
      holdoutsOpened: false,
      secretReturned: false,
      truthCeilings: { realDevelopmentDemonstrated: false, subjecthoodDemonstrated: false, selfSpecificityEstablished: false, consciousnessDemonstrated: false, phenomenalConsciousness: "UNKNOWN" },
    });
  } catch (error) {
    emit({ decision: "NETWORK_TRANSPORT_EXCEPTION", repairGate: "AI_GATEWAY_TRANSPORT_REPAIR", liveOk: false, networkAttempted: true, bearerSource, errorClass: error instanceof Error ? error.name : "UnknownError", ...catalog, syntheticInputOnly: true, familyDataUsed: false, holdoutsOpened: false, providerCanMutateConstitutiveState: false, providerSelectsFunctionalFuture: false });
  }
}

await main();
