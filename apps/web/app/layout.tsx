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


  // Mode familia: oculta secciones B2B (Direccion / Centro Operativo) y
  // renombra el brand + nav para que el copy sea coherente con el preset
  // familiar. La detección es por industry_preset (rich preset family lo
  // marca con family_mode=true).
  const isFamily = Boolean(tax.family_mode);
  const familyName: string | undefined = (tax as any).__familyName; // not used now, but reserved
  const brandSubline = isFamily
    ? "Tu hogar, organizado con ayuda de IA"
    : `${tax.product_line || "Planificador de Unidades"} - ${tax.domain_label || "Cliente adaptable"}`;

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
                <div className="brandTitle">{isFamily ? "VantDomus Hogar" : "VantDomus"}</div>
                <div className="small">{brandSubline}</div>
              </div>
            </div>
            <div className="navLinks">
              {/* Las secciones B2B "Direccion" y "Centro Operativo" SOLO
                  aparecen cuando NO es modo familia. En familia rompen la
                  inmersión y revelan la naturaleza B2B del producto. */}
              {!isFamily ? (
                <>
                  <a href="/ceo" style={{ color: "var(--good)", fontWeight: "bold" }}>Direccion</a>
                  <a href="/gerencia" style={{ color: "var(--warn)", fontWeight: "bold" }}>Centro Operativo</a>
                </>
              ) : null}
              <a href={hid ? `/dashboard/${hid}` : "/"}>{isFamily ? "Inicio" : "Dashboard"}</a>
              {/* Sprint VG+2: "Guía" + "Biblioteca" como pilares del producto VantGuide.
                  Codex 5.5: nav genérico "Guía", título contextual por preset. */}
              <a href="/guia" style={{ color: "var(--primary)", fontWeight: "bold" }}>Guía</a>
              <a href="/biblioteca" style={{ color: "var(--primary)", fontWeight: "bold" }}>Biblioteca</a>
              <a href={hid ? `/tasks/${hid}` : "/"}>{isFamily ? "Agenda" : tax.tasks}</a>
              <a href={hid ? `/health/${hid}` : "/"}>{isFamily ? "Salud" : tax.health}</a>
              <a href={hid ? `/finance/${hid}` : "/"}>{isFamily ? "Presupuesto" : tax.finance}</a>
              <a href={hid ? `/esg/${hid}` : "/"}>{isFamily ? "Documentos" : tax.esg}</a>
              <a href="/inbox">{isFamily ? "Buzón" : "Buzón"}</a>
              <a href={hid ? `/settings/${hid}` : "/"}>{isFamily ? "Ajustes" : "Ajustes Cliente"}</a>
            </div>
            {hasSession ? (
              <form action={logoutAction}>
                <button className="btn" type="submit">{isFamily ? "Cerrar sesión" : "Salir"}</button>
              </form>
            ) : (
              <a className="btn" href="/login">Entrar</a>
            )}
            {/* En modo familia, el badge muestra el nombre del hogar (no su UUID). */}
            <div className="badge">
              {hid ? (
                isFamily
                  ? (tax.unit || "Tu hogar")
                  : `${tax.unit.toLowerCase()} ${hid.slice(0, 8)}…`
              ) : "sin unidad"}
            </div>
          </div>
        </div>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
