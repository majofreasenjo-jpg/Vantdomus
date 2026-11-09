/** R94-G — browser input is untrusted at the public/private Next.js API hop.
 * Only the server's own fetch may synthesize Host and forwarded metadata.
 * This predicate is deliberately independent of Node/Next for adversarial tests.
 */
const BLOCKED = new Set([
  "connection", "content-length", "host", "keep-alive",
  "proxy-authenticate", "proxy-authorization", "te", "trailer",
  "transfer-encoding", "upgrade", "cookie", "authorization",
  "forwarded", "x-real-ip", "x-original-host", "x-original-url",
  "x-rewrite-url",
]);

export function safeBrowserHeaderForApiHop(name) {
  if (typeof name !== "string") return false;
  const lowered = name.toLowerCase();
  if (lowered.startsWith("x-forwarded-") || lowered.startsWith("x-original-")) return false;
  return !BLOCKED.has(lowered);
}
