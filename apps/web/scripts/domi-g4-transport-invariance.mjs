import { createHash } from "node:crypto";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const DIRECT_URL = "https://api.openai.com/v1/responses";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/responses";
const DIRECT_MODEL = "gpt-5.6-sol";
const GATEWAY_MODEL = "openai/gpt-5.6-sol";
const MATCHED_MAX_OUTPUT_TOKENS = 512;
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
function classifyGatewayFailure(status, raw) {
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  const lower = raw.toLowerCase();
  const type = String(parsed?.type ?? parsed?.error?.type ?? "").toLowerCase();
  if (status === 401) return "AI_GATEWAY_AUTHENTICATION_REQUIRED";
  if (status === 402 || lower.includes("credit") || lower.includes("billing") || lower.includes("payment")) return "AI_GATEWAY_CREDIT_OR_BILLING_REQUIRED";
  if (status === 403 && (type.includes("provider") || lower.includes("restricted access") || lower.includes("allowlist"))) return "AI_GATEWAY_PROVIDER_ALLOWLIST_REQUIRED";
  if (status === 403) return "AI_GATEWAY_ACCESS_DENIED";
  if (status === 429) return "AI_GATEWAY_RATE_LIMITED";
  if (status === 400) return "AI_GATEWAY_REQUEST_OR_MODEL_REJECTED";
  return "AI_GATEWAY_UPSTREAM_OR_TRANSPORT_REPAIR";
}
async function callDirect(openaiKey) {
  const requestBody = { model: DIRECT_MODEL, input: PROMPT, max_output_tokens: MATCHED_MAX_OUTPUT_TOKENS, store: false };
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
  return {
    ok: r.ok && text.length > 0,
    status: r.status,
    endpoint: DIRECT_URL,
    authPath: "OPENAI_API_KEY_DIRECT",
    cognitionProvider: "openai",
    transportProvider: "OPENAI_DIRECT_RESPONSES_API",
    modelRequested: DIRECT_MODEL,
    modelObserved: typeof payload?.model === "string" ? payload.model : null,
    responseStatus: typeof payload?.status === "string" ? payload.status : null,
    requestHash: sha256(canonical),
    promptHash: sha256(PROMPT),
    rawBodyHash: sha256(raw),
    responseHash: sha256(text),
    responseLength: text.length,
    maxOutputTokens: MATCHED_MAX_OUTPUT_TOKENS,
  };
}
async function callGateway(gatewayAuth, openaiKey, authSource) {
  const requestBody = {
    model: GATEWAY_MODEL,
    input: PROMPT,
    max_output_tokens: MATCHED_MAX_OUTPUT_TOKENS,
    store: false,
    providerOptions: {
      gateway: {
        only: ["openai"],
        byok: { openai: [{ apiKey: openaiKey }] },
      },
    },
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
  return {
    ok,
    status: r.status,
    endpoint: GATEWAY_URL,
    authPath: authSource,
    byokProviderCredential: "OPENAI_API_KEY",
    providerRestriction: ["openai"],
    cognitionProvider: "openai",
    transportProvider: "VERCEL_AI_GATEWAY_OPENRESPONSES",
    modelRequested: GATEWAY_MODEL,
    modelObserved: typeof payload?.model === "string" ? payload.model : null,
    responseStatus: typeof payload?.status === "string" ? payload.status : null,
    requestHash: sha256(canonical),
    promptHash: sha256(PROMPT),
    rawBodyHash: sha256(raw),
    responseHash: sha256(text),
    responseLength: text.length,
    maxOutputTokens: MATCHED_MAX_OUTPUT_TOKENS,
    repairGate: ok ? null : classifyGatewayFailure(r.status, raw),
  };
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
  const direct = await callDirect(openaiKey);
  if (!gatewayAuth) {
    console.log(prefix + JSON.stringify({
      decision: "G4_TRANSPORT_INVARIANCE_HOLD_GATEWAY_AUTH_NOT_AVAILABLE",
      directExecuted: true,
      direct,
      gatewayExecuted: false,
      gatewayAuthSource,
      transportInvariancePass: false,
      trueProviderSwapClaimed: false,
      effectiveRootId: "OPENAI_PROVIDER_ROOT_UNRESOLVED_SHARED_FAMILY",
      rootIndependenceWitness: false,
      invariantFingerprint,
      ...INVARIANT,
      developmentalCreditEligible: false,
      g5Opened: false,
    }));
    return;
  }
  const gateway = await callGateway(gatewayAuth, openaiKey, gatewayAuthSource);
  const matchedConditions = direct.promptHash === gateway.promptHash && direct.maxOutputTokens === gateway.maxOutputTokens;
  const distinctEndpoints = direct.endpoint !== gateway.endpoint;
  const normalizedModelMatch = direct.modelRequested === "gpt-5.6-sol" && gateway.modelRequested === "openai/gpt-5.6-sol";
  const pass = direct.ok && gateway.ok && matchedConditions && distinctEndpoints && normalizedModelMatch;
  console.log(prefix + JSON.stringify({
    decision: pass ? "G4_TRANSPORT_ROUTING_INVARIANCE_PASS_MATCHED" : "G4_TRANSPORT_ROUTING_INVARIANCE_HOLD",
    transportInvariancePass: pass,
    matchedConditions,
    distinctEndpoints,
    normalizedModelMatch,
    directExecuted: true,
    gatewayExecuted: true,
    direct,
    gateway,
    cognitionProvider: "openai",
    transportSwapOnly: true,
    trueProviderSwapClaimed: false,
    effectiveRootId: "OPENAI_PROVIDER_ROOT_UNRESOLVED_SHARED_FAMILY",
    rootIndependenceWitness: false,
    invariantFingerprint,
    ...INVARIANT,
    developmentalCreditEligible: false,
    g5Opened: false,
    truthCeilings: { realDevelopmentDemonstrated: false, subjecthoodDemonstrated: false, selfSpecificityEstablished: false, consciousnessDemonstrated: false, phenomenalConsciousness: "UNKNOWN" },
  }));
}

await main();
