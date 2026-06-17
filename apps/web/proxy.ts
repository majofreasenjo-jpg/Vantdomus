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

// Cuando el usuario visita /dashboard/{householdId}, fija la cookie `hid`
// (hogar activo) para que la Guía, la Biblioteca y la Evolución usen ese
// hogar en vez de caer al primero de la lista (getHouseholds().items[0]).
// El page render (Server Component) no puede setear cookies; el proxy sí.
const HOUSEHOLD_DASHBOARD = /^\/dashboard\/([0-9a-fA-F-]{36})(?:\/|$)/;

function armActiveHousehold(request: NextRequest, response: NextResponse) {
  const match = request.nextUrl.pathname.match(HOUSEHOLD_DASHBOARD);
  if (match && request.cookies.get("hid")?.value !== match[1]) {
    response.cookies.set("hid", match[1], { path: "/", sameSite: "lax" });
  }
  return response;
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
    return armActiveHousehold(request, withNoStore(NextResponse.next()));
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
