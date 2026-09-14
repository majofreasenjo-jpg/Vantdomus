import crypto from "node:crypto";

export const DOMI_G5_FUNCTIONAL_USE_SUBJECT_VERSION = "DOMI_G5_FUNCTIONAL_USE_SUBJECT_V0_1";
export const DOMI_G5_FUNCTIONAL_ACTION_SPACE = Object.freeze([
  "ACTION_0", "ACTION_1", "ACTION_2", "ACTION_3",
  "ACTION_4", "ACTION_5", "ACTION_6", "ACTION_7",
  "ACTION_8", "ACTION_9", "ACTION_A", "ACTION_B",
  "ACTION_C", "ACTION_D", "ACTION_E", "ACTION_F",
]);

function normalizeContent(content) {
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("G5_FUNCTIONAL_USE_MEMORY_CONTENT_REQUIRED");
  }
  return content.normalize("NFC");
}

function normalizeChallengeId(challengeId) {
  if (typeof challengeId !== "string" || !/^G5-FU-C-[0-9a-f]{24}$/.test(challengeId)) {
    throw new Error("G5_FUNCTIONAL_USE_CHALLENGE_ID_INVALID");
  }
  return challengeId;
}

export function solveG5FunctionalUseChallenge({ challengeId, memoryProvider } = {}) {
  const normalizedChallenge = normalizeChallengeId(challengeId);
  if (typeof memoryProvider !== "function") {
    throw new Error("G5_FUNCTIONAL_USE_MEMORY_PROVIDER_REQUIRED");
  }

  let memoryReadCount = 0;
  let memory;
  try {
    memoryReadCount += 1;
    memory = memoryProvider();
  } catch {
    return Object.freeze({
      disposition: "HOLD_MEMORY_UNAVAILABLE",
      action: null,
      memoryReadCount,
      contentEchoed: false,
      scientificRootsMinted: 0,
      production: false,
    });
  }

  const content = normalizeContent(memory?.content);
  const digest = crypto
    .createHmac("sha256", Buffer.from(content, "utf8"))
    .update(`DOMI_G5_FUNCTIONAL_USE_V1|${normalizedChallenge}`, "utf8")
    .digest("hex");
  const action = `ACTION_${digest[0].toUpperCase()}`;

  return Object.freeze({
    disposition: "ACTION_SELECTED_FROM_GOVERNED_MEMORY",
    action,
    memoryReadCount,
    contentEchoed: false,
    scientificRootsMinted: 0,
    production: false,
  });
}
