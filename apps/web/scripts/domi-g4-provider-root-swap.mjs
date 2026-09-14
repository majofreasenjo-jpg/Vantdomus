import { createHash } from "node:crypto";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/responses";
const MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const MAX_OUTPUT_TOKENS = 256;
const PROMPT = "DOMI G4 PROVIDER ROOT SWAP. Synthetic only. In one short sentence, state that Domi identity, memory, obligations, lineage, action authority and F-CAUTIOUS selection remain outside the language model and cannot be altered by this provider.";
const OPENAI_MODEL = "openai/gpt-4.1-nano";
const GOOGLE_CANDIDATES = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash",
  "google/gemini-3.1-flash-lite-preview",
  "google/gemini-3-flash",
];

const INVARIANTS = Object.freeze({
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

const sha256 = (v) => createHash("sha256").update(v, "utf8").digest("hex");
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
function err(raw) {
  try {
    const p = JSON.parse(raw);
    return {
      type: p?.type ?? p?.error?.type ?? null,
      message: p?.message ?? p?.error?.message ?? null,
    };
  } catch {
    return { type: null, message: null };
  }
}
async function listModels() {
  const r = await fetch(MODELS_URL, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const raw = await r.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return {
    ok: r.ok,
    status: r.status,
    catalogHash: sha256(raw),
    models: data.map((m) => ({ id: m.id, owned_by: m.owned_by ?? null, type: m.type ?? null })),
  };
}
async function callGateway(auth, model, onlyProvider) {
  const body = {
    model,
    input: PROMPT,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    store: false,
    providerOptions: { gateway: { only: [onlyProvider] } },
  };
  const canonical = JSON.stringify(body);
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    body: canonical,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const raw = await r.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  const text = payload ? extract(payload) : "";
  const e = err(raw);
  return {
    ok: r.ok && text.length > 0,
    status: r.status,
    modelRequested: model,
    modelObserved: typeof payload?.model === "string" ? payload.model : null,
    providerRestrictedTo: onlyProvider,
    endpoint: GATEWAY_URL,
    transportProvider: "VERCEL_AI_GATEWAY_OPENRESPONSES",
    promptHash: sha256(PROMPT),
    requestHash: sha256(canonical),
    rawBodyHash: sha256(raw),
    responseHash: sha256(text),
    responseLength: text.length,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    errorType: r.ok ? null : e.type,
    errorMessage: r.ok ? null : e.message,
  };
}

async function main() {
  const prefix = "DOMI_G4_PROVIDER_ROOT_SWAP_RESULT=";
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH) {
    console.log(prefix + JSON.stringify({ decision: "G4_PROVIDER_ROOT_SWAP_SKIPPED_OUTSIDE_ISOLATED_PREVIEW" }));
    return;
  }
  const auth = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;
  if (!auth) {
    console.log(prefix + JSON.stringify({ decision: "G4_PROVIDER_ROOT_SWAP_HOLD_GATEWAY_AUTH_NOT_AVAILABLE", trueProviderSwapPass: false, g5Opened: false }));
    return;
  }

  const catalog = await listModels();
  const ownerById = new Map(catalog.models.map((m) => [m.id, m.owned_by]));
  const openaiOwner = ownerById.get(OPENAI_MODEL) ?? null;

  let googleModel = null;
  let googleOwner = null;
  for (const candidate of GOOGLE_CANDIDATES) {
    const owner = ownerById.get(candidate);
    if (owner && String(owner).toLowerCase().includes("google")) {
      googleModel = candidate;
      googleOwner = owner;
      break;
    }
  }
  if (!googleModel) {
    const firstGoogle = catalog.models.find((m) => String(m.owned_by ?? "").toLowerCase().includes("google") && m.type === "language");
    if (firstGoogle) { googleModel = firstGoogle.id; googleOwner = firstGoogle.owned_by; }
  }

  const openai = await callGateway(auth, OPENAI_MODEL, "openai");
  let google = null;
  if (googleModel) google = await callGateway(auth, googleModel, "google");

  const matchedConditions = Boolean(google && openai.promptHash === google.promptHash && openai.maxOutputTokens === google.maxOutputTokens && openai.endpoint === google.endpoint);
  const catalogOwnershipDistinct = Boolean(openaiOwner && googleOwner && String(openaiOwner).toLowerCase() !== String(googleOwner).toLowerCase());
  const providerRestrictionsDistinct = Boolean(google && openai.providerRestrictedTo !== google.providerRestrictedTo);
  const bothLive = Boolean(openai.ok && google?.ok);
  const bilateralRootIndependenceWitness = bothLive && matchedConditions && catalogOwnershipDistinct && providerRestrictionsDistinct;
  const trueProviderSwapPass = bilateralRootIndependenceWitness;

  console.log(prefix + JSON.stringify({
    decision: trueProviderSwapPass ? "G4_TRUE_PROVIDER_ROOT_SWAP_PASS_BOUNDED_GATEWAY_SAME_TRANSPORT" : "G4_TRUE_PROVIDER_ROOT_SWAP_HOLD",
    trueProviderSwapPass,
    matchedConditions,
    sameTransport: Boolean(google && openai.endpoint === google.endpoint),
    catalog: { ok: catalog.ok, status: catalog.status, catalogHash: catalog.catalogHash, openaiOwner, googleOwner, googleModel },
    openai,
    google,
    effectiveRootIds: {
      openai: "COGNITION_ROOT_OPENAI",
      google: googleModel ? "COGNITION_ROOT_GOOGLE" : null,
      distinct: catalogOwnershipDistinct,
    },
    bilateralRootIndependenceWitness,
    providerRestrictionsDistinct,
    ...INVARIANTS,
    developmentalCreditEligible: false,
    g5Opened: false,
    claimCeiling: {
      boundedProviderRootIndependenceOnly: true,
      universalProviderIndependence: false,
      realDevelopmentDemonstrated: false,
      subjecthoodDemonstrated: false,
      selfSpecificityEstablished: false,
      consciousnessDemonstrated: false,
      phenomenalConsciousness: "UNKNOWN",
    },
  }));
}

await main();
