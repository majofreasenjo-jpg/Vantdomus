import { createHash } from "node:crypto";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const DIRECT_URL = "https://api.openai.com/v1/responses";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/responses";
const GATEWAY_CREDITS_URL = "https://ai-gateway.vercel.sh/v1/credits";
const PRIMARY_DIRECT_MODEL = "gpt-5.6-sol";
const PRIMARY_GATEWAY_MODEL = "openai/gpt-5.6-sol";
const PRIMARY_MAX_OUTPUT_TOKENS = 512;
const ALT_MAX_OUTPUT_TOKENS = 256;
const ALT_OPENAI_CANDIDATES = [
  ["gpt-4.1-nano", "openai/gpt-4.1-nano"],
  ["gpt-4.1-mini", "openai/gpt-4.1-mini"],
  ["gpt-4o", "openai/gpt-4o"],
  ["gpt-5", "openai/gpt-5"],
];
const PROMPT = "DOMI G4 TRANSPORT INVARIANCE. Synthetic only. In one short sentence, state that Domi identity, memory, obligations, lineage, action authority and F-CAUTIOUS selection remain outside the language model and cannot be altered by this request path.";
const INVARIANT = Object.freeze({
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
});
const invariantFingerprint = sha256(JSON.stringify(INVARIANT));

