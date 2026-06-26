import { getDashboard, getPersonHealthTimeline } from "../../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";
import DomiOrb from "../../components/DomiOrb";

export default async function Health({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const dash = await getDashboard(hid).catch(() => null);

  if (!dash) {
    return (
      <div className="card bad" style={{ padding: 30, textAlign: "center" }}>
        Unidad Operativa no encontrada.
      </div>
    );
  }

  const presetKey = dash.household.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[presetKey] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean(tax.family_mode);
  const personLabel = (p: any) => {
    if (!isFamily) return p.display_name;
    return String(p.display_name || "")
      .replace(/^Supervisor\s+/i, "Responsable de ")
      .replace(/^Técnico de\s+/i, "Integrante de ")
      .replace(/^Tecnico de\s+/i, "Integrante de ");
  };
  const relationLabel = (relation: string) => {
    if (!isFamily) return relation;
    if (relation === "Jefatura") return "Responsable familiar";
    if (relation === "Terreno") return "Integrante";
    return relation;
  };

  // Concurrent fetch timeline for all persons
  const timelines = await Promise.all(
    dash.persons.map(async (p: any) => {
      const data = await getPersonHealthTimeline(p.id).catch(() => ({ items: [] }));
      return { person: p, data: Array.isArray(data?.items) ? data.items : [] };
    })
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {isFamily ? <DomiOrb state="cariñoso" size={48} showChips={false} /> : null}
        <div>
          <div className="cardTitle">{isFamily ? "Bienestar familiar y cuidado senior" : "HSE - Health, Safety & Environment"}</div>
          <div className="big" style={{ fontSize: 26 }}>{tax.health}</div>
          <div className="small">{isFamily ? "Medicacion, controles, descanso, alertas preventivas y red de apoyo por integrante." : "Desglose parametrico de seguridad industrial e indicadores biometricos por individuo."}</div>
        </div>
      </div>

      <div className="grid">
        {timelines.map((item: any) => {
          const { person, data } = item;
          // Flatten items
          const allItems = [...data].sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

          return (
            <div key={person.id} className="card" style={{ marginBottom: 14 }}>
              <div className="sectionTitle">{personLabel(person)}</div>
              <div className="small" style={{ marginBottom: 14 }}>Rol: {relationLabel(person.relation)}</div>
              
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>{isFamily ? "Control / cuidado" : "Concepto HSE"}</th>
                    <th>Estado de Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.slice(0, 10).map((i: any) => {
                    const status = i.payload?.checkin?.status || "unknown";
                    const isTaken = status === "taken";
                    const isMissed = status === "missed";
                    
                    return (
                    <tr key={i.id}>
                      <td className="small">{new Date(i.occurred_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td><b>{i.summary}</b> <span className="small">({i.event_type})</span></td>
                      <td>
                        <span className={isTaken ? "pill good" : isMissed ? "pill bad" : "pill warn"}>
                          {isTaken ? "Conforme (OK)" : isMissed ? (isFamily ? "Pendiente / alerta" : "Fallo (Vulneracion)") : status}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                  {allItems.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="small">{isFamily ? "Sin registros recientes de salud, medicacion o bienestar para este integrante." : "Sin registros recientes de HSE / Biometria para este operador."}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          );
        })}
        {dash.persons.length === 0 && (
          <div className="card">
            <div className="small">{isFamily ? "No hay integrantes asignados a este nucleo." : "No hay operadores asignados a esta unidad."}</div>
          </div>
        )}
      </div>
    </div>
  );
}
