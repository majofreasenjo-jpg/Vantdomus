/**
 * U1-FIX F3 — Actividades del Día (página dedicada).
 *
 * Lista por integrante con creación inline y acciones (completar / cancelar)
 * vía server actions. Sin client component pesado. Canon §16.
 */

import { revalidatePath } from "next/cache";
import {
  dailyActivitiesList, dailyActivityCreate, dailyActivityComplete, dailyActivityCancel,
  getDashboard,
} from "../../../lib/api";
import DomiOrb from "../../components/DomiOrb";
import MemberChip from "../../components/MemberChip";
import QuickAddActivity from "../../components/QuickAddActivity";
import ProgressRing from "../../components/ProgressRing";
import { markCelebrate } from "../../../lib/celebrate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTIVITY_TYPES = [
  { v: "school", l: "Colegio / estudio", emoji: "📚" },
  { v: "work", l: "Trabajo", emoji: "💼" },
  { v: "health", l: "Salud", emoji: "💊" },
  { v: "errand", l: "Compra / trámite", emoji: "🛒" },
  { v: "sport", l: "Deporte", emoji: "⚽" },
  { v: "social", l: "Social / familiar", emoji: "👥" },
  { v: "home", l: "Casa", emoji: "🏠" },
  { v: "travel", l: "Viaje", emoji: "✈️" },
  { v: "other", l: "Otro", emoji: "•" },
];
const VISIBILITY = [
  { v: "family", l: "Toda la familia" },
  { v: "caregivers", l: "Solo cuidadores" },
  { v: "private", l: "Privado" },
];

