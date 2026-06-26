/**
 * U1-LOCAL — Compras del Hogar + Carro Tentativo (página dedicada).
 *
 * Lista completa con creación inline + transiciones (en carro / comprado /
 * cancelar). Carro tentativo agrupado por tipo de tienda con total estimado.
 * Sin checkout real — disclaimer visible.
 */

import { revalidatePath } from "next/cache";
import {
  shoppingList, shoppingCreate, shoppingCart,
  shoppingMarkInCart, shoppingMarkPurchased, shoppingCancel,
  getDashboard,
} from "../../../lib/api";
import AssistantOrb from "../../components/AssistantOrb";
import MemberChip from "../../components/MemberChip";
import { markCelebrate } from "../../../lib/celebrate";
import { itemEmoji } from "../../../lib/itemEmoji";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CATEGORIES = [
  { v: "grocery", l: "Supermercado" },
  { v: "pharmacy", l: "Farmacia" },
  { v: "cleaning", l: "Limpieza" },
  { v: "personal_care", l: "Cuidado personal" },
  { v: "pet", l: "Mascota" },
  { v: "baby", l: "Bebé" },
  { v: "hardware", l: "Ferretería" },
  { v: "school", l: "Colegio" },
  { v: "other", l: "Otro" },
];
const STORE_TYPES = [
  { v: "supermarket", l: "Supermercado" },
  { v: "pharmacy", l: "Farmacia" },
  { v: "convenience", l: "Conveniencia" },
  { v: "hardware", l: "Ferretería" },
  { v: "online", l: "Online" },
  { v: "other", l: "Otro" },
];

const STORE_LABEL: Record<string, string> = Object.fromEntries(STORE_TYPES.map((s) => [s.v, s.l]));
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.v, c.l]));

function clp(n?: number | null): string {
  if (n == null || n === 0) return "—";
  try { return `$${Math.round(n).toLocaleString("es-CL")}`; } catch { return String(n); }
}

