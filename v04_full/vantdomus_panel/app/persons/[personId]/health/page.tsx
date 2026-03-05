import { getPersonHealthTimeline, setAdherencePlan, healthCheckin } from "@/lib/api";

export default async function PersonHealth({
  params,
  searchParams,
}: {
  params: { personId: string };
  searchParams: { hid?: string };
}) {
  const pid = params.personId;
  const hid = searchParams.hid || "";

  const data = await getPersonHealthTimeline(pid);
  const householdId = hid || data.person.household_id;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row">
          <div>
            <div className="cardTitle">Health</div>
            <div className="big" style={{ fontSize: 26 }}>{data.person.display_name}</div>
            <div className="small">person_id {data.person.id}</div>
          </div>
          <a className="btn" href={`/dashboard/${householdId}`}>Volver</a>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card">
          <div className="sectionTitle">Adherence plan</div>

          <form
            className="formRow"
            action={async (fd: FormData) => {
              "use server";
              await setAdherencePlan(
                householdId,
                pid,
                String(fd.get("med") || "Losartan"),
                String(fd.get("times") || "08:00,20:00"),
                String(fd.get("mode") || "tap") as any
              );
            }}
          >
            <input className="input" name="med" defaultValue="Losartan" style={{ width: 160 }} />
            <input className="input" name="times" defaultValue="08:00,20:00" style={{ width: 180 }} />
            <select className="input" name="mode" defaultValue="tap">
              <option value="none">none</option>
              <option value="tap">tap</option>
              <option value="voice">voice</option>
            </select>
            <button className="btn btnPrimary" type="submit">Guardar</button>
          </form>

          <div className="footerNote">Define el plan y registra check-ins.</div>
        </div>

        <div className="card">
          <div className="sectionTitle">Medication check-in</div>

          <form
            className="formRow"
            action={async (fd: FormData) => {
              "use server";
              await healthCheckin(
                householdId,
                pid,
                String(fd.get("med") || "Losartan"),
                String(fd.get("status") || "taken") as any
              );
            }}
          >
            <input className="input" name="med" defaultValue="Losartan" style={{ width: 160 }} />
            <select className="input" name="status" defaultValue="taken">
              <option value="taken">taken</option>
              <option value="missed">missed</option>
            </select>
            <button className="btn" type="submit">Enviar</button>
          </form>

          <div className="footerNote">2 missed consecutivos ⇒ alerta automática (high).</div>
        </div>
      </div>

      <div className="card">
        <div className="sectionTitle">Timeline</div>
        <table className="table">
          <thead><tr><th>Occurred</th><th>Type</th><th>Summary</th></tr></thead>
          <tbody>
            {data.items.map((it: any) => (
              <tr key={it.id}>
                <td className="small">{it.occurred_at}</td>
                <td className="small">{it.event_type}</td>
                <td>{it.summary}</td>
              </tr>
            ))}
            {data.items.length === 0 ? (
              <tr><td colSpan={3} className="small">Sin eventos.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