const TYPE_EMOJI: Record<string, string> = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.v, t.emoji]));
const TYPE_LABEL: Record<string, string> = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.v, t.l]));

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function buildIsoFromDateAndTime(dateIso: string, hhmm: string): string | undefined {
  if (!hhmm) return undefined;
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  const d = new Date(`${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  return d.toISOString();
}

export default async function ActividadesPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const dateIso = todayIso();
  const [dash, list] = await Promise.all([
    getDashboard(hid).catch(() => null),
    dailyActivitiesList(hid, dateIso).catch(() => ({ items: [] })),
  ]);
  const persons: any[] = dash?.persons || [];
  const personById = new Map(persons.map((p) => [p.id, p]));
  const items = (list?.items || []) as any[];
  const familyName: string = dash?.household?.meta?.family_name || "Tu hogar";

  // Agrupar por persona.
  const byPerson = new Map<string, any[]>();
  for (const a of items) {
    if (!byPerson.has(a.person_id)) byPerson.set(a.person_id, []);
    byPerson.get(a.person_id)!.push(a);
  }
  for (const [, arr] of byPerson) {
    arr.sort((a, b) => String(a.starts_at || "").localeCompare(String(b.starts_at || "")));
  }

  const pendientesHoy = items.filter((a) => a.status === "planned").length;

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DomiOrb state="sereno" size={48} showChips={false} />
          <div>
            <div className="small">{familyName}</div>
            <div className="big" style={{ fontSize: 28 }}>Actividades del día</div>
          </div>
        </div>
        <a className="btn" href={`/hogar/${hid}`}>← Panel del hogar</a>
      </div>

      {/* QUICK-ADD lenguaje natural */}
      <QuickAddActivity hid={hid} persons={persons.map((p) => ({ id: p.id, display_name: p.display_name }))} />

      {/* CREAR (detallado) */}
      <form
        className="card"
        style={{ padding: 16, marginBottom: 18 }}
        action={async (fd: FormData) => {
          "use server";
          const title = String(fd.get("title") || "").trim();
          const personId = String(fd.get("person_id") || "").trim();
          if (!title || !personId) return;
          const hh = String(fd.get("starts_at_time") || "").trim();
          const hhEnd = String(fd.get("ends_at_time") || "").trim();
          await dailyActivityCreate(hid, {
            person_id: personId,
            title,
            activity_type: String(fd.get("activity_type") || "other"),
            visibility: String(fd.get("visibility") || "family"),
            date_iso: dateIso,
            starts_at: buildIsoFromDateAndTime(dateIso, hh),
            ends_at: buildIsoFromDateAndTime(dateIso, hhEnd),
            location: String(fd.get("location") || "") || undefined,
            notes: String(fd.get("notes") || "") || undefined,
          });
          revalidatePath(`/actividades/${hid}`);
          revalidatePath(`/hogar/${hid}`);
        }}
      >
        <div className="cardTitle">Agregar actividad</div>
        <div className="formRow" style={{ flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <input className="input" name="title" placeholder="¿Qué hay que hacer?" required style={{ flex: 2, minWidth: 220 }} />
          <select className="input" name="person_id" required defaultValue="">
            <option value="">Para...</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <select className="input" name="activity_type" defaultValue="other">
            {ACTIVITY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.emoji} {t.l}</option>)}
          </select>
          <input className="input" name="starts_at_time" type="time" title="Hora inicio" style={{ width: 110 }} />
          <input className="input" name="ends_at_time" type="time" title="Hora fin (opc.)" style={{ width: 110 }} />
          <select className="input" name="visibility" defaultValue="family">
            {VISIBILITY.map((v) => <option key={v.v} value={v.v}>{v.l}</option>)}
          </select>
          <input className="input" name="location" placeholder="Lugar (opc.)" style={{ flex: 1, minWidth: 160 }} />
          <button className="btn btnPrimary" type="submit">Agregar</button>
        </div>
        <input className="input" name="notes" placeholder="Notas (opc.)" style={{ width: "100%", marginTop: 8 }} />
      </form>

      {/* POR INTEGRANTE */}
      {persons.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="small">Sin integrantes registrados todavía.</div>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {persons.map((p) => {
            const acts = byPerson.get(p.id) || [];
            const doneCount = acts.filter((a) => a.status === "done").length;
            const pct = acts.length ? (doneCount / acts.length) * 100 : 0;
            return (
              <div key={p.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <MemberChip name={p.display_name} personId={p.id} avatar={p.avatar} bold />
                  {acts.length > 0 ? (
                    <ProgressRing value={pct} size={38} label={`${doneCount} de ${acts.length} hechas hoy`} />
                  ) : (
                    <span className="small" style={{ color: "var(--muted)" }}>{p.relation || ""}</span>
                  )}
                </div>
                {acts.length === 0 ? (
                  <div className="small" style={{ marginTop: 6, color: "var(--muted)" }}>Sin actividades hoy.</div>
                ) : (
                  <div className="grid" style={{ gap: 6, marginTop: 6 }}>
                    {acts.map((a) => <ActivityRow key={a.id} hid={hid} a={a} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ hid, a }: { hid: string; a: any }) {
  const done = a.status === "done";
  const cancelled = a.status === "cancelled";
  const inactive = done || cancelled;
  return (
    <div className="card" style={{ padding: 10, background: "var(--bg)" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, textDecoration: inactive ? "line-through" : "none" }}>
            <span>{TYPE_EMOJI[a.activity_type] || "•"}</span>
            <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 50 }}>{fmtTime(a.starts_at)}</span>
            <span>{a.title}</span>
          </div>
          <div className="small" style={{ color: "var(--muted)", marginTop: 2 }}>
            {TYPE_LABEL[a.activity_type] || a.activity_type}
            {a.location ? ` · ${a.location}` : ""}
            {cancelled ? " · cancelada" : (done ? " · ✅ hecha" : "")}
          </div>
        </div>
        {!inactive ? (
          <div className="formRow" style={{ gap: 6 }}>
            <form action={async () => {
              "use server";
              await dailyActivityComplete(hid, a.id);
              await markCelebrate();
              revalidatePath(`/actividades/${hid}`); revalidatePath(`/hogar/${hid}`);
            }}>
              <button className="btn btnPrimary" type="submit">Hecho</button>
            </form>
            <form action={async () => {
              "use server";
              await dailyActivityCancel(hid, a.id);
              revalidatePath(`/actividades/${hid}`); revalidatePath(`/hogar/${hid}`);
            }}>
              <button className="btn" type="submit" title="Cancelar">✕</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
