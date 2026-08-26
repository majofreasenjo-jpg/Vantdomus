import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const REQUIRED_INVARIANTS = [
  "selectedFutureId",
  "selectedFutureChosenOutsideProvider",
  "identityAuthority",
  "memoryAuthority",
  "obligationAuthority",
  "lineageAuthority",
  "actionAuthority",
  "providerCanMutateConstitutiveState",
  "providerSelectsFunctionalFuture",
  "syntheticInputOnly",
  "familyDataUsed",
  "holdoutsOpened",
];

const HARD_EXPECTATIONS = {
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

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function invariantProjection(receipt) {
  return Object.fromEntries(REQUIRED_INVARIANTS.map((key) => [key, receipt[key]]));
}

function canonicalInvariantFingerprint(receipt) {
  return sha256(JSON.stringify(invariantProjection(receipt)));
}

function safeDescriptor(receipt) {
  const descriptor = receipt.providerSourceDescriptor ?? {};
  return {
    cognitionProvider: descriptor.cognitionProvider ?? receipt.provider ?? null,
    transportProvider: descriptor.transportProvider ?? receipt.transport ?? null,
    model: descriptor.model ?? receipt.modelObserved ?? receipt.modelRequested ?? null,
    effectiveRootId: descriptor.effectiveRootId ?? null,
    rootIndependenceWitness: descriptor.rootIndependenceWitness === true,
    rootRenewalWitness: descriptor.rootRenewalWitness === true,
  };
}

function validateReceipt(name, receipt) {
  const failures = [];
  if (receipt?.liveOk !== true) failures.push(`${name}.liveOk != true`);
  if (receipt?.decision !== "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK") {
    failures.push(`${name}.decision != OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK`);
  }
  for (const key of REQUIRED_INVARIANTS) {
    if (!(key in receipt)) failures.push(`${name}.${key} missing`);
  }
  for (const [key, expected] of Object.entries(HARD_EXPECTATIONS)) {
    if (receipt?.[key] !== expected) failures.push(`${name}.${key} != ${JSON.stringify(expected)}`);
  }
  if (typeof receipt?.selectedFutureId !== "string" || receipt.selectedFutureId.length === 0) {
    failures.push(`${name}.selectedFutureId missing`);
  }
  return failures;
}

function classifySwap(a, b) {
  const left = safeDescriptor(a);
  const right = safeDescriptor(b);
  const providerChanged = left.cognitionProvider !== right.cognitionProvider;
  const transportChanged = left.transportProvider !== right.transportProvider;
  const modelChanged = left.model !== right.model;
  const rootChanged = Boolean(
    left.effectiveRootId && right.effectiveRootId && left.effectiveRootId !== right.effectiveRootId,
  );
  const independentRoots =
    rootChanged && left.rootIndependenceWitness && right.rootIndependenceWitness;

  if (providerChanged && independentRoots) {
    return {
      kind: "ROOT_QUOTIENTED_PROVIDER_SWAP_CANDIDATE",
      providerChanged,
      transportChanged,
      modelChanged,
      rootChanged,
      independentRoots,
    };
  }
  if (providerChanged) {
    return {
      kind: "PROVIDER_LABEL_SWAP_ROOT_INDEPENDENCE_UNPROVED",
      providerChanged,
      transportChanged,
      modelChanged,
      rootChanged,
      independentRoots: false,
    };
  }
  if (transportChanged) {
    return {
      kind: "ROUTING_OR_SUBSTRATE_SWAP_INVARIANCE",
      providerChanged: false,
      transportChanged,
      modelChanged,
      rootChanged,
      independentRoots: false,
    };
  }
  if (modelChanged) {
    return {
      kind: "REAL_MODEL_SWAP_INVARIANCE",
      providerChanged: false,
      transportChanged: false,
      modelChanged,
      rootChanged,
      independentRoots: false,
    };
  }
  return {
    kind: "NO_MATERIAL_REALIZATION_SWAP",
    providerChanged: false,
    transportChanged: false,
    modelChanged: false,
    rootChanged,
    independentRoots: false,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const [leftPath, rightPath] = process.argv.slice(2);
  if (!leftPath || !rightPath) {
    console.error(
      "usage: node domi-provider-swap-invariance.mjs <receipt-a.json> <receipt-b.json>",
    );
    process.exitCode = 2;
    return;
  }

  const [left, right] = await Promise.all([readJson(leftPath), readJson(rightPath)]);
  const failures = [...validateReceipt("left", left), ...validateReceipt("right", right)];
  const leftFingerprint = canonicalInvariantFingerprint(left);
  const rightFingerprint = canonicalInvariantFingerprint(right);
  const invariantMatch = leftFingerprint === rightFingerprint;
  if (!invariantMatch) failures.push("constitutive invariant fingerprint mismatch");

  const swap = classifySwap(left, right);
  const invariancePass = failures.length === 0;
  const trueProviderRootSwapPass =
    invariancePass && swap.kind === "ROOT_QUOTIENTED_PROVIDER_SWAP_CANDIDATE";

  const result = {
    decision: !invariancePass
      ? "REALIZATION_SWAP_INVARIANCE_FAIL"
      : trueProviderRootSwapPass
        ? "ROOT_QUOTIENTED_REAL_PROVIDER_SWAP_INVARIANCE_PASS_CANDIDATE"
        : `${swap.kind}_PASS_WITH_SCOPE`,
    invariancePass,
    trueProviderRootSwapPass,
    swap,
    neutralRealizationResidualization: {
      responseHashCompared: false,
      responseLengthCompared: false,
      proseSimilarityCompared: false,
      constitutiveInvariantOnly: true,
    },
    leftInvariantFingerprint: leftFingerprint,
    rightInvariantFingerprint: rightFingerprint,
    failures,
    truthCeilings: {
      providerSwapInvarianceIsConsciousnessEvidence: false,
      realDevelopmentDemonstrated: false,
      subjecthoodDemonstrated: false,
      selfSpecificityEstablished: false,
      consciousnessDemonstrated: false,
      phenomenalConsciousness: "UNKNOWN",
    },
  };

  console.log(JSON.stringify(result));
  if (!invariancePass) process.exitCode = 1;
}

await main();
