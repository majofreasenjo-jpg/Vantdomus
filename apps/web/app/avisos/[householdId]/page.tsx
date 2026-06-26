/**
 * U1-LOCAL — Avisos del Hogar (página dedicada).
 *
 * Listado completo con creación inline + acciones (resolver/archivar) vía
 * server actions. Sin client component.
 */

import { revalidatePath } from "next/cache";
import { familyBoardList, familyBoardCreate, familyBoardResolve, familyBoardArchive, getDashboard, shoppingCreate, dailyActivityCreate } from "../../../lib/api";
import DomiOrb from "../../components/DomiOrb";
import PostComments from "../../components/PostComments";
import { markCelebrate } from "../../../lib/celebrate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const POST_TYPES = [
  { v: "notice", l: "Aviso" },
  { v: "alert", l: "Alerta" },
  { v: "reminder", l: "Recordatorio" },
  { v: "message", l: "Mensaje" },
  { v: "logistics", l: "Logística" },
  { v: "shopping", l: "Compras" },
  { v: "health", l: "Salud" },
  { v: "school", l: "Colegio" },
  { v: "finance", l: "Finanzas" },
  { v: "document", l: "Documento" },
];
const PRIORITY_PILL: Record<string, { cls: string; label: string }> = {
  urgent: { cls: "bad", label: "Urgente" },
  high: { cls: "bad", label: "Importante" },
  normal: { cls: "warn", label: "Normal" },
  low: { cls: "", label: "Baja" },
};
const POST_TYPE_LABEL: Record<string, string> = Object.fromEntries(POST_TYPES.map(t => [t.v, t.l]));

