import { getPersonHealthTimeline, setAdherencePlan, healthCheckin, getDashboard } from "../../../../lib/api";
import { revalidatePath } from "next/cache";

// Renderiza un ISO timestamp en formato local familiar.
function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

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

  // Determinar si el household está en modo familia para ajustar copy y
  // ocultar identificadores técnicos (UUID) que no aportan en consumer.
  let isFamily = false;
  try {
    const dash = await getDashboard(householdId);
    isFamily = dash?.household?.meta?.industry_preset === "family";
  } catch {
    // Si falla la consulta, asumimos no-familia (más conservador).
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row">
          <div>
            <div className="cardTitle" style={{ color: "var(--warn)", fontWeight: "bold" }}>
              {isFamily ? "Salud y medicamentos" : "Bienestar y controles personales"}
            </div>
            <div className="big" style={{ fontSize: 26, color: "var(--primary)" }}>{data.person.display_name}</div>
            {/* Solo mostrar identificador técnico cuando NO es modo familia.
                En consumer (familia), un UUID rompe la experiencia. */}
            {!isFamily ? (
              <div className="small">ID responsable / credencial: {data.person.id}</div>
            ) : data.person.relation ? (
              <div className="small">{data.person.relation}</div>
            ) : null}
          </div>
          <a className="btn" href={`/dashboard/${householdId}`}>
            {isFamily ? "← Volver al hogar" : "Volver a la unidad"}
          </a>
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
              // Refrescar para que el control recién asignado aparezca en el
              // historial sin tener que recargar a mano.
              revalidatePath(`/persons/${pid}/health`);
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
              // Refrescar para que el check-in aparezca en el historial.
              revalidatePath(`/persons/${pid}/health`);
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
                <td className="small">{formatTimestamp(it.occurred_at)}</td>
                <td>
                  <span className={`pill ${it.event_type.includes("missed") ? "bad" : "good"}`}>
                    {it.event_type.toUpperCase().replace("TAKEN", "OK").replace("MISSED", "ALERTA")}
                  </span>
                </td>
                <td style={{ fontWeight: it.event_type.includes("missed") ? "bold" : "normal" }}>{it.summary}</td>
              </tr>
            ))}
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={3} className="small" style={{ textAlign: "center", padding: 20 }}>
                  {isFamily
                    ? "Aún no hay registros. Cuando marquen una pastilla o un control aparecerá acá."
                    : "No hay registros recientes en el historial."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
