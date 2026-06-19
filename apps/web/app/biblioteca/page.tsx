/**
 * Sprint VG+2 — Biblioteca (index): lista las personas del household y
 * lleva a la biblioteca personal de cada una.
 */

import { cookies } from "next/headers";
import { getDashboard, getHouseholds } from "../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../lib/taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveActiveHousehold(): Promise<string | null> {
  const store = await cookies();
  const fromCookie = store.get("hid")?.value;
  if (fromCookie) return fromCookie;
  try {
    const list = await getHouseholds();
    if (list?.items?.length) return list.items[0].id;
  } catch {}
  return null;
}

export default async function BibliotecaIndex() {
  const householdId = await resolveActiveHousehold();
  if (!householdId) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 32 }}>
          <div className="cardTitle">No hay hogar activo</div>
          <a className="btn" href="/dashboard">← Volver al panel</a>
        </div>
      </div>
    );
  }

  let dash: any = null;
  try { dash = await getDashboard(householdId); } catch {}
  const preset = dash?.household?.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean((tax as any).family_mode);
  const persons: Array<{ id: string; display_name: string; relation?: string }> =
    dash?.persons || [];

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          {!isFamily ? <div className="small">VantGuide</div> : null}
          <div className="big" style={{ fontSize: 32 }}>
            {isFamily ? "Biblioteca Familiar" : "Biblioteca"}
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            {isFamily
              ? "Todo lo que aprendimos del hogar: cumplimientos, evidencia, mejoras y aprendizajes."
              : "Trazabilidad de cumplimiento, evidencia y aprendizaje por integrante."}
          </div>
        </div>
        <a className="btn" href="/guia">Volver a la Guía</a>
      </div>

      {persons.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div className="cardTitle">Sin integrantes registrados</div>
          <div className="small">Agregá personas al hogar para ver sus bibliotecas.</div>
        </div>
      ) : (
        <div className="grid cols4">
          {persons.map((p) => (
            <a
              key={p.id}
              href={`/biblioteca/${encodeURIComponent(p.id)}`}
              className="card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                {p.display_name}
              </div>
              <div className="small">{p.relation || "Integrante"}</div>
              <div className="small" style={{ marginTop: 10, color: "var(--primary)" }}>
                Ver biblioteca →
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
