"use client";

import { useState } from "react";
import { createSchoolStudyPlan } from "../../../lib/api";

export default function SchoolPlannerForm({
  hid,
  persons,
}: {
  hid: string;
  persons: any[];
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const personLabel = (p: any) =>
    String(p.display_name || "")
      .replace(/^Supervisor\s+/i, "Responsable de ")
      .replace(/^Técnico de\s+/i, "Integrante de ")
      .replace(/^Tecnico de\s+/i, "Integrante de ");

  return (
    <section
      className="card"
      style={{
        borderColor: "var(--primary)",
      }}
    >
      <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="cardTitle" style={{ color: "var(--primary)", fontWeight: 900 }}>
            Planificador escolar IA
          </div>
          <div className="big" style={{ fontSize: 24, marginTop: 4 }}>
            Calendario de pruebas, ramos y trabajos
          </div>
          <div className="small" style={{ marginTop: 8, maxWidth: 780, lineHeight: 1.55 }}>
            Sube calendarios, agendas, circulares o pega el detalle del semestre. VantDomus crea hitos de estudio,
            repasos, recordatorios y una fecha final de evaluacion para el integrante asignado.
          </div>
        </div>
        <div className="pill good" style={{ whiteSpace: "nowrap" }}>
          IA + recordatorios
        </div>
      </div>

      <form
        style={{ marginTop: 18, display: "grid", gap: 12 }}
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setMessage("");
          try {
            const form = new FormData(event.currentTarget);
            const resp = await createSchoolStudyPlan(hid, form);
            setMessage(`${resp.tasks_created || 0} recordatorios creados. Refrescando agenda...`);
            window.setTimeout(() => window.location.reload(), 700);
          } catch (error: any) {
            setMessage(error?.message || "No se pudo generar el plan escolar.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="formRow">
          <input className="input" name="student" placeholder="Alumno / integrante" style={{ width: 170 }} />
          <input className="input" name="subject" placeholder="Ramo: matematicas, lenguaje..." style={{ width: 230 }} />
          <input className="input" name="evaluation_title" placeholder="Prueba, trabajo o unidad" style={{ minWidth: 240, flex: 1 }} />
          <input type="date" className="input" name="due_date" style={{ width: 150 }} />
          <select className="input" name="assigned_person_id" defaultValue="" style={{ minWidth: 210 }}>
            <option value="">Asignar integrante</option>
            {persons.map((p: any) => (
              <option key={p.id} value={p.id}>
                {personLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="formRow">
          <input
            className="input"
            type="file"
            name="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.pptx,.xlsx,.xls"
            style={{ minWidth: 260 }}
          />
          <textarea
            className="input"
            name="notes"
            placeholder="Tambien puedes pegar aqui la agenda: fechas, ramos, pruebas, trabajos, lecturas o instrucciones del colegio..."
            rows={3}
            style={{ flex: 1, minWidth: 360, resize: "vertical" }}
          />
          <button className="btn btnPrimary" type="submit" disabled={loading} style={{ minWidth: 190 }}>
            {loading ? "Analizando..." : "Generar plan de estudio"}
          </button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {[
            ["1", "Detecta evaluaciones y entregas"],
            ["2", "Crea preparacion por etapas"],
            ["3", "Asigna responsable familiar"],
            ["4", "Deja recordatorios trazables"],
          ].map(([num, text]) => (
            <div key={num} className="card" style={{ padding: 12, background: "rgba(255,255,255,0.025)" }}>
              <div style={{ color: "var(--primary)", fontWeight: 900 }}>{num}</div>
              <div className="small" style={{ marginTop: 4 }}>{text}</div>
            </div>
          ))}
        </div>

        {message && (
          <div className="small" style={{ color: message.includes("No se pudo") ? "var(--bad)" : "var(--primary)", fontWeight: 800 }}>
            {message}
          </div>
        )}
      </form>
    </section>
  );
}
