export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, max-age=0, must-revalidate",
  "content-type": "application/json; charset=utf-8",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nonce = url.searchParams.get("nonce") ?? "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(nonce)) {
    return new Response(JSON.stringify({
      ok: false,
      error: "P5_FIELD_BETA_PREFLIGHT_NONCE_INVALID",
    }), {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  const vercelEnv = process.env.VERCEL_ENV ?? "unknown";
  if (vercelEnv !== "preview") {
    return new Response(JSON.stringify({
      version: "DOMI_P5_FIELD_BETA_PREFLIGHT_V0_1",
      ok: false,
      error: "P5_FIELD_BETA_PREVIEW_ONLY",
      previewEnvironmentPass: false,
      clientNonce: nonce,
      vercelEnv,
    }), {
      status: 403,
      headers: NO_STORE_HEADERS,
    });
  }

  return new Response(JSON.stringify({
    version: "DOMI_P5_FIELD_BETA_PREFLIGHT_V0_1",
    ok: true,
    previewEnvironmentPass: true,
    probeId: crypto.randomUUID(),
    clientNonce: nonce,
    serverTime: new Date().toISOString(),
    vercelEnv,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    productionMutationAllowed: false,
    realOwnerMemoryAllowed: false,
    externalOutreachAuthorized: false,
  }), {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}
