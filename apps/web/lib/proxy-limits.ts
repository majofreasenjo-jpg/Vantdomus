export const AUTHENTICATED_PROXY_MAX_BODY_BYTES = Number(process.env.VANTDOMUS_WEB_PROXY_MAX_BODY_BYTES || 10 * 1024 * 1024);
export const PUBLIC_PROXY_MAX_BODY_BYTES = Number(process.env.VANTDOMUS_WEB_PUBLIC_PROXY_MAX_BODY_BYTES || 1024 * 1024);

export function requestBodyTooLarge(contentLength: string | null, maxBytes: number) {
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > maxBytes;
}
