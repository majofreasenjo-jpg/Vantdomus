/**
 * U1-LOCAL — Panel del Hogar.
 *
 * Home principal de VantDomus Hogar (modo familia). Server Component que
 * compone en una sola pantalla: saludo + Domi narrador (frases por reglas,
 * sin IA), avisos del hogar, actividades del día, compras pendientes/carro
 * tentativo, accesos rápidos a Guía/Biblioteca/Documentos/Salud/Finanzas.
 *
 * Convive con /dashboard/[id] (operativo/KPIs). No lo reemplaza.
 */

import { cookies } from "next/headers";
import {
  getDashboard,
  familyBoardList,
  shoppingList,
  shoppingCart,
  dailyActivitiesList,
  listUnitFunctions,
} from "../../../lib/api";
import AssistantOrb from "../../components/AssistantOrb";
import MemberChip from "../../components/MemberChip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Person = { id: string; display_name: string; relation?: string };

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function priorityPill(p: string): { cls: string; label: string } {
  if (p === "urgent" || p === "high") return { cls: "bad", label: "Importante" };
  if (p === "low") return { cls: "", label: "Baja" };
  return { cls: "warn", label: "Normal" };
}

const POST_TYPE_LABEL: Record<string, string> = {
  notice: "Aviso", alert: "Alerta", reminder: "Recordatorio",
  message: "Mensaje", emergency_note: "Emergencia",
  logistics: "Logística", shopping: "Compras", health: "Salud",
  school: "Colegio", finance: "Finanzas", document: "Documento",
};

const ACT_TYPE_EMOJI: Record<string, string> = {
  school: "📚", work: "💼", health: "💊", errand: "🛒",
  sport: "⚽", social: "👥", home: "🏠", travel: "✈️", other: "•",
};

function pickGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function buildDomiSummary(opts: {
  greeting: string; userName?: string;
  alertsCount: number; pinnedTitle?: string;
  pendingActivities: number; pendingMeds: number;
  shoppingPending: number; shoppingInCart: number;
  topAssignedShoppingPersonName?: string; topAssignedShoppingItem?: string;
  schoolNoticeTitle?: string;
}): { headline: string; lines: string[] } {
  const { greeting, userName, alertsCount, pinnedTitle,
    pendingActivities, pendingMeds, shoppingPending, shoppingInCart,
    topAssignedShoppingPersonName, topAssignedShoppingItem, schoolNoticeTitle } = opts;
  const things = alertsCount + Math.min(pendingActivities, 6) + (pendingMeds > 0 ? 1 : 0) + (shoppingPending > 0 ? 1 : 0);
  const headline = userName
    ? `${greeting}, ${userName}. Hoy hay ${things} cosas importantes en casa.`
    : `${greeting}. Hoy hay ${things} cosas importantes en casa.`;
  const lines: string[] = [];
  if (pinnedTitle) lines.push(`📌 ${pinnedTitle}`);
  if (pendingMeds > 0) lines.push(`Elena tiene ${pendingMeds === 1 ? "un medicamento pendiente" : `${pendingMeds} medicamentos pendientes`} esta noche.`);
  if (schoolNoticeTitle) lines.push(`Aviso del colegio: ${schoolNoticeTitle}`);
  if (shoppingPending > 0) lines.push(`Faltan ${shoppingPending} productos por comprar (${shoppingInCart} ya en carro tentativo).`);
  if (topAssignedShoppingPersonName && topAssignedShoppingItem) {
    lines.push(`${topAssignedShoppingPersonName} está encargado de: ${topAssignedShoppingItem}.`);
  }
  if (lines.length === 0) lines.push("Todo tranquilo. Buen momento para registrar evidencia o planificar la semana.");
  return { headline, lines };
}

