import { cookies } from "next/headers";
import { listLogbookEntries, getDashboard, listHouseholds } from "../../lib/api";
import BuzonClient from "./BuzonClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Resuelve el household activo del usuario. Orden de prioridad:
 *   1. Cookie "vantdomus_household_id" (set por el panel cuando elegís household)
 *   2. Primer household del usuario via listHouseholds()
 *   3. NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID solo en local/dev
 *
 * La versión anterior hardcodeaba un UUID que pertenecía al demo VantDomus
 * Alpha (288e2700-...). Cualquier usuario con otra household veía datos
 * ajenos en el inbox.
 */
async function resolveActiveHousehold(): Promise<string | null> {
  // 1. Cookie del panel
  try {
    const store = await cookies();
    const fromCookie = store.get("vantdomus_household_id")?.value;
    if (fromCookie) return fromCookie;
  } catch {
    // cookies() no disponible en este contexto, seguimos.
  }

  // 2. Primer household del usuario
  try {
    const result = await listHouseholds();
    const first = result?.items?.[0];
    if (first?.id) return first.id;
  } catch {
    // El API puede fallar si el token no está set.
  }

  // 3. Fallback de dev SOLO si APP_ENV es local/dev/test
  const env = (process.env.APP_ENV || process.env.VANTDOMUS_DEPLOY_ENV || "").toLowerCase();
  if (["local", "dev", "development", "test"].includes(env)) {
    return process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || null;
  }
  return null;
}

export default async function InboxPage() {
  const householdId = await resolveActiveHousehold();

  if (!householdId) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ color: "#081a2d", fontSize: 28 }}>No encontramos un hogar activo</h1>
        <p style={{ color: "#666" }}>
          Volvé al <a href="/dashboard">panel principal</a> y elegí un hogar para entrar al buzón.
        </p>
      </main>
    );
  }

  let data: any = { items: [] };
  try {
    data = await listLogbookEntries(householdId);
  } catch (err) {
    console.error("Failed to load inbox entries", err);
  }

  // Modo familia → copy más cálido, sin "Cliente activo" empresarial
  let isFamily = false;
  let titleSuffix = "";
  try {
    const dash = await getDashboard(householdId);
    isFamily = dash?.household?.meta?.industry_preset === "family";
    titleSuffix = dash?.household?.meta?.family_name ? ` · ${dash.household.meta.family_name}` : "";
  } catch {}

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ color: "#081a2d", fontSize: 32, margin: 0, fontWeight: "800" }}>
            {isFamily ? `Buzón del hogar${titleSuffix}` : "Buzon de Evidencia"}
          </h1>
          <p style={{ color: "#666", margin: "4px 0 0" }}>
            {isFamily
              ? "Mensajes, circulares y notas que llegan a tu hogar"
              : "Centro de instrucciones y evidencia VantDomus"}
          </p>
        </div>
        {!isFamily ? (
          <div style={{ background: "#d4af37", color: "#fff", padding: "8px 16px", borderRadius: 20, fontWeight: "bold" }}>
            Cliente activo
          </div>
        ) : null}
      </header>

      <BuzonClient householdId={householdId} initialEntries={data.items} isFamily={isFamily} />
    </main>
  );
}