export default async function ComprasPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const [dash, all, cart] = await Promise.all([
    getDashboard(hid).catch(() => null),
    shoppingList(hid).catch(() => ({ items: [] })),
    shoppingCart(hid).catch(() => ({ groups: [], total_estimated: 0, currency: "CLP", disclaimer: "" })),
  ]);
  const persons: any[] = dash?.persons || [];
  const personById = new Map(persons.map((p) => [p.id, p]));
  const items = (all?.items || []) as any[];
  const needed = items.filter((s) => s.status === "needed");
  const inCart = items.filter((s) => s.status === "in_cart");
  const purchased = items.filter((s) => s.status === "purchased");
  const familyName: string = dash?.household?.meta?.family_name || "Tu hogar";

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AssistantOrb state={needed.length > 0 ? "alert" : "idle"} showLabel={false} />
          <div>
            <div className="small">{familyName}</div>
            <div className="big" style={{ fontSize: 28 }}>Compras del hogar</div>
          </div>
        </div>
        <a className="btn" href={`/hogar/${hid}`}>← Panel del hogar</a>
      </div>

      {/* CREAR ITEM */}
      <form
        className="card"
        style={{ padding: 16, marginBottom: 18 }}
        action={async (fd: FormData) => {
          "use server";
          const name = String(fd.get("item_name") || "").trim();
          if (!name) return;
          const qtyRaw = String(fd.get("quantity") || "").trim();
          const priceRaw = String(fd.get("estimated_price") || "").trim();
          await shoppingCreate(hid, {
            item_name: name,
            quantity: qtyRaw ? parseFloat(qtyRaw) : undefined,
            unit: String(fd.get("unit") || "") || undefined,
            category: String(fd.get("category") || "other"),
            priority: String(fd.get("priority") || "normal"),
            store_type: String(fd.get("store_type") || "other"),
            estimated_price: priceRaw ? parseFloat(priceRaw) : undefined,
            assigned_to_person_id: String(fd.get("assigned_to_person_id") || "") || undefined,
            notes: String(fd.get("notes") || "") || undefined,
          });
          revalidatePath(`/compras/${hid}`);
          revalidatePath(`/hogar/${hid}`);
        }}
      >
        <div className="cardTitle">Agregar a la lista</div>
        <div className="formRow" style={{ flexWrap: "wrap", gap: 10, marginTop: 8, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: 2, minWidth: 200 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Producto</span>
            <input className="input" name="item_name" placeholder="Ej: Leche" required />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, width: 80 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Cant.</span>
            <input className="input" name="quantity" placeholder="1" type="number" step="0.1" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, width: 100 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Unidad</span>
            <input className="input" name="unit" placeholder="kg, lt…" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Categoría</span>
            <select className="input" name="category" defaultValue="grocery">
              {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Dónde comprar</span>
            <select className="input" name="store_type" defaultValue="supermarket">
              {STORE_TYPES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Prioridad</span>
            <select className="input" name="priority" defaultValue="normal">
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Importante</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Encargado</span>
            <select className="input" name="assigned_to_person_id" defaultValue="">
              <option value="">Sin asignar</option>
              {persons.map((p: any) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, width: 150 }}>
            <span className="small" style={{ color: "var(--muted)" }}>Precio est. (CLP)</span>
            <input className="input" name="estimated_price" placeholder="0" type="number" step="100" />
          </label>
          <button className="btn btnPrimary" type="submit">Agregar</button>
        </div>
      </form>

      {/* CARRO TENTATIVO */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <div className="cardTitle">🛒 Carro tentativo</div>
          {cart?.total_estimated ? (
            <span className="small" style={{ color: "var(--muted)" }}>
              Total estimado: {clp(cart.total_estimated)} {cart.currency || ""}
            </span>
          ) : null}
        </div>
        {(!cart?.groups || cart.groups.length === 0) ? (
          <div className="small">Nada en carro. Mové productos desde la lista de "Falta en casa".</div>
        ) : (
          cart.groups.map((g: any) => (
            <div key={g.store_type} style={{ marginTop: 10 }}>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>
                {STORE_LABEL[g.store_type] || g.store_type}
              </div>
              <div className="grid" style={{ gap: 6 }}>
                {g.items.map((it: any) => <ItemRow key={it.id} hid={hid} it={it} personById={personById} />)}
              </div>
            </div>
          ))
        )}
        <div className="small" style={{ marginTop: 12, color: "var(--muted)", fontStyle: "italic" }}>
          {cart?.disclaimer || "Por ahora, la compra se realiza fuera de VantDomus. Esta lista ayuda a organizar el hogar."}
        </div>
      </div>

      {/* PENDIENTES */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="cardTitle">Falta en casa ({needed.length})</div>
        {needed.length === 0 ? (
          <div className="small" style={{ marginTop: 8 }}>Sin pendientes. ¡Buena gestión!</div>
        ) : (
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {needed.map((it) => <ItemRow key={it.id} hid={hid} it={it} personById={personById} />)}
          </div>
        )}
      </div>

      {/* COMPRADOS */}
      {purchased.length > 0 ? (
        <details className="card" style={{ padding: 16 }}>
          <summary className="cardTitle" style={{ cursor: "pointer" }}>Comprados ({purchased.length})</summary>
          <div className="grid" style={{ gap: 6, marginTop: 10 }}>
            {purchased.slice(0, 30).map((it) => <ItemRow key={it.id} hid={hid} it={it} personById={personById} done />)}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ItemRow({ hid, it, personById, done = false }: { hid: string; it: any; personById: Map<string, any>; done?: boolean }) {
  const who = it.assigned_to_person_id ? personById.get(it.assigned_to_person_id) : null;
  const isInCart = it.status === "in_cart";
  const isDone = done || it.status === "purchased" || it.status === "cancelled";
  return (
    <div className="card" style={{ padding: 10, background: "var(--bg)" }}>
      <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 22, flex: "0 0 auto", lineHeight: 1.1 }}>{itemEmoji(it.item_name)}</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600, textDecoration: isDone ? "line-through" : "none" }}>
            {it.item_name}
            {it.quantity ? <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {it.quantity}{it.unit ? " " + it.unit : ""}</span> : null}
          </div>
          <div className="small" style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{CAT_LABEL[it.category] || it.category} · {STORE_LABEL[it.store_type] || it.store_type}{it.estimated_price ? ` · ~${clp(it.estimated_price)}` : ""}</span>
            {who ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                · <MemberChip name={who.display_name} personId={who.id} avatar={who.avatar} size={18} />
              </span>
            ) : null}
          </div>
        </div>
        {!isDone ? (
          <div className="formRow" style={{ gap: 6 }}>
            {!isInCart ? (
              <form action={async () => {
                "use server";
                await shoppingMarkInCart(hid, it.id);
                revalidatePath(`/compras/${hid}`); revalidatePath(`/hogar/${hid}`);
              }}>
                <button className="btn" type="submit">Mover a carro</button>
              </form>
            ) : null}
            <form action={async () => {
              "use server";
              await shoppingMarkPurchased(hid, it.id);
              await markCelebrate();
              revalidatePath(`/compras/${hid}`); revalidatePath(`/hogar/${hid}`);
            }}>
              <button className="btn btnPrimary" type="submit">Comprado</button>
            </form>
            <form action={async () => {
              "use server";
              await shoppingCancel(hid, it.id);
              revalidatePath(`/compras/${hid}`); revalidatePath(`/hogar/${hid}`);
            }}>
              <button className="btn" type="submit" title="Cancelar">✕</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
