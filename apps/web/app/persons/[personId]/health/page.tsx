import { getPersonHealthTimeline, setAdherencePlan, healthCheckin } from "../../../../lib/api";

export default async function PersonHealth({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ hid?: string }>;
}) {
  const { personId: pid } = await params;
  const { hid = "" } = await searchParams;

  const data = await getPersonHealthTimeline(pid);
  const householdId = hid || data.person.household_id;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row">
          <div>
            <div className="cardTitle" style={{ color: "var(--warn)", fontWeight: "bold" }}>Bienestar y controles personales</div>
            <div className="big" style={{ fontSize: 26, color: "var(--primary)" }}>{data.person.display_name}</div>
            <div className="small">ID responsable / credencial: {data.person.id}</div>
          </div>
          <a className="btn" href={`/dashboard/${householdId}`}>Volver a la unidad</a>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card">
          <div className="sectionTitle">Plan de cuidado y seguimiento</div>

          <form
            className="formRow"
            action={async (fd: FormData) => {
              "use server";
              await setAdherencePlan(
                householdId,
                pid,
                String(fd.get("med") || "Medicacion / control preventivo"),
                String(fd.get("times") || "Rutina diaria"),
                String(fd.get("mode") || "tap") as any
              );
            }}
          >
            <input className="input" name="med" defaultValue="Control preventivo" placeholder="Ej: medicamento, control medico, descanso..." style={{ width: 160 }} />
            <input className="input" name="times" defaultValue="Rutina diaria" placeholder="Periodo de control" style={{ width: 180 }} />
            <select className="input" name="mode" defaultValue="tap">
              <option value="none">Sin validacion</option>
              <option value="tap">Confirmacion App</option>
              <option value="voice">Reporte por voz</option>
            </select>
            <button className="btn btnPrimary" type="submit">Asignar control</button>
          </form>

          <div className="footerNote">Asigna controles de salud, cuidado, seguridad o rutina para esta persona.</div>
        </div>

        <div className="card">
          <div className="sectionTitle">Check-in personal</div>

          <form
            className="formRow"
            action={async (fd: FormData) => {
              "use server";
              await healthCheckin(
                householdId,
                pid,
                String(fd.get("med") || "Check-in de bienestar"),
                String(fd.get("status") || "taken") as any
              );
            }}
          >
            <input className="input" name="med" defaultValue="Bienestar OK" placeholder="Reporte de estado, salud, descanso..." style={{ width: 160 }} />
            <select className="input" name="status" defaultValue="taken">
              <option value="taken">OK / realizado</option>
              <option value="missed">Pendiente / alerta</option>
            </select>
            <button className="btn" type="submit">Registrar cuidado</button>
          </form>

          <div className="footerNote" style={{ color: "var(--bad)" }}>Dos alertas consecutivas generan una recomendacion de seguimiento inmediato.</div>
        </div>
      </div>

      <div className="card">
        <div className="sectionTitle">Historial de bienestar y controles</div>
        <table className="table">
          <thead><tr><th>Fecha</th><th>Estado</th><th>Detalle</th></tr></thead>
          <tbody>
            {data.items.map((it: any) => (
              <tr key={it.id}>
                <td className="small">{it.occurred_at}</td>
                <td>
                  <span className={`pill ${it.event_type.includes("missed") ? "bad" : "good"}`}>
                    {it.event_type.toUpperCase().replace("TAKEN", "OK").replace("MISSED", "ALERTA")}
                  </span>
                </td>
                <td style={{ fontWeight: it.event_type.includes("missed") ? "bold" : "normal" }}>{it.summary}</td>
              </tr>
            ))}
            {data.items.length === 0 ? (
              <tr><td colSpan={3} className="small" style={{ textAlign: "center", padding: 20 }}>No hay registros recientes en el historial.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
