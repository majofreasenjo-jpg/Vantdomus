import { getDashboard, getPersonHealthTimeline, listUnitFunctions } from "../../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";
import DomiOrb from "../../components/DomiOrb";

// Franjas del día (metáfora pastillero Medisafe).
const FRANJAS = [
  { key: "manana", label: "Mañana", icon: "🌅", from: 5, to: 11 },
  { key: "mediodia", label: "Mediodía", icon: "🌞", from: 12, to: 14 },
  { key: "tarde", label: "Tarde", icon: "🌇", from: 15, to: 18 },
  { key: "noche", label: "Noche", icon: "🌙", from: 19, to: 28 }, // 19:00–04:59
];
function franjaFor(t: string): string {
  const h = parseInt((t || "").slice(0, 2), 10);
  if (Number.isNaN(h)) return "noche";
  const hh = h < 5 ? h + 24 : h; // 00-04 → noche
  for (const f of FRANJAS) if (hh >= f.from && hh <= f.to) return f.key;
  return "noche";
}

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

  // Medicamentos por franja del día (metáfora pastillero) — solo family.
  const personName = new Map<string, string>(dash.persons.map((p: any) => [p.id, p.display_name]));
  const meds = isFamily
    ? ((await listUnitFunctions({ household_id: hid, category: "medication", limit: 50 }).catch(() => ({ items: [] }))).items || [])
    : [];
  const doses: Record<string, { person: string; med: string; time: string; confirm: boolean }[]> =
    { manana: [], mediodia: [], tarde: [], noche: [] };
  for (const m of meds as any[]) {
    const times: string[] = (m?.schedule?.times || []) as string[];
    for (const t of times) {
      doses[franjaFor(t)].push({
        person: personName.get(m.person_id) || "Integrante",
        med: m.title, time: t, confirm: Boolean(m.ai_needs_confirmation),
      });
    }
  }
  const totalDoses = Object.values(doses).reduce((a, b) => a + b.length, 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {isFamily ? <DomiOrb state="sereno" size={48} showChips={false} /> : null}
        <div>
          <div className="cardTitle">{isFamily ? "Bienestar familiar y cuidado senior" : "HSE - Health, Safety & Environment"}</div>
          <div className="big" style={{ fontSize: 26 }}>{tax.health}</div>
          <div className="small">{isFamily ? "Medicacion, controles, descanso, alertas preventivas y red de apoyo por integrante." : "Desglose parametrico de seguridad industrial e indicadores biometricos por individuo."}</div>
        </div>
      </div>

      {isFamily ? (
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="cardTitle">💊 Medicamentos de hoy por franja</div>
            <span className="small" style={{ color: "var(--muted)" }}>{totalDoses} toma(s) programada(s)</span>
          </div>
          {totalDoses === 0 ? (
            <div className="small" style={{ color: "var(--muted)" }}>
              No hay medicamentos cargados. Podés agregarlos escaneando una receta en la Bandeja Inteligente (Documentos).
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {FRANJAS.map((f) => (
                <div key={f.key} className="card" style={{ padding: 12, background: "var(--bg)" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{f.icon} {f.label}</div>
                  {doses[f.key].length === 0 ? (
                    <div className="small" style={{ color: "var(--muted)" }}>—</div>
                  ) : (
                    doses[f.key].sort((a, b) => a.time.localeCompare(b.time)).map((d, i) => (
                      <div key={i} className="small" style={{ marginBottom: 6 }}>
                        <span style={{ color: "var(--muted)" }}>{d.time}</span> · <strong>{d.med}</strong>
                        <div style={{ color: "var(--muted)" }}>{d.person}</div>
                        {d.confirm ? <span style={{ color: "#9a6a00" }}>🛡️ pendiente de confirmar</span> : null}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="small" style={{ marginTop: 10, color: "var(--muted)", fontStyle: "italic" }}>
            Domi solo recuerda; las dosis las confirma una persona. Los recordatorios automáticos (push/SMS) llegan en una próxima fase.
          </div>
        </div>
      ) : null}

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
