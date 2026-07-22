"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { API_BASE, loginWithPassword } from "../../lib/public-api";
import { getHouseholds } from "../../lib/api";
import { CSRF_COOKIE, newCsrfToken } from "../../lib/csrf";
import { cookieSecure } from "../../lib/runtimeEnv";

/**
 * Nivel de vista (densidad de la UI): "simple" oculta KPIs técnicos, márgenes
 * y jerga; "full" muestra todo (modo experto). Se guarda en cookie y el layout
 * lo expone como data-level en el body para que el CSS oculte lo avanzado.
 */
export async function setViewLevelAction(formData: FormData) {
  const raw = String(formData.get("level") || "simple");
  const level = raw === "full" ? "full" : "simple";
  const store = await cookies();
  store.set("view_level", level, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

// OPS-2 M5 — Modos de Domi: un solo Domi con configuraciones de interacción
// (visual + comportamiento + ACCESIBILIDAD). Senior tiene gate propio (letra
// grande, contraste, botones grandes, menos densidad, lectura en voz alta).
export const DOMI_MODES = ["clasico", "calma", "senior", "estudio", "protector", "noche"] as const;

export async function setDomiModeAction(formData: FormData) {
  const raw = String(formData.get("mode") || "clasico");
  const mode = (DOMI_MODES as readonly string[]).includes(raw) ? raw : "clasico";
  const store = await cookies();
  store.set("domi_mode", mode, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
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
  // Por defecto se aterriza en la home companion de Domi (vía /inicio, que
  // resuelve el hogar), no en la pantalla técnica /dashboard.
  const fallback = "/inicio";
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
  const nextPath = String(formData.get("next") || "/inicio");
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

  // Aterrizaje: si el destino es el intermedio /inicio (default), resolvemos el
  // hogar AQUÍ y redirigimos DIRECTO a /hogar/<hid> (que tiene loader cálido),
  // saltándonos /inicio — así se elimina el flash del chrome antiguo en la
  // transición. Si hay un `next` explícito distinto, se respeta.
  const target = safeNextPath(nextPath);
  if (target === "/inicio") {
    let hid = "";
    try {
      const households = (await getHouseholds()) as { items?: Array<{ id?: string }> };
      hid = households?.items?.[0]?.id || "";
    } catch {
      hid = "";
    }
    redirect(hid ? `/hogar/${hid}` : "/dashboard");
  }
  redirect(target);
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
