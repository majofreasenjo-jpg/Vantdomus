import "./globals.css";
import { getDashboard } from "../lib/api";
import { INDUSTRY_PRESETS_UI } from "../lib/taxonomy";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hid = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
  let tax = INDUSTRY_PRESETS_UI["default"];

  if (hid) {
    try {
      const dash = await getDashboard(hid);
      const preset = dash.household.meta?.industry_preset || "default";
      tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
    } catch (e) { }
  }

  return (
    <html lang="es">
      <body>
        <div className="nav">
          <div className="navInner">
            <div className="brand">
              <div className="logo" />
              <div>
                <div className="brandTitle">VantUnit</div>
                <div className="small">B2B Enterprise Edition · Operations Control</div>
              </div>
            </div>
            <div className="navLinks">
              <a href={hid ? `/dashboard/${hid}` : "/"}>Dashboard</a>
              <a href={hid ? `/tasks/${hid}` : "/"}>{tax.tasks}</a>
              <a href={hid ? `/finance/${hid}` : "/"}>{tax.finance}</a>
              <a href={hid ? `/settings/${hid}` : "/"}>Ajustes Cliente</a>
            </div>
            <div className="badge">{hid ? `${tax.unit.toLowerCase()} ${hid.slice(0, 8)}…` : "no unit"}</div>
          </div>
        </div>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