function fmt(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default async function AvisosPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const [dash, board] = await Promise.all([
    getDashboard(hid).catch(() => null),
    familyBoardList(hid).catch(() => ({ items: [] })),
  ]);
  const items = (board?.items || []) as any[];
  const pinned = items.filter((p) => p.pinned && !p.resolved_at);
  const active = items.filter((p) => !p.pinned && !p.resolved_at);
  const resolved = items.filter((p) => p.resolved_at);
  const familyName: string = dash?.household?.meta?.family_name || "Tu hogar";

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DomiOrb state="sereno" size={48} showChips={false} />
          <div>
            <div className="small">{familyName}</div>
            <div className="big" style={{ fontSize: 28 }}>Avisos del hogar</div>
          </div>
        </div>
        <a className="btn" href={`/hogar/${hid}`}>← Panel del hogar</a>
      </div>

      {/* CREAR */}
      <form
        className="card"
        style={{ padding: 16, marginBottom: 18 }}
        action={async (fd: FormData) => {
          "use server";
          const title = String(fd.get("title") || "").trim();
          if (!title) return;
          await familyBoardCreate(hid, {
            title,
            body: String(fd.get("body") || "") || undefined,
            post_type: String(fd.get("post_type") || "notice"),
            priority: String(fd.get("priority") || "normal"),
            pinned: fd.get("pinned") === "on",
          });
          revalidatePath(`/avisos/${hid}`);
          revalidatePath(`/hogar/${hid}`);
        }}
      >
        <div className="cardTitle">Nuevo aviso</div>
        <div className="formRow" style={{ flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <input className="input" name="title" placeholder="¿Qué quieres avisar a la familia?" required style={{ flex: 1, minWidth: 280 }} />
          <select className="input" name="post_type" defaultValue="notice">
            {POST_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <select className="input" name="priority" defaultValue="normal">
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Importante</option>
            <option value="urgent">Urgente</option>
          </select>
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="pinned" /> Fijar
          </label>
          <button className="btn btnPrimary" type="submit">Publicar</button>
        </div>
        <input className="input" name="body" placeholder="Detalle (opcional)" style={{ width: "100%", marginTop: 8 }} />
      </form>

      {/* PINNED */}
      {pinned.length > 0 ? (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="cardTitle">📌 Fijados</div>
          <div className="grid" style={{ gap: 8, marginTop: 6 }}>
            {pinned.map((p) => <PostCard key={p.id} hid={hid} p={p} />)}
          </div>
        </div>
      ) : null}

      {/* ACTIVE */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="cardTitle">Activos</div>
        {active.length === 0 ? (
          <div className="small" style={{ marginTop: 8 }}>Sin avisos activos. Publica uno para que la familia lo vea.</div>
        ) : (
          <div className="grid" style={{ gap: 8, marginTop: 6 }}>
            {active.map((p) => <PostCard key={p.id} hid={hid} p={p} />)}
          </div>
        )}
      </div>

      {/* RESOLVED */}
      {resolved.length > 0 ? (
        <details className="card" style={{ padding: 16 }}>
          <summary className="cardTitle" style={{ cursor: "pointer" }}>Resueltos ({resolved.length})</summary>
          <div className="grid" style={{ gap: 8, marginTop: 10 }}>
            {resolved.slice(0, 20).map((p) => <PostCard key={p.id} hid={hid} p={p} />)}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function PostCard({ hid, p }: { hid: string; p: any }) {
  const pill = PRIORITY_PILL[p.priority] || PRIORITY_PILL.normal;
  return (
    <div className="card" style={{ padding: 12, background: "var(--bg)" }}>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="small" style={{ color: "var(--muted)" }}>
          {POST_TYPE_LABEL[p.post_type] || p.post_type}
          {p.pinned ? " · 📌" : ""}
          {p.resolved_at ? ` · ✅ resuelto ${fmt(p.resolved_at)}` : ""}
        </span>
        <span className={`pill ${pill.cls}`}>{pill.label}</span>
      </div>
      <div style={{ fontWeight: 700, textDecoration: p.resolved_at ? "line-through" : "none" }}>{p.title}</div>
      {p.body ? <div className="small" style={{ marginTop: 4 }}>{p.body}</div> : null}
      {(p.post_type === "health" || p.post_type === "alert") && !p.resolved_at ? (
        <div className="small" style={{ marginTop: 6, color: "#9a6a00" }}>
          🛡️ Confirmación humana requerida antes de activar recordatorios automáticos.
        </div>
      ) : null}
      {!p.resolved_at ? (
        <div className="formRow" style={{ marginTop: 8, flexWrap: "wrap", gap: 6 }}>
          <form action={async () => {
            "use server";
            await familyBoardResolve(hid, p.id);
            await markCelebrate();
            revalidatePath(`/avisos/${hid}`); revalidatePath(`/hogar/${hid}`);
          }}>
            <button className="btn" type="submit">Marcar resuelto</button>
          </form>
          <form action={async () => {
            "use server";
            await familyBoardArchive(hid, p.id);
            revalidatePath(`/avisos/${hid}`); revalidatePath(`/hogar/${hid}`);
          }}>
            <button className="btn" type="submit">Archivar</button>
          </form>
          {/* Canon §15: convertir aviso en compra o actividad. */}
          <form action={async () => {
            "use server";
            await shoppingCreate(hid, {
              item_name: p.title,
              category: p.post_type === "health" ? "pharmacy" : (p.post_type === "school" ? "school" : "other"),
              store_type: p.post_type === "health" ? "pharmacy" : "other",
              priority: p.priority === "urgent" || p.priority === "high" ? "high" : "normal",
              notes: p.body || `Generado desde aviso: ${p.title}`,
            });
            revalidatePath(`/compras/${hid}`); revalidatePath(`/avisos/${hid}`); revalidatePath(`/hogar/${hid}`);
          }}>
            <button className="btn" type="submit" title="Convierte este aviso en un ítem de compras">→ Compra</button>
          </form>
          <form action={async () => {
            "use server";
            // Convertir en actividad de hoy para el primer integrante del hogar.
            const dash = await getDashboard(hid).catch(() => null);
            const personId = dash?.persons?.[0]?.id;
            if (!personId) return;
            await dailyActivityCreate(hid, {
              person_id: personId,
              title: p.title,
              activity_type: p.post_type === "school" ? "school" : (p.post_type === "health" ? "health" : "other"),
              visibility: "family",
              date_iso: new Date().toISOString().slice(0, 10),
              notes: p.body || `Generado desde aviso: ${p.title}`,
            });
            revalidatePath(`/actividades/${hid}`); revalidatePath(`/avisos/${hid}`); revalidatePath(`/hogar/${hid}`);
          }}>
            <button className="btn" type="submit" title="Convierte este aviso en una actividad del día">→ Actividad</button>
          </form>
        </div>
      ) : null}
      <PostComments hid={hid} postId={p.id} />
    </div>
  );
}
