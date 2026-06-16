export const CSRF_COOKIE = "vantdomus_csrf";
export const CSRF_HEADER = "X-VantDomus-CSRF";

export function newCsrfToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function browserCsrfToken() {
  if (typeof document === "undefined") return "";
  const prefix = `${CSRF_COOKIE}=`;
  const raw = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return raw ? decodeURIComponent(raw.slice(prefix.length)) : "";
}

export function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
