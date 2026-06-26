/**
 * U2-UX #19 (parcial) — Recordatorios: bandeja única de "qué no olvidar hoy".
 * Agrega medicamentos del día, actividades pendientes, avisos fijados/importantes
 * y compras urgentes, en una sola vista. Sin scheduler real (eso es fase D); esto
 * es la superficie sobre los datos existentes.
 */

import {
  getDashboard, familyBoardList, shoppingList, dailyActivitiesList, listUnitFunctions,
} from "../../../lib/api";
import DomiOrb from "../../components/DomiOrb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function today() { return new Date().toISOString().slice(0, 10); }
function fmtTime(iso?: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default async function RecordatoriosPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const [dash, board, shop, acts, meds] = await Promise.all([
    getDashboard(hid).catch(() => null),
    familyBoardList(hid).catch(() => ({ items: [] })),
    shoppingList(hid).catch(() => ({ items: [] })),
    dailyActivitiesList(hid, today()).catch(() => ({ items: [] })),
    listUnitFunctions({ household_id: hid, category: "medication", limit: 50 }).catch(() => ({ items: [] })),
  ]);
  const familyName = dash?.household?.meta?.family_name || "Tu hogar";
  const personName = new Map<string, string>((dash?.persons || []).map((p: any) => [p.id, p.display_name]));

  // Construir lista unificada de recordatorios.
  type R = { icon: string; text: string; sub?: string; tag: string; tagCls: string; href: string };
  const items: R[] = [];

  // Medicamentos de hoy (cada toma)
  for (const m of (meds?.items || []) as any[]) {
    for (const t of (m?.schedule?.times || []) as string[]) {
      items.push({
        icon: "💊", text: `${m.title} — ${t}`,
        sub: personName.get(m.person_id) || "Integrante",
        tag: m.ai_needs_confirmation ? "Confirmar" : "Salud", tagCls: m.ai_needs_confirmation ? "bad" : "warn",
        href: `/health/${hid}`,
      });
    }
  }
  // Actividades pendientes de hoy
  for (const a of (acts?.items || []) as any[]) {
    if (a.status === "planned") {
      items.push({
        icon: "🌞", text: a.title, sub: `${personName.get(a.person_id) || ""}${a.starts_at ? " · " + fmtTime(a.starts_at) : ""}`,
        tag: "Hoy", tagCls: "warn", href: `/actividades/${hid}`,
      });
    }
  }
  // Avisos fijados / importantes activos
  for (const p of (board?.items || []) as any[]) {
    if (!p.resolved_at && (p.pinned || p.priority === "high" || p.priority === "urgent")) {
      items.push({ icon: "📣", text: p.title, sub: p.body || "", tag: "Aviso", tagCls: "bad", href: `/avisos/${hid}` });
    }
  }
  // Compras urgentes / importantes pendientes
  for (const s of (shop?.items || []) as any[]) {
    if (s.status === "needed" && (s.priority === "high" || s.priority === "urgent")) {
      items.push({ icon: "🛒", text: s.item_name, sub: "Falta comprar", tag: "Compra", tagCls: "warn", href: `/compras/${hid}` });
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DomiOrb state={items.length > 0 ? "atento" : "cariñoso"} size={48} showChips={false} />
          <div>
            <div className="small">{familyName}</div>
            <div className="big" style={{ fontSize: 28 }}>Recordatorios</div>
          </div>
        </div>
        <a className="btn" href={`/hogar/${hid}`}>← Panel del hogar</a>
      </div>

      <div className="small" style={{ color: "var(--muted)", marginBottom: 14 }}>
        Lo que no hay que olvidar hoy, junto en un solo lugar. {items.length} recordatorio(s).
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div className="big" style={{ fontSize: 22 }}>¡Todo al día! 🎉</div>
          <div className="small" style={{ marginTop: 6 }}>No hay nada urgente por recordar ahora.</div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {items.map((r, i) => (
            <a key={i} href={r.href} className="card" style={{ padding: 12, textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24, flex: "0 0 auto" }}>{r.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{r.text}</span>
                {r.sub ? <span className="small" style={{ display: "block", color: "var(--muted)" }}>{r.sub}</span> : null}
              </span>
              <span className={`pill ${r.tagCls}`}>{r.tag}</span>
            </a>
          ))}
        </div>
      )}

      <div className="footerNote">
        Los recordatorios automáticos (push/SMS/email) llegarán en una próxima fase. Por ahora, esta
        bandeja reúne lo de hoy a partir de tus datos.
      </div>
    </div>
  );
}
