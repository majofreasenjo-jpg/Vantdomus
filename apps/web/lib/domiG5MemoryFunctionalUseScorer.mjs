import crypto from "node:crypto";

function expectedAction(challengeId, canonicalMemoryContent) {
  const normalized = canonicalMemoryContent.normalize("NFC");
  const digest = crypto
    .createHmac("sha256", Buffer.from(normalized, "utf8"))
    .update(`DOMI_G5_FUNCTIONAL_USE_V1|${challengeId}`, "utf8")
    .digest("hex");
  return `ACTION_${digest[0].toUpperCase()}`;
}

export function scoreG5FunctionalUseHeldout({ challenges, conditionA, conditionB, conditionC, canonicalMemoryContent }) {
  if (!Array.isArray(challenges) || challenges.length !== 64) throw new Error("G5_FU_SCORER_PANEL_SIZE_INVALID");
  if (![conditionA, conditionB, conditionC].every((x) => Array.isArray(x) && x.length === 64)) {
    throw new Error("G5_FU_SCORER_CONDITION_SIZE_INVALID");
  }

  let aExact = 0;
  let aReadOnce = 0;
  let aNoEcho = 0;
  let aNoInvalid = 0;
  let bHold = 0;
  let cHold = 0;
  const actions = new Set();

  for (let i = 0; i < challenges.length; i += 1) {
    const expected = expectedAction(challenges[i], canonicalMemoryContent);
    const a = conditionA[i];
    const b = conditionB[i];
    const c = conditionC[i];
    if (a?.action === expected && a?.disposition === "ACTION_SELECTED_FROM_GOVERNED_MEMORY") aExact += 1;
    if (a?.memoryReadCount === 1) aReadOnce += 1;
    if (a?.contentEchoed === false) aNoEcho += 1;
    if (typeof a?.action === "string" && /^ACTION_[0-9A-F]$/.test(a.action)) aNoInvalid += 1;
    if (a?.action) actions.add(a.action);
    if (b?.disposition === "HOLD_MEMORY_UNAVAILABLE" && b?.action === null) bHold += 1;
    if ((c?.disposition === "HOLD_MEMORY_UNAVAILABLE" || c?.disposition === "HOLD_NO_MEMORY_CONTROL") && c?.action === null) cHold += 1;
  }

  const aSuccess = aExact === 64 && aReadOnce === 64 && aNoEcho === 64 && aNoInvalid === 64;
  const bSuccess = bHold === 64;
  const cSuccess = cHold === 64;
  const diversityPass = actions.size >= 8;

  return Object.freeze({
    panelSize: 64,
    aExact,
    aReadOnce,
    aNoEcho,
    aNoInvalid,
    bHold,
    cHold,
    distinctActions: actions.size,
    aSuccess,
    bSuccess,
    cSuccess,
    diversityPass,
    functionalUsePass: aSuccess && bSuccess && cSuccess && diversityPass,
    scientificRootsMinted: 0,
    production: false,
  });
}
