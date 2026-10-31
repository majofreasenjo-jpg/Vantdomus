"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cookieSecure } from "../../lib/runtimeEnv";
import { CSRF_COOKIE, newCsrfToken } from "../../lib/csrf";
import { r87AliasToEmail, r87LocalFirstRunEnabled, r87ValidFictionalPassword, R87_LOOPBACK_API } from "../../lib/domiR87LocalFirstRun.mjs";

export async function createFictionalHousehold(formData: FormData) {
  if (!r87LocalFirstRunEnabled()) redirect("/login");
  const alias = String(formData.get("alias") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const accepted = formData.get("fictional") === "yes";
  const email = r87AliasToEmail(alias);
  if (!accepted || !email || !r87ValidFictionalPassword(password, alias)) redirect("/local-first-run?error=invalid");

  let session: { access_token: string; session_id?: string; expires_in?: number };
  let householdId: string;
  try {
    const register = await fetch(R87_LOOPBACK_API + "/auth/register", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({email, password}), cache: "no-store", signal: AbortSignal.timeout(6000),
    });
    if (!register.ok) throw new Error("REGISTER_FAILED");
    const login = await fetch(R87_LOOPBACK_API + "/auth/login", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({email, password}), cache: "no-store", signal: AbortSignal.timeout(6000),
    });
    if (!login.ok) throw new Error("LOGIN_FAILED");
    session = await login.json();
    if (!session.access_token) throw new Error("NO_TOKEN");
    const household = await fetch(R87_LOOPBACK_API + "/households?name=" + encodeURIComponent("Hogar ficticio " + alias), {
      method:"POST", headers:{Authorization:"Bearer " + session.access_token},
      cache:"no-store", signal: AbortSignal.timeout(6000),
    });
    if (!household.ok) throw new Error("HOUSEHOLD_FAILED");
    const result = await household.json();
    householdId = String(result.id || "");
    if (!householdId) throw new Error("HOUSEHOLD_MISSING");
  } catch {
    redirect("/local-first-run?error=setup");
  }
  const store = await cookies();
  const opts = {httpOnly:true, sameSite:"lax" as const, secure:cookieSecure(),path:"/",maxAge:Math.min(Number(session.expires_in || 28800),28800)};
  store.set("vantdomus_access_token",session.access_token,opts);
  store.set("vantdomus_session_id",session.session_id || "",opts);
  store.set(CSRF_COOKIE,newCsrfToken(),{...opts,httpOnly:false});
  store.set("hid",householdId,{...opts,httpOnly:false});
  redirect("/family-access");
}
