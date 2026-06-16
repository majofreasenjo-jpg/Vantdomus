import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "../../../../lib/public-api";
import { PUBLIC_PROXY_MAX_BODY_BYTES, requestBodyTooLarge } from "../../../../lib/proxy-limits";

const ALLOWED_PUBLIC_PATHS = new Set([
  "auth/login",
  "auth/email/verify",
  "auth/password/reset/request",
  "auth/password/reset/confirm",
]);

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

function upstreamHeaders(request: NextRequest) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowered = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowered) && lowered !== "cookie" && lowered !== "authorization") {
      headers.set(key, value);
    }
  });
  return headers;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const normalizedPath = path.join("/");
  if (!ALLOWED_PUBLIC_PATHS.has(normalizedPath)) {
    return NextResponse.json({ detail: "Public proxy route not allowed" }, { status: 404 });
  }
  if (request.method.toUpperCase() !== "GET" && !sameOrigin(request)) {
    return NextResponse.json({ detail: "Invalid request origin" }, { status: 403 });
  }
  if (requestBodyTooLarge(request.headers.get("content-length"), PUBLIC_PROXY_MAX_BODY_BYTES)) {
    return NextResponse.json({ detail: "Request body too large" }, { status: 413 });
  }
  const upstreamUrl = new URL(`/${path.map(encodeURIComponent).join("/")}`, API_BASE);
  upstreamUrl.search = request.nextUrl.search;
  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders(request),
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
