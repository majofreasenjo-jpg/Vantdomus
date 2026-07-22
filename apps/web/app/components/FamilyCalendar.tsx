"use client";

/**
 * OPS-2 M11 — Calendario del hogar (vista mensual).
 *
 * Cuadrícula del mes sobre las actividades existentes (daily_activities), con
 * navegación mes a mes, día seleccionado con su detalle y descarga .ics para
 * importar en Google/Apple Calendar (sin OAuth; la sincronización automática es
 * una fase posterior). Respeta la visibilidad: solo ves lo que puedes ver.
 */
import { useEffect, useMemo, useState } from "react";
import { dailyActivitiesRange, calendarIcsUrl } from "../../lib/api";

type Act = {
  id: string; title: string; person_id: string; starts_at?: string | null;
  status: string; activity_type: string;
};

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW = ["L", "M", "X", "J", "V", "S", "D"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FamilyCalendar({ hid }: { hid: string }) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [items, setItems] = useState<Act[]>([]);
  const [selected, setSelected] = useState<string>(ymd(today));

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = (await dailyActivitiesRange(hid, ymd(first), ymd(last))) as { items?: Act[] };
        if (alive) setItems(r?.items || []);
      } catch { /* silencioso */ }
    })();
    return () => { alive = false; };
  }, [hid, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mapa día(YYYY-MM-DD) → actividades.
  const byDay = useMemo(() => {
    const m = new Map<string, Act[]>();
    for (const a of items) {
      if (!a.starts_at || a.status === "cancelled") continue;
      const day = String(a.starts_at).slice(0, 10);
      m.set(day, [...(m.get(day) || []), a]);
    }
    return m;
  }, [items]);

  function nav(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Celdas: lunes como primer día.
  const startOffset = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: last.getDate() }, (_, i) => ymd(new Date(year, month, i + 1))),
  ];
  const dayActs = byDay.get(selected) || [];

  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>🗓 {MONTHS[month]} {year}</strong>
        <span style={{ display: "flex", gap: 6 }}>
          <button className="pill" style={{ cursor: "pointer" }} onClick={() => nav(-1)} aria-label="Mes anterior">←</button>
          <button className="pill" style={{ cursor: "pointer" }} onClick={() => nav(1)} aria-label="Mes siguiente">→</button>
          <a className="pill" href={calendarIcsUrl(hid)} download>⬇ .ics</a>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {DOW.map((d) => (
          <div key={d} className="small" style={{ textAlign: "center", color: "var(--muted)", fontWeight: 700 }}>{d}</div>
        ))}
        {cells.map((day, i) => day === null ? <div key={`e${i}`} /> : (
          <button
            key={day}
            onClick={() => setSelected(day)}
            aria-label={`Día ${day}`}
            style={{
              minHeight: 44, borderRadius: 8, cursor: "pointer", padding: 2,
              border: day === selected ? "2px solid var(--primary, #6a5acd)" : "1px solid var(--border, #ddd)",
              background: day === ymd(today) ? "var(--card-alt, rgba(106,90,205,.08))" : "transparent",
            }}
          >
            <div className="small" style={{ fontWeight: 700 }}>{Number(day.slice(8, 10))}</div>
            {(byDay.get(day) || []).length > 0 ? (
              <div aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>
                {"•".repeat(Math.min(3, (byDay.get(day) || []).length))}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {/* Detalle del día seleccionado */}
      <div style={{ marginTop: 10 }}>
        <div className="small" style={{ fontWeight: 700 }}>
          {new Date(`${selected}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        {dayActs.length === 0 ? (
          <div className="small" style={{ color: "var(--muted)" }}>Sin eventos este día.</div>
        ) : (
          <div className="grid" style={{ gap: 4, marginTop: 4 }}>
            {dayActs.map((a) => (
              <div key={a.id} className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="small" style={{ color: "var(--muted)", minWidth: 44 }}>
                  {a.starts_at ? new Date(a.starts_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
                <span>{a.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="small" style={{ marginTop: 8, color: "var(--muted)" }}>
        ⬇ .ics descarga tu calendario para importarlo en Google/Apple Calendar. La sincronización
        automática con cuentas externas llegará en una próxima fase.
      </div>
    </div>
  );
}
