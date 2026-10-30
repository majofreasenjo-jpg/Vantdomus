/**
 * R88: origin validation independent of Next.js dev internal URL rewriting.
 * In next dev, request.nextUrl.origin can be localhost while browser Host is
 * 127.0.0.1. Enforce exact HTTP(S) Origin-to-Host matching, not wildcard or suffix.
 */
export function sameOriginForProxy(origin, host, fallbackOrigin) {
  if (!origin) return true;
  if (typeof origin !== "string" || typeof host !== "string") return false;
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username ||
        parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return false;
    if (fallbackOrigin && origin === fallbackOrigin) return true;
    return parsed.host === host.toLowerCase();
  } catch {
    return false;
  }
}
