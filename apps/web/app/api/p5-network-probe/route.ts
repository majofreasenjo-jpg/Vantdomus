export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, max-age=0, must-revalidate",
  "content-type": "application/json; charset=utf-8",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nonce = url.searchParams.get("nonce") ?? "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(nonce)) {
    return new Response(JSON.stringify({ ok: false, error: "P5_NETWORK_PROBE_NONCE_INVALID" }), {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  return new Response(JSON.stringify({
    version: "DOMI_P5_NETWORK_PROBE_V0_1",
    ok: true,
    probeId: crypto.randomUUID(),
    clientNonce: nonce,
    serverTime: new Date().toISOString(),
  }), {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}
