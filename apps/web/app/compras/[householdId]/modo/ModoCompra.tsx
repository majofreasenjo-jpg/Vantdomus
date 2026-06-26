"use client";

/**
 * ModoCompra — vista full-screen para usar en el supermercado (patrón Cozi
 * Shopping Mode). Filas grandes, agrupadas por tienda; tocar marca como comprado
 * y el ítem baja al final. Pensado para una mano, pantalla siempre encendida.
 */

import { useEffect, useState } from "react";
import { shoppingList, shoppingMarkPurchased } from "../../../../lib/api";
import { itemEmoji } from "../../../../lib/itemEmoji";

const STORE_LABEL: Record<string, string> = {
  supermarket: "Supermercado", pharmacy: "Farmacia", convenience: "Conveniencia",
  hardware: "Ferretería", online: "Online", other: "Otro",
};

type Item = { id: string; item_name: string; quantity?: number; unit?: string; store_type: string; status: string };

export default function ModoCompra({ hid }: { hid: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await shoppingList(hid);
      const all = (r?.items || []) as Item[];
      setItems(all.filter((i) => i.status === "needed" || i.status === "in_cart" || i.status === "purchased"));
    } catch { setItems([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [hid]);

  async function mark(id: string) {
    setBusy(id);
    try { await shoppingMarkPurchased(hid, id); await load(); } catch {} finally { setBusy(null); }
  }

  const pending = items.filter((i) => i.status !== "purchased");
  const done = items.filter((i) => i.status === "purchased");
  // agrupar pendientes por tienda
  const groups = new Map<string, Item[]>();
  for (const it of pending) {
    if (!groups.has(it.store_type)) groups.set(it.store_type, []);
    groups.get(it.store_type)!.push(it);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "16px 14px 60px", maxWidth: 640, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="big" style={{ fontSize: 24 }}>🛒 Modo compra</div>
        <a className="btn" href={`/compras/${hid}`}>Salir</a>
      </div>
      <div className="small" style={{ color: "var(--muted)", marginBottom: 14 }}>
        Tocá cada producto al ponerlo en el carro. {pending.length} por comprar · {done.length} listos.
      </div>

      {loading ? <div className="small">Cargando…</div> : null}

      {[...groups.entries()].map(([store, list]) => (
        <div key={store} style={{ marginBottom: 18 }}>
          <div className="small" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: "var(--muted)" }}>
            {STORE_LABEL[store] || store}
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {list.map((it) => (
              <button
                key={it.id}
                onClick={() => mark(it.id)}
                disabled={busy === it.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
                  padding: "16px 16px", borderRadius: 16, border: "1px solid var(--line)",
                  background: "var(--card,#fff)", cursor: "pointer", fontSize: 18,
                }}
              >
                <span style={{ fontSize: 30, flex: "0 0 auto" }}>{itemEmoji(it.item_name)}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>{it.item_name}</span>
                  {it.quantity ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {it.quantity}{it.unit ? " " + it.unit : ""}</span> : null}
                </span>
                <span style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid var(--line)", flex: "0 0 auto" }} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {!loading && pending.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div className="big" style={{ fontSize: 22 }}>¡Compra completa! 🎉</div>
          <div className="small" style={{ marginTop: 6 }}>Marcaste todo. Buen trabajo.</div>
          <a className="btn btnPrimary" style={{ marginTop: 14 }} href={`/compras/${hid}`}>Volver a Compras</a>
        </div>
      ) : null}

      {done.length > 0 ? (
        <details style={{ marginTop: 10 }}>
          <summary className="small" style={{ cursor: "pointer", color: "var(--muted)" }}>Comprados ({done.length})</summary>
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {done.map((it) => (
              <div key={it.id} className="small" style={{ padding: "8px 12px", borderRadius: 12, background: "var(--bg)", textDecoration: "line-through", color: "var(--muted)" }}>
                {itemEmoji(it.item_name)} {it.item_name}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