export default async function PanelDelHogar({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const store = await cookies();
  const userName = store.get("vd_user_first_name")?.value;

  // Cargar datos en paralelo. Cualquier fallo individual no rompe el panel.
  const [dash, board, shopAll, cart, activities, ufs] = await Promise.all([
    getDashboard(hid).catch(() => null),
    familyBoardList(hid).catch(() => ({ items: [] })),
    shoppingList(hid).catch(() => ({ items: [] })),
    shoppingCart(hid).catch(() => ({ groups: [], total_estimated: 0, currency: "CLP", disclaimer: "" })),
    dailyActivitiesList(hid, todayIso()).catch(() => ({ items: [] })),
    listUnitFunctions({ household_id: hid, category: "medication", limit: 50 }).catch(() => ({ items: [] })),
  ]);

  if (!dash) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 32 }}>
          <div className="cardTitle">No pudimos cargar este hogar</div>
          <a className="btn" href="/dashboard">← Volver</a>
        </div>
      </div>
    );
  }

  const familyName: string = dash?.household?.meta?.family_name || "Tu hogar";
  const persons: Person[] = dash?.persons || [];
  const personById = new Map(persons.map((p) => [p.id, p]));

  const boardItems = (board?.items || []) as any[];
  const alerts = boardItems.filter((p) => p.priority === "high" || p.priority === "urgent" || p.post_type === "alert");
  const pinned = boardItems.filter((p) => p.pinned);
  const schoolNotice = boardItems.find((p) => p.post_type === "school");

  const shopping = (shopAll?.items || []) as any[];
  const shoppingPending = shopping.filter((s) => s.status === "needed");
  const shoppingInCart = shopping.filter((s) => s.status === "in_cart");

  const acts = (activities?.items || []) as any[];
  const actsByPerson = new Map<string, any[]>();
  for (const a of acts) {
    if (!actsByPerson.has(a.person_id)) actsByPerson.set(a.person_id, []);
    actsByPerson.get(a.person_id)!.push(a);
  }

  const meds = (ufs?.items || []) as any[];
  // "Pendientes esta noche" = medication con horario 18:00-23:59 que no esté done.
  const tonightMeds = meds.filter((m) => {
    const times: string[] = (m?.schedule?.times || []) as string[];
    return times.some((t) => /^(1[89]|2[0-3]):/.test(t));
  });

  // Top asignado (algo concreto que decir en el resumen de Domi).
  const topAssigned = shoppingPending.find((s) => s.assigned_to_person_id);
  const topAssignedPerson = topAssigned ? personById.get(topAssigned.assigned_to_person_id) : undefined;

  const domi = buildDomiSummary({
    greeting: pickGreeting(),
    userName,
    alertsCount: alerts.length,
    pinnedTitle: pinned[0]?.title,
    pendingActivities: acts.filter((a) => a.status === "planned").length,
    pendingMeds: tonightMeds.length,
    shoppingPending: shoppingPending.length,
    shoppingInCart: shoppingInCart.length,
    topAssignedShoppingPersonName: topAssignedPerson?.display_name,
    topAssignedShoppingItem: topAssigned?.item_name,
    schoolNoticeTitle: schoolNotice?.title,
  });

  return (
    <div className="container">
      {/* HEADER + DOMI */}
      <div className="card" style={{ marginBottom: 18, padding: 22 }}>
        <div className="row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div title="Domi es la cara visible de tu Guía Familiar. La IA real ordena y propone, pero tú confirmás lo importante.">
            <AssistantOrb state={alerts.length > 0 ? "alert" : "idle"} showLabel={false} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="small" style={{ color: "var(--muted)" }}>Hoy en tu hogar</div>
            <div className="big" style={{ fontSize: 28, lineHeight: 1.2, marginTop: 2 }}>{familyName}</div>
            <div style={{ fontSize: 16, marginTop: 10, fontWeight: 500 }}>{domi.headline}</div>
            <ul style={{ margin: "10px 0 0 0", paddingLeft: 20, color: "var(--muted)", lineHeight: 1.7 }}>
              {domi.lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
            <div className="small" style={{ marginTop: 8, color: "var(--muted)", fontStyle: "italic" }}>
              Domi propone y resume. Las decisiones importantes (salud, medicamentos, finanzas) las confirmás vos.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <a className="btn" href={`/guia`}>Guía Familiar</a>
            <a className="btn" href={`/biblioteca`}>Biblioteca</a>
            <a className="btn" href={`/documents/${hid}`}>Documentos</a>
          </div>
        </div>
      </div>

      {/* GRID: avisos + actividades del día */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* AVISOS DEL HOGAR */}
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="cardTitle">📣 Avisos del hogar</div>
            <a className="btn" href={`/avisos/${hid}`} style={{ fontSize: 12 }}>Ver todos</a>
          </div>
          {boardItems.length === 0 ? (
            <div className="small" style={{ padding: 12 }}>Sin avisos por ahora. Cuando publiques uno, aparece acá.</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {boardItems.slice(0, 5).map((p) => {
                const pill = priorityPill(p.priority);
                const needsHuman = p.post_type === "health" || p.post_type === "alert";
                return (
                  <div key={p.id} className="card" style={{ padding: 12, background: "var(--bg)" }}>
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className="small" style={{ color: "var(--muted)" }}>
                        {POST_TYPE_LABEL[p.post_type] || p.post_type}
                        {p.pinned ? " · 📌 Fijado" : ""}
                      </span>
                      <span className={`pill ${pill.cls}`}>{pill.label}</span>
                    </div>
                    <div style={{ fontWeight: 700 }}>{p.title}</div>
                    {p.body ? <div className="small" style={{ marginTop: 4 }}>{p.body}</div> : null}
                    {needsHuman ? (
                      <div className="small" style={{ marginTop: 6, color: "#9a6a00" }}>
                        🛡️ Confirmación humana requerida
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ACTIVIDADES DEL DÍA */}
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="cardTitle">🌞 Hoy en la familia</div>
          </div>
          {persons.length === 0 ? (
            <div className="small">Sin integrantes registrados.</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {persons.map((p) => {
                const personActs = (actsByPerson.get(p.id) || []).slice(0, 3);
                return (
                  <div key={p.id} className="card" style={{ padding: 12, background: "var(--bg)" }}>
                    <div style={{ marginBottom: 6 }}><MemberChip name={p.display_name} personId={p.id} bold /></div>
                    {personActs.length === 0 ? (
                      <div className="small" style={{ color: "var(--muted)" }}>Sin actividades hoy.</div>
                    ) : (
                      personActs.map((a) => (
                        <div key={a.id} className="small" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                          <span>{ACT_TYPE_EMOJI[a.activity_type] || "•"}</span>
                          <span style={{ minWidth: 44, color: "var(--muted)" }}>{fmtTime(a.starts_at) || "—"}</span>
                          <span style={{ textDecoration: a.status === "done" || a.status === "cancelled" ? "line-through" : "none" }}>
                            {a.title}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* COMPRAS + CARRO */}
      <div className="card" style={{ marginBottom: 14, padding: 18 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="cardTitle">🛒 Compras del hogar</div>
          <a className="btn" href={`/compras/${hid}`} style={{ fontSize: 12 }}>Ver todas</a>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div className="small" style={{ marginBottom: 6 }}>
              Falta en casa ({shoppingPending.length})
            </div>
            {shoppingPending.length === 0 ? (
              <div className="small" style={{ color: "var(--muted)" }}>Sin pendientes. ¡Bien!</div>
            ) : (
              shoppingPending.slice(0, 5).map((s) => {
                const who = s.assigned_to_person_id ? personById.get(s.assigned_to_person_id) : null;
                return (
                  <div key={s.id} className="small" style={{ padding: "4px 0" }}>
                    • {s.item_name} {s.quantity ? `· ${s.quantity}${s.unit ? " " + s.unit : ""}` : ""}
                    {who ? <span style={{ color: "var(--muted)" }}> · para {who.display_name}</span> : null}
                  </div>
                );
              })
            )}
          </div>
          <div>
            <div className="small" style={{ marginBottom: 6 }}>
              Carro tentativo ({shoppingInCart.length})
            </div>
            {shoppingInCart.length === 0 ? (
              <div className="small" style={{ color: "var(--muted)" }}>Nada en carro.</div>
            ) : (
              shoppingInCart.slice(0, 5).map((s) => (
                <div key={s.id} className="small" style={{ padding: "4px 0" }}>
                  • {s.item_name} {s.estimated_price ? <span style={{ color: "var(--muted)" }}>· ~${Math.round(s.estimated_price).toLocaleString("es-CL")} {s.currency || ""}</span> : null}
                </div>
              ))
            )}
            {cart?.total_estimated ? (
              <div className="small" style={{ marginTop: 8, color: "var(--muted)" }}>
                Total estimado: ${Math.round(cart.total_estimated).toLocaleString("es-CL")} {cart.currency || ""}
              </div>
            ) : null}
            <div className="small" style={{ marginTop: 8, color: "var(--muted)", fontStyle: "italic" }}>
              Por ahora, la compra se realiza fuera de VantDomus. Esta lista ayuda a organizar el hogar.
            </div>
          </div>
        </div>
      </div>

      {/* ACCESOS RÁPIDOS — paleta cálida coherente (sin neón saturado). */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <a className="card warmAccess" href={`/actividades/${hid}`} style={{ padding: 16, textDecoration: "none", color: "inherit" }}>
          <div className="cardTitle">🌞 Actividades del día</div>
          <div className="small" style={{ marginTop: 6 }}>{acts.length > 0 ? `${acts.length} eventos hoy` : "Planifica el día"}</div>
        </a>
        <a className="card warmAccess" href={`/health/${hid}`} style={{ padding: 16, textDecoration: "none", color: "inherit" }}>
          <div className="cardTitle">💊 Salud y cuidado</div>
          <div className="small" style={{ marginTop: 6 }}>
            {tonightMeds.length > 0 ? `${tonightMeds.length} medicamento(s) esta noche` : "Sin pendientes urgentes"}
          </div>
        </a>
        <a className="card warmAccess" href={`/documents/${hid}`} style={{ padding: 16, textDecoration: "none", color: "inherit" }}>
          <div className="cardTitle">📄 Documentos</div>
          <div className="small" style={{ marginTop: 6 }}>Bandeja inteligente · recetas, boletas, circulares</div>
        </a>
        <a className="card warmAccess" href={`/finance/${hid}`} style={{ padding: 16, textDecoration: "none", color: "inherit" }}>
          <div className="cardTitle">💰 Presupuesto</div>
          <div className="small" style={{ marginTop: 6 }}>Ingresos, gastos y vencimientos del hogar</div>
        </a>
        <a className="card warmAccess" href={`/biblioteca`} style={{ padding: 16, textDecoration: "none", color: "inherit" }}>
          <div className="cardTitle">📚 Biblioteca</div>
          <div className="small" style={{ marginTop: 6 }}>Memoria, evidencia y evolución por integrante</div>
        </a>
      </div>

      <div className="footerNote">
        Vista del Panel del Hogar. La compra se realiza fuera de VantDomus por ahora. Los recordatorios automáticos
        (push/SMS) llegarán en una próxima fase.
      </div>
    </div>
  );
}
