import { NextResponse } from "next/server";

/**
 * R76 — Preview-only, read-only reachability probe of DOMI Family FastAPI.
 *
 * No client credentials, cookies, raw upstream response, remote hostname,
 * provider tokens, health counters or personal information are returned.
 * This is a transport check — not a proof of authentication, database writes,
 * persistent memory, household access or deployment readiness.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PREVIEW_BRANCH = "domi-neon-staging-pg-startup-gate-20261010";
const PROBE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function statusResult(state: string, httpStatus: number | null = null) {
  return NextResponse.json(
    { probe: "domi-family-backend-r76", state, upstreamHttpStatus: httpStatus,
      authenticatedJourneyVerified: false, databasePersistenceVerified: false },
    { status: 200, headers: PROBE_HEADERS },
  );
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== PREVIEW_BRANCH) {
    return new NextResponse(null, { status: 404, headers: PROBE_HEADERS });
  }

  const raw = process.env.NEXT_PUBLIC_API_BASE || "";
  let base: URL;
  try {
    base = new URL(raw);
    if (base.protocol !== "https:" || base.username || base.password ||
        !base.hostname || base.search || base.hash) {
      return statusResult("invalid_backend_configuration");
    }
  } catch {
    return statusResult("backend_not_configured");
  }

  // Fixed route, no caller-controlled hostname/path or authorization headers.
  const target = new URL("/health", base);
  try {
    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(7000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return statusResult("backend_http_error", response.status);

    const type = response.headers.get("content-type") || "";
    if (!type.toLowerCase().includes("application/json")) {
      return statusResult("unexpected_backend_response", response.status);
    }
    // The FastAPI health contract is {ok:true, service:"vantdomus-core"}.
    // Never reflect the body or version to unauthenticated Preview viewers.
    const body = await response.json();
    if (body?.ok !== true || body?.service !== "vantdomus-core") {
      return statusResult("unexpected_backend_response", response.status);
    }
    return statusResult("backend_health_reachable", response.status);
  } catch (error: unknown) {
    const timedOut = error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return statusResult(timedOut ? "backend_timeout" : "backend_unreachable");
  }
}
