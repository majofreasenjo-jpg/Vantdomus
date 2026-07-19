import "./globals.css";
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { getDashboard, getHouseholds } from "../lib/api";
import { INDUSTRY_PRESETS_UI } from "../lib/taxonomy";
import { cookies } from "next/headers";
import { logoutAction, setViewLevelAction } from "./login/actions";
import NavLink from "./components/NavLink";
import Celebrate from "./components/Celebrate";
import DomiIcon from "./components/domiIcons";

// Tipografía humanista redondeada y cálida, coherente con "hogar".
// Se expone como CSS var --font-family-warm y se aplica en modo familia.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

// CP1d-FAMILY-PILOT-WEB-HARDENING: metadata robots global (genera el
// <meta name="robots"> en TODAS las páginas). Tercera capa junto al header
// X-Robots-Tag (next.config.js) y robots.txt (Disallow: /).
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let hid = "";
  let tax = INDUSTRY_PRESETS_UI["default"];
  let meRole: string | null = null;
  let moduleVis: Record<string, string> = {};
  const store = await cookies();
  const hasSession = Boolean(store.get("vantdomus_session_id")?.value || store.get("vantdomus_access_token")?.value);
  const cookieHid = store.get("hid")?.value || "";
  const envHid = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
  const viewLevel = store.get("view_level")?.value === "full" ? "full" : "simple";

  // 1. Prefer the active client selected by the app.
  if (cookieHid) {
    hid = cookieHid;
    try {
      const dash = await getDashboard(hid);
      const preset = dash.household.meta?.industry_preset || "default";
      tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
      meRole = dash.me?.role || null;
      moduleVis = dash.household.meta?.module_visibility || {};
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
  // #17 visibilidad por módulo: ocultar links sensibles si el rol no alcanza.
  const ROLE_RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
  const canSee = (mod: string) => {
    if (!meRole) return true; // sin rol conocido (B2B u owner directo) → no filtrar
    const need = moduleVis[mod] || "viewer";
    return (ROLE_RANK[meRole] ?? -1) >= (ROLE_RANK[need] ?? 0);
  };
  const familyName: string | undefined = (tax as any).__familyName; // not used now, but reserved
  const brandSubline = isFamily
    ? "Tu hogar, organizado con ayuda de IA"
    : `${tax.product_line || "Planificador de Unidades"} - ${tax.domain_label || "Cliente adaptable"}`;

  return (
    <html lang="es" className={nunito.variable} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        data-theme={isFamily ? "family" : undefined}
        data-level={isFamily ? viewLevel : undefined}
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
            {hasSession ? (
              isFamily ? (
                /* U1-COMPANION: navegación reducida. La home es Domi; los módulos
                   viven bajo "Más" (no como pestañas de primer nivel). */
                <div className="navLinks">
                  <NavLink href={hid ? `/hogar/${hid}` : "/"}>Inicio</NavLink>
                  <NavLink href={hid ? `/recordatorios/${hid}` : "/"}>Hoy</NavLink>
                  <NavLink href="/guia">Guía</NavLink>
                  {canSee("documents") ? <NavLink href={hid ? `/documents/${hid}` : "/"}>Documentos</NavLink> : null}
                  <details className="moreMenu">
                    <summary><span className="navMore">Más ▾</span></summary>
                    <div className="morePanel">
                      {hid ? <a href={`/avisos/${hid}`}>Mural</a> : null}
                      {hid ? <a href={`/compras/${hid}`}>Compras</a> : null}
                      {canSee("health") && hid ? <a href={`/health/${hid}`}>Salud</a> : null}
                      {canSee("finance") && hid ? <a href={`/finance/${hid}`}>Presupuesto</a> : null}
                      <a href="/biblioteca">Biblioteca</a>
                      {hid ? <a href={`/tasks/${hid}`}>Agenda</a> : null}
                      {hid ? <a href={`/perfiles/${hid}`}>Perfiles</a> : null}
                      {hid ? <a href={`/settings/${hid}`}>Ajustes</a> : null}
                    </div>
                  </details>
                </div>
              ) : (
                <div className="navLinks">
                  <a href="/ceo" style={{ color: "var(--good)", fontWeight: "bold" }}>Direccion</a>
                  <a href="/gerencia" style={{ color: "var(--warn)", fontWeight: "bold" }}>Centro Operativo</a>
                  <NavLink href={hid ? `/dashboard/${hid}` : "/"}>Dashboard</NavLink>
                  <NavLink href="/guia" style={{ color: "var(--primary)", fontWeight: "bold" }}>Guía</NavLink>
                  <NavLink href="/biblioteca" style={{ color: "var(--primary)", fontWeight: "bold" }}>Biblioteca</NavLink>
                  <NavLink href={hid ? `/tasks/${hid}` : "/"}>{tax.tasks}</NavLink>
                  {canSee("health") ? <NavLink href={hid ? `/health/${hid}` : "/"}>{tax.health}</NavLink> : null}
                  {canSee("finance") ? <NavLink href={hid ? `/finance/${hid}` : "/"}>{tax.finance}</NavLink> : null}
                  {canSee("documents") ? <NavLink href={hid ? `/esg/${hid}` : "/"}>{tax.esg}</NavLink> : null}
                  <NavLink href="/inbox">Buzón</NavLink>
                  <NavLink href={hid ? `/settings/${hid}` : "/"}>Ajustes Cliente</NavLink>
                </div>
              )
            ) : null}
            {isFamily ? (
              <form action={setViewLevelAction}>
                <input type="hidden" name="level" value={viewLevel === "simple" ? "full" : "simple"} />
                <button className="btn" type="submit" title="Cambiar nivel de detalle"
                  style={{ fontSize: 12, padding: "6px 10px" }}>
                  {viewLevel === "simple" ? "Vista simple" : "Vista completa"}
                </button>
              </form>
            ) : null}
            {hasSession ? (
              <form action={logoutAction}>
                <button className="btn" type="submit">{isFamily ? "Cerrar sesión" : "Salir"}</button>
              </form>
            ) : (
              <a className="btn" href="/login">Entrar</a>
            )}
            {/* En modo familia, el badge muestra el nombre del hogar (no su UUID). */}
            <div className="badge" style={{ whiteSpace: "nowrap", alignSelf: "center", display: "inline-flex", alignItems: "center" }}>
              {hid ? (
                isFamily
                  ? (tax.unit || "Tu hogar")
                  : `${tax.unit.toLowerCase()} ${hid.slice(0, 8)}…`
              ) : "sin unidad"}
            </div>
          </div>
        </div>
        <div className="container">{children}</div>
        {isFamily ? <Celebrate /> : null}
        {/* Bottom nav móvil (companion-first). Solo visible en pantallas chicas. */}
        {isFamily && hasSession && hid ? (
          <nav className="bottomNav" aria-label="Navegación">
            <a href={`/hogar/${hid}`}><DomiIcon name="home" size={20} color="currentColor" /><span>Inicio</span></a>
            <a href={`/recordatorios/${hid}`}><DomiIcon name="calendar" size={20} color="currentColor" /><span>Hoy</span></a>
            <a className="bnDomi" href={`/hogar/${hid}`} aria-label="Hablar con Domi"><span className="bnDomiDot" /></a>
            <a href={`/documents/${hid}`}><DomiIcon name="file" size={20} color="currentColor" /><span>Documentos</span></a>
            <a href="/guia"><DomiIcon name="guide" size={20} color="currentColor" /><span>Guía</span></a>
          </nav>
        ) : null}
      </body>
    </html>
  );
}