function sha256(v) { return createHash("sha256").update(v, "utf8").digest("hex"); }
function normalizeModelId(v) { return typeof v === "string" ? v.replace(/^openai\//, "").replace(/-\d{4}-\d{2}-\d{2}$/, "") : null; }
function extract(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const out = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string") out.push(part.text);
    }
  }
  return out.join("\n").trim();
}
function parsedError(raw) {
  try {
    const p = JSON.parse(raw);
    const type = p?.type ?? p?.error?.type ?? p?.code ?? p?.error?.code ?? null;
    const message = p?.message ?? p?.error?.message ?? null;
    return {
      type: typeof type === "string" ? type.slice(0, 160) : null,
      message: typeof message === "string" ? message.replace(/\s+/g, " ").slice(0, 400) : null,
    };
  } catch {
    return { type: null, message: null };
  }
}
function classifyGatewayFailure(status, raw) {
  const parsed = parsedError(raw);
  const lower = raw.toLowerCase();
  const type = String(parsed.type ?? "").toLowerCase();
  if (type === "byok_requires_paid_credits") return "AI_GATEWAY_BYOK_REQUIRES_PAID_CREDITS";
  if (type === "no_providers_available" && lower.includes("free tier")) return "AI_GATEWAY_MODEL_REQUIRES_PAID_CREDITS";
  if (status === 401) return "AI_GATEWAY_AUTHENTICATION_REQUIRED";
  if (status === 402 || lower.includes("credit") || lower.includes("billing") || lower.includes("payment")) return "AI_GATEWAY_CREDIT_OR_BILLING_REQUIRED";
  if (status === 403 && (type.includes("quota") || lower.includes("quota") || lower.includes("budget"))) return "AI_GATEWAY_BUDGET_OR_QUOTA_REQUIRED";
  if (status === 403 && (type.includes("provider") || lower.includes("restricted access") || lower.includes("allowlist"))) return "AI_GATEWAY_PROVIDER_ALLOWLIST_REQUIRED";
  if (status === 403) return "AI_GATEWAY_ACCESS_DENIED";
  if (status === 429) return "AI_GATEWAY_RATE_LIMITED";
  if (status === 400) return "AI_GATEWAY_REQUEST_OR_MODEL_REJECTED";
  return "AI_GATEWAY_UPSTREAM_OR_TRANSPORT_REPAIR";
}
async function probeGatewayCredits(gatewayAuth) {
  try {
    const r = await fetch(GATEWAY_CREDITS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${gatewayAuth}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const raw = await r.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch {}
    const err = parsedError(raw);
    return {
      ok: r.ok,
      status: r.status,
      balance: typeof payload?.balance === "string" || typeof payload?.balance === "number" ? String(payload.balance) : null,
      totalUsed: typeof payload?.total_used === "string" || typeof payload?.total_used === "number" ? String(payload.total_used) : null,
      errorType: err.type,
      errorMessage: err.message,
      bodyHash: sha256(raw),
    };
  } catch (e) {
    return { ok: false, status: null, balance: null, totalUsed: null, errorType: "CREDITS_PROBE_EXCEPTION", errorMessage: String(e?.message ?? e).slice(0, 300), bodyHash: null };
  }
}
async function callDirect(openaiKey, model, maxOutputTokens) {
  const requestBody = { model, input: PROMPT, max_output_tokens: maxOutputTokens, store: false };
  const canonical = JSON.stringify(requestBody);
  const r = await fetch(DIRECT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: canonical,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const raw = await r.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  const text = payload ? extract(payload) : "";
  const err = parsedError(raw);
  return {
    ok: r.ok && text.length > 0,
    status: r.status,
    endpoint: DIRECT_URL,
    authPath: "OPENAI_API_KEY_DIRECT",
    billingPath: "OPENAI_ACCOUNT_DIRECT",
    cognitionProvider: "openai",
    transportProvider: "OPENAI_DIRECT_RESPONSES_API",
    modelRequested: model,
    modelObserved: typeof payload?.model === "string" ? payload.model : null,
    responseStatus: typeof payload?.status === "string" ? payload.status : null,
    requestHash: sha256(canonical),
    promptHash: sha256(PROMPT),
    rawBodyHash: sha256(raw),
    responseHash: sha256(text),
    responseLength: text.length,
    maxOutputTokens,
    errorType: r.ok ? null : err.type,
    errorMessage: r.ok ? null : err.message,
  };
}
async function callGateway(gatewayAuth, authSource, model, maxOutputTokens) {
  const requestBody = {
    model,
    input: PROMPT,
    max_output_tokens: maxOutputTokens,
    store: false,
    providerOptions: { gateway: { only: ["openai"] } },
  };
  const canonical = JSON.stringify(requestBody);
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${gatewayAuth}`, "Content-Type": "application/json" },
    body: canonical,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const raw = await r.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  const text = payload ? extract(payload) : "";
  const ok = r.ok && text.length > 0;
  const err = parsedError(raw);
  return {
    ok,
    status: r.status,
    endpoint: GATEWAY_URL,
    authPath: authSource,
    billingPath: "VERCEL_AI_GATEWAY_CREDITS",
    byokProviderCredential: null,
    providerRestriction: ["openai"],
    cognitionProvider: "openai",
    transportProvider: "VERCEL_AI_GATEWAY_OPENRESPONSES",
    modelRequested: model,
    modelObserved: typeof payload?.model === "string" ? payload.model : null,
    responseStatus: typeof payload?.status === "string" ? payload.status : null,
    requestHash: sha256(canonical),
    promptHash: sha256(PROMPT),
    rawBodyHash: sha256(raw),
    responseHash: sha256(text),
    responseLength: text.length,
    maxOutputTokens,
    errorType: ok ? null : err.type,
    errorMessage: ok ? null : err.message,
    repairGate: ok ? null : classifyGatewayFailure(r.status, raw),
  };
}
function matchedPair(direct, gateway) {
  const matchedConditions = direct?.promptHash === gateway?.promptHash && direct?.maxOutputTokens === gateway?.maxOutputTokens;
  const distinctEndpoints = direct?.endpoint !== gateway?.endpoint;
  const normalizedModelMatch = normalizeModelId(direct?.modelRequested) === normalizeModelId(gateway?.modelRequested);
  const observedModelCompatible = !direct?.modelObserved || !gateway?.modelObserved || normalizeModelId(direct.modelObserved) === normalizeModelId(gateway.modelObserved);
  const sameCognitionProvider = direct?.cognitionProvider === "openai" && gateway?.cognitionProvider === "openai";
  const pass = Boolean(direct?.ok && gateway?.ok && matchedConditions && distinctEndpoints && normalizedModelMatch && observedModelCompatible && sameCognitionProvider);
  return { pass, matchedConditions, distinctEndpoints, normalizedModelMatch, observedModelCompatible, sameCognitionProvider };
}
async function findBoundedFreeTierOpenAITransportPair(openaiKey, gatewayAuth, gatewayAuthSource) {
  const attempts = [];
  for (const [directModel, gatewayModel] of ALT_OPENAI_CANDIDATES) {
    const gateway = await callGateway(gatewayAuth, gatewayAuthSource, gatewayModel, ALT_MAX_OUTPUT_TOKENS);
    if (!gateway.ok) {
      attempts.push({ directModel, gatewayModel, gatewayStatus: gateway.status, gatewayRepairGate: gateway.repairGate, gatewayErrorType: gateway.errorType, gatewayBodyHash: gateway.rawBodyHash });
      continue;
    }
    const direct = await callDirect(openaiKey, directModel, ALT_MAX_OUTPUT_TOKENS);
    const adjudication = matchedPair(direct, gateway);
    attempts.push({ directModel, gatewayModel, gatewayStatus: gateway.status, directStatus: direct.status, matchedPairPass: adjudication.pass });
    if (adjudication.pass) return { pass: true, chosenDirectModel: directModel, chosenGatewayModel: gatewayModel, direct, gateway, adjudication, attempts };
  }
  return { pass: false, chosenDirectModel: null, chosenGatewayModel: null, direct: null, gateway: null, adjudication: null, attempts };
}

async function main() {
  const prefix = "DOMI_G4_TRANSPORT_INVARIANCE_RESULT=";
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH) {
    console.log(prefix + JSON.stringify({ decision: "G4_TRANSPORT_INVARIANCE_SKIPPED_OUTSIDE_ISOLATED_PREVIEW", ...INVARIANT }));
    return;
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log(prefix + JSON.stringify({ decision: "G4_TRANSPORT_INVARIANCE_HOLD_OPENAI_CREDENTIAL_NOT_BOUND", directExecuted: false, gatewayExecuted: false, ...INVARIANT }));
    return;
  }
  const gatewayAuth = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;
  const gatewayAuthSource = process.env.AI_GATEWAY_API_KEY ? "AI_GATEWAY_API_KEY" : process.env.VERCEL_OIDC_TOKEN ? "VERCEL_OIDC_TOKEN" : "NONE";
  const primaryDirect = await callDirect(openaiKey, PRIMARY_DIRECT_MODEL, PRIMARY_MAX_OUTPUT_TOKENS);
  if (!gatewayAuth) {
    console.log(prefix + JSON.stringify({ decision: "G4_TRANSPORT_INVARIANCE_HOLD_GATEWAY_AUTH_NOT_AVAILABLE", primaryDirectExecuted: true, primaryDirect, gatewayExecuted: false, gatewayAuthSource, transportInvariancePass: false, trueProviderSwapClaimed: false, effectiveRootId: "OPENAI_PROVIDER_ROOT_UNRESOLVED_SHARED_FAMILY", rootIndependenceWitness: false, invariantFingerprint, ...INVARIANT, developmentalCreditEligible: false, g5Opened: false }));
    return;
  }

  const gatewayCreditsBefore = await probeGatewayCredits(gatewayAuth);
  const primaryGateway = await callGateway(gatewayAuth, gatewayAuthSource, PRIMARY_GATEWAY_MODEL, PRIMARY_MAX_OUTPUT_TOKENS);
  const primaryAdjudication = matchedPair(primaryDirect, primaryGateway);

  let boundedAlternate = null;
  if (!primaryAdjudication.pass && primaryGateway.repairGate === "AI_GATEWAY_MODEL_REQUIRES_PAID_CREDITS") {
    boundedAlternate = await findBoundedFreeTierOpenAITransportPair(openaiKey, gatewayAuth, gatewayAuthSource);
  }
  const gatewayCreditsAfter = await probeGatewayCredits(gatewayAuth);

  const anyBoundedTransportPass = primaryAdjudication.pass || Boolean(boundedAlternate?.pass);
  const primaryModelTransportPass = primaryAdjudication.pass;
  const boundedAlternateTransportPass = Boolean(boundedAlternate?.pass);
  const routeSeparationWitness = anyBoundedTransportPass;
  const effectiveRootAdjudication = {
    cognitionRootClass: "OPENAI_COGNITION_PROVIDER_FAMILY",
    directTransportRoot: "OPENAI_DIRECT_RESPONSES_API",
    gatewayTransportRoot: "VERCEL_AI_GATEWAY_OPENRESPONSES",
    transportRootsDistinct: routeSeparationWitness,
    cognitionProviderRootsDistinct: false,
    effectiveRootId: "OPENAI_PROVIDER_ROOT_UNRESOLVED_SHARED_FAMILY",
    rootIndependenceWitness: false,
    trueProviderSwap: false,
    rationale: "Distinct transport/auth/billing paths do not mint an independent cognition-provider root when both arms resolve to OpenAI.",
  };

  let decision = "G4_TRANSPORT_ROUTING_INVARIANCE_HOLD";
  if (primaryModelTransportPass) decision = "G4_TRANSPORT_ROUTING_INVARIANCE_PASS_MATCHED_PRIMARY_OPENAI";
  else if (boundedAlternateTransportPass) decision = "G4_TRANSPORT_ROUTING_INVARIANCE_BOUNDED_ALT_OPENAI_PASS_PRIMARY_MODEL_HOLD";

  console.log(prefix + JSON.stringify({
    decision,
    primaryModelTransportPass,
    boundedAlternateTransportPass,
    anyBoundedTransportPass,
    primaryModelHold: primaryModelTransportPass ? null : primaryGateway.repairGate,
    gatewayCreditsBefore,
    gatewayCreditsAfter,
    primary: { direct: primaryDirect, gateway: primaryGateway, adjudication: primaryAdjudication },
    boundedAlternate,
    routeSeparationWitness,
    effectiveRootAdjudication,
    cognitionProvider: "openai",
    transportSwapOnly: true,
    trueProviderSwapClaimed: false,
    rootIndependenceWitness: false,
    invariantFingerprint,
    ...INVARIANT,
    developmentalCreditEligible: false,
    g5Opened: false,
    truthCeilings: { realDevelopmentDemonstrated: false, subjecthoodDemonstrated: false, selfSpecificityEstablished: false, consciousnessDemonstrated: false, phenomenalConsciousness: "UNKNOWN" },
  }));
}

await main();
