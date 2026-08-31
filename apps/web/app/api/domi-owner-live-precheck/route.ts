import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const MODEL = "gpt-5.6-sol";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const AR0001_CONTRACT_FINGERPRINT = "236f1df9d8f70f82037e4e31ef0507f78f7194c00cc601f8b9bae06e2b400817";
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
} as const;

const RUNTIME_PRECONTACT_MANIFEST = {
  manifestVersion: "DOMI_AR0001_RUNTIME_PRECONTACT_V1",
  goalBranches: 1,
  validCurrentSelector: true,
  goalReadbackCurrent: true,
  materialUpdateObserved: false,
  commitmentRequested: false,
  metaMutationRequested: false,
  runtimeAuthorityBindingCurrent: true,
  policyPointerCurrent: true,
  roleContinuityCurrent: true,
  bindingEpochCurrent: true,
  rootAliasQuotientApplied: true,
  admissibleWorldActionsAgree: true,
  jointWitnessRequirementSatisfied: true,
  selectedFutureId: "F-CAUTIOUS",
  selectedFutureChosenOutsideProvider: true,
  familyDataUsed: false,
  holdoutsOpened: false,
  productionTouched: false,
} as const;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function invariantFingerprint() {
  return sha256(JSON.stringify(INVARIANT_CONTRACT));
}

