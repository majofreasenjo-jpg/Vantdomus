"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE, loginWithPassword } from "../../lib/public-api";
import { CSRF_COOKIE, newCsrfToken } from "../../lib/csrf";

function cookieSecure() {
  const env = (process.env.APP_ENV || process.env.VANTDOMUS_DEPLOY_ENV || "local").toLowerCase();
  return env === "production" || env === "prod" || env === "staging";
}

/**
 * Safely resolve the post-login redirect target.
 *
 * Only allows same-origin paths. Rejects:
 *  - protocol-relative URLs (`//attacker.com/x`)
 *  - backslash-escaped variants (`/\evil.com`)
 *  - absolute URLs (`http://...`, `javascript:...`)
 *  - anything that doesn't start with a single forward slash
 */
function safeNextPath(raw: string): string {
  const fallback = "/dashboard";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  // Reject protocol-relative URLs (// or /\ which some browsers normalize as //)
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  // Reject control characters and embedded schemes
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;
  return trimmed;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const mfaCode = String(formData.get("mfa_code") || "").trim();
  const nextPath = String(formData.get("next") || "/dashboard");
  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Ingresa email y contrasena")}`);
  }

  try {
    const session = await loginWithPassword(email, password, mfaCode);
    const store = await cookies();
    store.set("vantdomus_access_token", session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: Number(session.expires_in || 28800),
    });
    store.set("vantdomus_session_id", session.session_id || "", {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: Number(session.expires_in || 28800),
    });
    store.set(CSRF_COOKIE, newCsrfToken(), {
      httpOnly: false,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: Number(session.expires_in || 28800),
    });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("428")
      ? "MFA requerido: ingresa tu codigo"
      : "Credenciales invalidas o cuenta bloqueada";
    redirect(`/login?error=${encodeURIComponent(message)}&email=${encodeURIComponent(email)}`);
  }

  redirect(safeNextPath(nextPath));
}

export async function logoutAction() {
  const store = await cookies();
  const accessToken = store.get("vantdomus_access_token")?.value || "";
  if (accessToken) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
    } catch {
      // Local cookie cleanup still proceeds if the API is unreachable.
    }
  }
  store.delete("vantdomus_access_token");
  store.delete("vantdomus_session_id");
  store.delete(CSRF_COOKIE);
  redirect("/login");
}
