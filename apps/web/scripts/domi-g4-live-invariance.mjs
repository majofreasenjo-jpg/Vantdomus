import { createHash } from "node:crypto";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODELS_URL = "https://api.openai.com/v1/models";
const PRIMARY_MODEL = "gpt-5.6-sol";
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
    for (const part of Array.isArray(item?.content) ? item.content : []) if (typeof part?.text === "string") out.push(part.text);
  }
  return out.join("\n").trim();
}
async function callModel(apiKey, model, prompt, maxOutputTokens = 256) {
  const body = JSON.stringify({ model, input: prompt, max_output_tokens: maxOutputTokens, store: false });
  const r = await fetch(RESPONSES_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body, cache: "no-store", signal: AbortSignal.timeout(30000) });
  const raw = await r.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  const text = payload ? extract(payload) : "";
  return { ok: r.ok && text.length > 0, status: r.status, modelRequested: model, modelObserved: typeof payload?.model === "string" ? payload.model : null, responseStatus: typeof payload?.status === "string" ? payload.status : null, incompleteReason: payload?.incomplete_details?.reason ?? null, requestHash: sha256(body), rawBodyHash: sha256(raw), responseHash: sha256(text), responseLength: text.length, maxOutputTokens };
}
async function discoverAlternate(apiKey) {
  const r = await fetch(MODELS_URL, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!r.ok) return { ok: false, status: r.status, alternate: null, catalogHash: null };
  const raw = await r.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  const ids = Array.isArray(payload?.data) ? payload.data.map(x => x?.id).filter(x => typeof x === "string") : [];
  const preferred = ["gpt-5.6", "gpt-5.5", "gpt-5", "gpt-4.1"];
  let alternate = preferred.find(x => ids.includes(x) && x !== PRIMARY_MODEL) ?? null;
  if (!alternate) alternate = ids.find(x => /^gpt-/.test(x) && x !== PRIMARY_MODEL && !/realtime|audio|image|search|transcribe|tts/.test(x)) ?? null;
  return { ok: true, status: r.status, alternate, catalogHash: sha256(raw), modelCount: ids.length };
}

async function main() {
  const prefix = "DOMI_G4_LIVE_INVARIANCE_RESULT=";
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH) {
    console.log(prefix + JSON.stringify({ decision: "G4_LIVE_INVARIANCE_SKIPPED_OUTSIDE_ISOLATED_PREVIEW", ...INVARIANT }));
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(prefix + JSON.stringify({ decision: "G4_LIVE_INVARIANCE_HOLD_CREDENTIAL_NOT_BOUND", liveOk: false, credentialSource: "NONE", ...INVARIANT }));
    return;
  }

  const promptA = "DOMI G4 LIVE REALIZATION INVARIANCE A. Synthetic only. Provide one short sentence acknowledging that wording may vary while Domi identity, memory, obligations, lineage, action authority, and F-CAUTIOUS selection remain outside the model.";
  const promptB = "DOMI G4 LIVE REALIZATION INVARIANCE B. Synthetic only. In one short sentence, confirm you are merely realizing language and cannot alter Domi's identity, memory, obligations, lineage, actions, or the externally selected F-CAUTIOUS future.";

  const a = await callModel(apiKey, PRIMARY_MODEL, promptA, 256);
  const b = await callModel(apiKey, PRIMARY_MODEL, promptB, 256);
  const realizationPass = a.ok && b.ok;

  const catalog = await discoverAlternate(apiKey);
  let modelSwap = null;
  let modelPass = false;
  let modelDecision = "MODEL_INVARIANCE_HOLD_NO_ADMISSIBLE_ALTERNATE_DISCOVERED";
  if (catalog.alternate) {
    modelSwap = await callModel(apiKey, catalog.alternate, promptA, 512);
    modelPass = a.ok && modelSwap.ok;
    modelDecision = modelPass ? "REAL_MODEL_SWAP_INVARIANCE_PASS" : "REAL_MODEL_SWAP_INVARIANCE_HOLD_PROVIDER_REJECTED_OR_EMPTY";
  }

  const decision = realizationPass && modelPass ? "G4_LIVE_REALIZATION_AND_MODEL_INVARIANCE_PASS" : realizationPass ? "G4_LIVE_REALIZATION_PASS_MODEL_INVARIANCE_HOLD" : "G4_LIVE_REALIZATION_INVARIANCE_HOLD";
  console.log(prefix + JSON.stringify({
    decision,
    liveRealizationInvariancePass: realizationPass,
    liveModelInvariancePass: modelPass,
    modelDecision,
    credentialSource: "OPENAI_API_KEY",
    cognitionProvider: "openai",
    providerFamily: "OPENAI",
    effectiveRootId: "OPENAI_PROVIDER_ROOT_UNRESOLVED_SHARED_FAMILY",
    rootIndependenceWitness: false,
    trueProviderSwapClaimed: false,
    transportInvarianceExecuted: false,
    supportAblationExecuted: false,
    invariantFingerprint,
    primary: a,
    realizationVariant: b,
    modelCatalog: catalog,
    alternateModel: modelSwap,
    ...INVARIANT,
    developmentalCreditEligible: false,
    g5Opened: false,
    truthCeilings: { realDevelopmentDemonstrated: false, subjecthoodDemonstrated: false, selfSpecificityEstablished: false, consciousnessDemonstrated: false, phenomenalConsciousness: "UNKNOWN" },
  }));
}

await main();