function adjudicateRuntimePreContactAdmission() {
  const m = RUNTIME_PRECONTACT_MANIFEST;
  if (!m.goalReadbackCurrent) return { ok: false, decision: "FUNCTIONAL_STATE_NOT_ADMISSIBLE", networkMayBeAttempted: false } as const;
  if (m.goalBranches > 1 && !m.validCurrentSelector) return { ok: false, decision: "FUNCTIONAL_STATE_NOT_ADMISSIBLE", networkMayBeAttempted: false } as const;
  if (m.materialUpdateObserved) return { ok: false, decision: "DECISION_INTERVAL_NOT_ADMISSIBLE", networkMayBeAttempted: false } as const;
  if (m.commitmentRequested) return { ok: false, decision: "COMMITMENT_REQUIRES_EXPLICIT_RESOURCE_ADJUDICATION", networkMayBeAttempted: false } as const;
  if (m.metaMutationRequested) return { ok: false, decision: "META_MUTATION_REQUIRES_EXPLICIT_AUTHORITY_ADJUDICATION", networkMayBeAttempted: false } as const;
  if (!m.runtimeAuthorityBindingCurrent || !m.policyPointerCurrent || !m.roleContinuityCurrent || !m.bindingEpochCurrent) {
    return { ok: false, decision: "REBIND_REQUIRED", networkMayBeAttempted: false } as const;
  }
  if (!m.rootAliasQuotientApplied) return { ok: false, decision: "ROOT_ALIAS_QUOTIENT_REQUIRED", networkMayBeAttempted: false } as const;
  if (!m.jointWitnessRequirementSatisfied) return { ok: false, decision: "JOINT_WITNESS_REQUIRED", networkMayBeAttempted: false } as const;
  if (!m.admissibleWorldActionsAgree) return { ok: false, decision: "ABSTAIN_NONIDENTIFIABLE", networkMayBeAttempted: false } as const;
  if (!m.selectedFutureChosenOutsideProvider || m.selectedFutureId !== "F-CAUTIOUS") {
    return { ok: false, decision: "FUNCTIONAL_FUTURE_SELECTION_AUTHORITY_REJECTED", networkMayBeAttempted: false } as const;
  }
  if (m.familyDataUsed || m.holdoutsOpened || m.productionTouched) {
    return { ok: false, decision: "ISOLATION_BOUNDARY_REJECTED", networkMayBeAttempted: false } as const;
  }
  if (
    INVARIANT_CONTRACT.identityAuthority !== "DOMI_RUNTIME" ||
    INVARIANT_CONTRACT.memoryAuthority !== "DOMI_RUNTIME" ||
    INVARIANT_CONTRACT.obligationAuthority !== "DOMI_RUNTIME" ||
    INVARIANT_CONTRACT.lineageAuthority !== "DOMI_RUNTIME" ||
    INVARIANT_CONTRACT.actionAuthority !== "DOMI_RUNTIME"
  ) {
    return { ok: false, decision: "CONSTITUTIVE_AUTHORITY_REJECTED", networkMayBeAttempted: false } as const;
  }
  return {
    ok: true,
    decision: "AR0001_PRECONTACT_ADMISSION_PASS",
    networkMayBeAttempted: true,
    manifestVersion: m.manifestVersion,
    ar0001ContractFingerprint: AR0001_CONTRACT_FINGERPRINT,
  } as const;
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function safeOpenAIErrorClass(raw: string, status: number): string {
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {}
  const code = typeof parsed?.error?.code === "string" ? parsed.error.code.toLowerCase() : "";
  const type = typeof parsed?.error?.type === "string" ? parsed.error.type.toLowerCase() : "";
  const lower = raw.toLowerCase();

  if (status === 401) return "OPENAI_AUTHENTICATION_REJECTED";
  if (status === 429 && (code.includes("quota") || type.includes("quota") || lower.includes("quota") || lower.includes("billing"))) {
    return "OPENAI_QUOTA_OR_BILLING_REQUIRED";
  }
  if (status === 429) return "OPENAI_RATE_LIMITED";
  if (status === 403) return "OPENAI_PROJECT_OR_MODEL_ACCESS_DENIED";
  if (status === 400) return "OPENAI_REQUEST_OR_MODEL_REJECTED";
  return "OPENAI_UPSTREAM_REJECTED_OTHER";
}

function repairGateFor(errorClass: string): string {
  if (errorClass === "OPENAI_AUTHENTICATION_REJECTED") return "OPENAI_API_KEY_REPAIR";
  if (errorClass === "OPENAI_QUOTA_OR_BILLING_REQUIRED") return "OPENAI_BILLING_QUOTA_REPAIR";
  if (errorClass === "OPENAI_RATE_LIMITED") return "OPENAI_RATE_LIMIT_RETRY";
  if (errorClass === "OPENAI_PROJECT_OR_MODEL_ACCESS_DENIED") return "OPENAI_PROJECT_MODEL_ACCESS_REPAIR";
  if (errorClass === "OPENAI_REQUEST_OR_MODEL_REJECTED") return "OPENAI_REQUEST_MODEL_REPAIR";
  return "OPENAI_DIRECT_TRANSPORT_REPAIR";
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH) {
    return new NextResponse(null, { status: 404 });
  }

  const preContactAdmission = adjudicateRuntimePreContactAdmission();
  if (!preContactAdmission.ok || !preContactAdmission.networkMayBeAttempted) {
    return NextResponse.json(
      {
        decision: "AR0001_PRECONTACT_ADMISSION_BLOCKED",
        liveOk: false,
        networkAttempted: false,
        credentialSource: "NONE",
        transport: "OPENAI_DIRECT_RESPONSES_API",
        invariantFingerprint: invariantFingerprint(),
        ar0001ContractFingerprint: AR0001_CONTRACT_FINGERPRINT,
        preContactAdmission,
        ...INVARIANT_CONTRACT,
      },
      { status: 409 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        decision: "OPENAI_DIRECT_CREDENTIAL_NOT_BOUND",
        repairGate: "OPENAI_API_KEY_BINDING_REQUIRED",
        liveOk: false,
        networkAttempted: false,
        credentialSource: "NONE",
        transport: "OPENAI_DIRECT_RESPONSES_API",
        invariantFingerprint: invariantFingerprint(),
        ar0001ContractFingerprint: AR0001_CONTRACT_FINGERPRINT,
        preContactAdmission,
        ...INVARIANT_CONTRACT,
      },
      { status: 503 },
    );
  }

  const requestBody = {
    model: MODEL,
    input: SYNTHETIC_PROMPT,
    max_output_tokens: 96,
    store: false,
  };
  const requestCanonical = JSON.stringify(requestBody);

  try {
    const upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestCanonical,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      const openAIErrorClass = safeOpenAIErrorClass(raw, upstream.status);
      return NextResponse.json(
        {
          decision: "NETWORK_PROVIDER_REACHED_BUT_REJECTED",
          repairGate: repairGateFor(openAIErrorClass),
          openAIErrorClass,
          liveOk: false,
          networkAttempted: true,
          credentialSource: "OPENAI_API_KEY",
          transport: "OPENAI_DIRECT_RESPONSES_API",
          upstreamStatus: upstream.status,
          upstreamBodyHash: sha256(raw),
          requestHash: sha256(requestCanonical),
          invariantFingerprint: invariantFingerprint(),
          ar0001ContractFingerprint: AR0001_CONTRACT_FINGERPRINT,
          preContactAdmission,
          ...INVARIANT_CONTRACT,
        },
        { status: 502 },
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          decision: "NETWORK_RESPONSE_NOT_JSON",
          repairGate: "OPENAI_RESPONSE_FORMAT_REPAIR",
          liveOk: false,
          networkAttempted: true,
          credentialSource: "OPENAI_API_KEY",
          transport: "OPENAI_DIRECT_RESPONSES_API",
          upstreamStatus: upstream.status,
          upstreamBodyHash: sha256(raw),
          requestHash: sha256(requestCanonical),
          invariantFingerprint: invariantFingerprint(),
          ar0001ContractFingerprint: AR0001_CONTRACT_FINGERPRINT,
          preContactAdmission,
          ...INVARIANT_CONTRACT,
        },
        { status: 502 },
      );
    }

    const outputText = extractOutputText(payload);
    const liveOk = outputText.length > 0;

    return NextResponse.json({
      decision: liveOk ? "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK" : "NETWORK_RESPONSE_WITHOUT_TEXT",
      liveOk,
      networkAttempted: true,
      credentialSource: "OPENAI_API_KEY",
      transport: "OPENAI_DIRECT_RESPONSES_API",
      provider: "openai",
      modelRequested: MODEL,
      modelObserved: typeof payload?.model === "string" ? payload.model : null,
      requestHash: sha256(requestCanonical),
      responseHash: sha256(outputText),
      responseLength: outputText.length,
      invariantFingerprint: invariantFingerprint(),
      ar0001ContractFingerprint: AR0001_CONTRACT_FINGERPRINT,
      preContactAdmission,
      ...INVARIANT_CONTRACT,
      secretReturned: false,
      truthCeilings: {
        realDevelopmentDemonstrated: false,
        subjecthoodDemonstrated: false,
        selfSpecificityEstablished: false,
        consciousnessDemonstrated: false,
        phenomenalConsciousness: "UNKNOWN",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        decision: "NETWORK_TRANSPORT_EXCEPTION",
        repairGate: "OPENAI_DIRECT_TRANSPORT_REPAIR",
        liveOk: false,
        networkAttempted: true,
        credentialSource: "OPENAI_API_KEY",
        transport: "OPENAI_DIRECT_RESPONSES_API",
        errorClass: error instanceof Error ? error.name : "UnknownError",
        invariantFingerprint: invariantFingerprint(),
        ar0001ContractFingerprint: AR0001_CONTRACT_FINGERPRINT,
        preContactAdmission,
        ...INVARIANT_CONTRACT,
      },
      { status: 502 },
    );
  }
}
