export default function Home() {
  const hid = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row">
          <div>
            <div className="cardTitle">Setup</div>
            <div className="big">VantDomus v0.4</div>
            <div className="footerNote">
              Configura <code>.env.local</code> con <code>NEXT_PUBLIC_ACCESS_TOKEN</code> y <code>NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID</code>.
            </div>
          </div>
          <a className="btn btnPrimary" href={hid ? `/dashboard/${hid}` : "#"}>Abrir Dashboard</a>
        </div>
      </div>
    </div>
  );
}
