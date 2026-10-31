/**
 * R89: strict CSRF origin check. Never trust request.nextUrl.origin as an
 * alternative to Host, and never authorize solely from a caller-supplied
 * forwarded host. Local Next dev may rewrite nextUrl.origin; compare the
 * actual Origin with Host, with HTTPS enforced outside local loopback.
 */
export function sameOriginForProxy(origin, host, fallbackOrigin) {
  if (!origin) return true; // token comparison is still mandatory for writes
  if (typeof origin !== "string" || typeof host !== "string") return false;
  try {
    const url = new URL(origin);
    if ((url.protocol !== "http:" && url.protocol !== "https:") ||
        url.username || url.password || url.search || url.hash ||
        url.pathname !== "/" || url.origin !== origin) return false;
    const hostLower = host.toLowerCase();
    if (url.host !== hostLower) return false;
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (url.protocol !== "https:" && !loopback) return false;
    return true;
  } catch { return false; }
}
