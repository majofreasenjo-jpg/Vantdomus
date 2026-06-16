import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "../../../../lib/public-api";
import { CSRF_COOKIE, CSRF_HEADER, isUnsafeMethod } from "../../../../lib/csrf";
import { AUTHENTICATED_PROXY_MAX_BODY_BYTES, requestBodyTooLarge } from "../../../../lib/proxy-limits";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

// SECURITY: fail-closed env detection.
// Only treat the env as local/dev if it's *explicitly* named so.
// Any unrecognised or unset value is treated as production-like, which
// DISABLES the NEXT_PUBLIC_ACCESS_TOKEN fallback.
const LOCAL_ENV_NAMES = new Set(["local", "development", "dev", "test"]);

function isLocalEnv() {
  const env = (process.env.APP_ENV || process.env.VANTDOMUS_DEPLOY_ENV || "").toLowerCase();
  return LOCAL_ENV_NAMES.has(env);
}

async function bearerToken() {
  const store = await cookies();
  const sessionToken = store.get("vantdomus_access_token")?.value || "";
  if (sessionToken) return sessionToken;
  // Only fall back to the public env token in explicitly-local environments.
  return isLocalEnv() ? process.env.NEXT_PUBLIC_ACCESS_TOKEN || "" : "";
}

function upstreamHeaders(request: NextRequest, token: string) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowered = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowered) && lowered !== "cookie" && lowered !== "authorization") {
      headers.set(key, value);
    }
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}

async function validateCsrf(request: NextRequest) {
  if (!isUnsafeMethod(request.method)) return null;
  if (!sameOrigin(request)) {
    return NextResponse.json({ detail: "Invalid request origin" }, { status: 403 });
  }
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value || "";
  const headerToken = request.headers.get(CSRF_HEADER) || "";
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ detail: "CSRF validation failed" }, { status: 403 });
  }
  return null;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const token = await bearerToken();
  if (!token) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  const csrfFailure = await validateCsrf(request);
  if (csrfFailure) return csrfFailure;
  if (requestBodyTooLarge(request.headers.get("content-length"), AUTHENTICATED_PROXY_MAX_BODY_BYTES)) {
    return NextResponse.json({ detail: "Request body too large" }, { status: 413 });
  }

  const upstreamUrl = new URL(`/${path.map(encodeURIComponent).join("/")}`, API_BASE);
  upstreamUrl.search = request.nextUrl.search;
  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders(request, token),
    body: hasBody ? request.body : undefined,
    cache: "no-store",
    duplex: hasBody ? "half" : undefined,
  } as RequestInit & { duplex?: "half" });

  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
