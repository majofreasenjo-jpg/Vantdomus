import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/ceo",
  "/dashboard",
  "/esg",
  "/events",
  "/finance",
  "/gerencia",
  "/health",
  "/inbox",
  "/persons",
  "/settings",
  "/tasks",
];

// SECURITY: env detection is fail-closed.
// We only treat the env as "local/dev" if it's explicitly named so.
// Any unrecognised value (including unset env) is treated as production-like,
// which DISABLES the demo fallback. This prevents an unset APP_ENV on a
// hosting provider from silently opening the demo door.
const LOCAL_ENV_NAMES = new Set(["local", "development", "dev", "test"]);

function appEnv(): string {
  return (process.env.APP_ENV || process.env.VANTDOMUS_DEPLOY_ENV || "").toLowerCase();
}

function isLocalEnv() {
  return LOCAL_ENV_NAMES.has(appEnv());
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function allowLocalDemoFallback() {
  // Only honour NEXT_PUBLIC_ACCESS_TOKEN when env is *explicitly* local/dev.
  // Unset / unknown env => no fallback => fail-closed.
  return isLocalEnv() && Boolean(process.env.NEXT_PUBLIC_ACCESS_TOKEN);
}

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") {
    return withNoStore(NextResponse.next());
  }
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }
  const hasSession = Boolean(request.cookies.get("vantdomus_session_id")?.value || request.cookies.get("vantdomus_access_token")?.value);
  if (hasSession || allowLocalDemoFallback()) {
    return withNoStore(NextResponse.next());
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return withNoStore(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: [
    "/ceo/:path*",
    "/login",
    "/dashboard/:path*",
    "/esg/:path*",
    "/events/:path*",
    "/finance/:path*",
    "/gerencia/:path*",
    "/health/:path*",
    "/inbox/:path*",
    "/persons/:path*",
    "/settings/:path*",
    "/tasks/:path*",
  ],
};
