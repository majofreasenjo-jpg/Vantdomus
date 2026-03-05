export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, Arial", margin: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 260, padding: 16, borderRight: "1px solid #eee" }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>VantDomus Panel</div>
            <nav style={{ display: "grid", gap: 8 }}>
              <a href="/" style={{ textDecoration: "none" }}>Home</a>
            </nav>
            <div style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
              Configura <code>.env.local</code>
            </div>
          </aside>
          <main style={{ flex: 1, padding: 20 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
