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
              Usa login real para sesiones de cliente. El token publico queda reservado para demo local.
            </div>
          </div>
          <div className="formRow">
            <a className="btn btnPrimary" href="/login">Entrar</a>
            <a className="btn" href={hid ? `/dashboard/${hid}` : "/dashboard"}>Abrir Dashboard</a>
          </div>
        </div>
      </div>
    </div>
  );
}
