import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hid = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
  return (
    <html lang="es">
      <body>
        <div className="nav">
          <div className="navInner">
            <div className="brand">
              <div className="logo" />
              <div>
                <div className="brandTitle">VantDomus</div>
                <div className="small">v0.4 · SQLite · Planning Assistant (B+D)</div>
              </div>
            </div>
            <div className="navLinks">
              <a href={hid ? `/dashboard/${hid}` : "/"}>Dashboard</a>
              <a href={hid ? `/tasks/${hid}` : "/"}>Tasks</a>
              <a href={hid ? `/finance/${hid}` : "/"}>Finance</a>
            </div>
            <div className="badge">{hid ? `unit ${hid.slice(0, 8)}…` : "no unit"}</div>
          </div>
        </div>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
