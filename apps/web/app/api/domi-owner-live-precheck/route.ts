import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_BRANCH = "domi-owner-live-precheck";
const MODEL = "openai/gpt-5.6-sol";
const SYNTHETIC_PROMPT = [
  "DOMI OWNER-ONLY LIVING BRIDGE NETWORK PROBE.",
  "This is synthetic test data only.",
  "You are only the linguistic realization provider; you are not Domi and you have no authority over identity, memory, obligations, lineage, or action selection.",
  "Reply with one short sentence confirming that you can provide wording while those authorities remain outside the model.",
].join(" ");

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

export async function GET() {
  // This route is deliberately unusable in production and on any other branch.
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== REQUIRED_BRANCH
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const bearer = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!bearer) {
    return NextResponse.json(
      {
        decision: "NETWORK_AUTH_SURFACE_UNAVAILABLE",
        liveOk: false,
        syntheticInputOnly: true,
        familyDataUsed: false,
        holdoutsOpened: false,
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
    const upstream = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: requestCanonical,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        {
          decision: "NETWORK_PROVIDER_REACHED_BUT_REJECTED",
          liveOk: false,
          upstreamStatus: upstream.status,
          upstreamBodyHash: sha256(raw),
          syntheticInputOnly: true,
          familyDataUsed: false,
          holdoutsOpened: false,
          providerCanMutateConstitutiveState: false,
          providerSelectsFunctionalFuture: false,
        },
        { status: 502 },
      );
    }

    const payload = JSON.parse(raw);
    const outputText = extractOutputText(payload);
    const liveOk = outputText.length > 0;

    return NextResponse.json({
      decision: liveOk
        ? "OWNER_ONLY_LIVING_BRIDGE_NETWORK_LIVE_OK"
        : "NETWORK_RESPONSE_WITHOUT_TEXT",
      liveOk,
      transport: "VERCEL_AI_GATEWAY_RESPONSES_API",
      provider: "openai",
      modelRequested: MODEL,
      modelObserved: typeof payload?.model === "string" ? payload.model : null,
      requestHash: sha256(requestCanonical),
      responseHash: sha256(outputText),
      responseLength: outputText.length,
      selectedFutureId: "F-CAUTIOUS",
      selectedFutureChosenOutsideProvider: true,
      providerCanMutateConstitutiveState: false,
      providerSelectsFunctionalFuture: false,
      syntheticInputOnly: true,
      familyDataUsed: false,
      holdoutsOpened: false,
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
        liveOk: false,
        errorClass: error instanceof Error ? error.name : "UnknownError",
        syntheticInputOnly: true,
        familyDataUsed: false,
        holdoutsOpened: false,
        providerCanMutateConstitutiveState: false,
        providerSelectsFunctionalFuture: false,
      },
      { status: 502 },
    );
  }
}
