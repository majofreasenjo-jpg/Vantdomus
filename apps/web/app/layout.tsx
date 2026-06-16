import "./globals.css";
import { getDashboard, getHouseholds } from "../lib/api";
import { INDUSTRY_PRESETS_UI } from "../lib/taxonomy";
import { cookies } from "next/headers";
import { logoutAction } from "./login/actions";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let hid = "";
  let tax = INDUSTRY_PRESETS_UI["default"];
  const store = await cookies();
  const hasSession = Boolean(store.get("vantdomus_session_id")?.value || store.get("vantdomus_access_token")?.value);
  const cookieHid = store.get("hid")?.value || "";
  const envHid = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";

  // 1. Prefer the active client selected by the app.
  if (cookieHid) {
    hid = cookieHid;
    try {
      const dash = await getDashboard(hid);
      const preset = dash.household.meta?.industry_preset || "default";
      tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
    } catch (e) {
      hid = "";
    }
  }

  // 2. Auto-heal after rebuilding demo data: use the newest valid unit.
  if (!hid) {
    try {
      const h_list = await getHouseholds();
      if (h_list.items && h_list.items.length > 0) {
        hid = h_list.items[0].id;
        const dash = await getDashboard(hid);
        const preset = dash.household.meta?.industry_preset || "default";
        tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
      }
    } catch(e) {}
  }

  // 3. Last fallback: env default, only if still valid.
  if (hid) {
    // Already resolved above.
  } else if (envHid) {
    hid = envHid;
    try {
      const dash = await getDashboard(hid);
      const preset = dash.household.meta?.industry_preset || "default";
      tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
    } catch (e) {
      hid = ""; 
    }
  }


  return (
    <html lang="es" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        style={{ '--bg': tax.theme?.bg || '#0b0f17', '--primary': tax.theme?.primary || '#5b7cfa' } as React.CSSProperties}
      >
        <div className="nav">
          <div className="navInner">
            <div className="brand">
              <div className="logo" />
              <div>
                <div className="brandTitle">VantDomus</div>
                <div className="small">{tax.product_line || "Planificador de Unidades"} - {tax.domain_label || "Cliente adaptable"}</div>
              </div>
            </div>
            <div className="navLinks">
              <a href="/ceo" style={{ color: "var(--good)", fontWeight: "bold" }}>Direccion</a>
              <a href="/gerencia" style={{ color: "var(--warn)", fontWeight: "bold" }}>Centro Operativo</a>
              <a href={hid ? `/dashboard/${hid}` : "/"}>Dashboard</a>
              <a href={hid ? `/health/${hid}` : "/"}>{tax.health}</a>
              <a href={hid ? `/esg/${hid}` : "/"}>{tax.esg}</a>
              <a href={hid ? `/tasks/${hid}` : "/"}>{tax.tasks}</a>
              <a href={hid ? `/finance/${hid}` : "/"}>{tax.finance}</a>
              <a href={hid ? `/settings/${hid}` : "/"}>Ajustes Cliente</a>
            </div>
            {hasSession ? (
              <form action={logoutAction}>
                <button className="btn" type="submit">Salir</button>
              </form>
            ) : (
              <a className="btn" href="/login">Entrar</a>
            )}
            <div className="badge">{hid ? `${tax.unit.toLowerCase()} ${hid.slice(0, 8)}…` : "sin unidad"}</div>
          </div>
        </div>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
