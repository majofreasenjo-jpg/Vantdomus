export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

function publicRequestUrl(path: string) {
  return typeof window === "undefined" ? `${API_BASE}${path}` : `/api/public${path}`;
}

export async function publicApiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(publicRequestUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

// SECURITY: credentials travel in the JSON body, never in the URL.
// The previous version appended email+password to the query string, which
// leaks them through proxy/CDN access logs, browser history, and server logs.
export const loginWithPassword = (email: string, password: string, mfaCode = "") => {
  const payload: Record<string, string> = { email, password };
  const trimmedMfa = mfaCode.trim();
  if (trimmedMfa) payload.mfa_code = trimmedMfa;
  return publicApiFetch(`/auth/login`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// SECURITY: send tokens / emails in the JSON body so they don't end up in
// proxy / CDN access logs or browser history.
export const verifyEmail = (token: string) =>
  publicApiFetch(`/auth/email/verify`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const requestPasswordReset = (email: string) =>
  publicApiFetch(`/auth/password/reset/request`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const confirmPasswordReset = (token: string, newPassword: string) =>
  publicApiFetch("/auth/password/reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
