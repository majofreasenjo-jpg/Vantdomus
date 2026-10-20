/**
 * R70: one authoritative mapping from shopping API rows to DOMI's home card.
 * The server determines status; no optimistic local addition is evidence.
 */
import type { ShoppingItem } from "../app/components/domi/domiTypes";
import { isPurchased, isExcluded } from "./shoppingContract";

export interface DomiShoppingApiRow {
  id: string;
  item_name: string;
  quantity?: number | null;
  unit?: string | null;
  status: string;
  category?: string | null;
  store_type?: string | null;
  preferred_store?: string | null;
}

const SHOPPING_GROUPS = new Set(["Supermercado", "Frutería", "Panadería", "Farmacia"]);

export function projectDomiShoppingRows(rows: DomiShoppingApiRow[]): ShoppingItem[] {
  if (!Array.isArray(rows)) throw new Error("INVALID_SHOPPING_API_ROWS");
  return rows.filter(row => row && !isExcluded(row.status)).map(row => {
    const preferred = String(row.preferred_store ?? "").trim();
    const category = SHOPPING_GROUPS.has(preferred)
      ? preferred
      : row.category === "pharmacy" || row.store_type === "pharmacy"
        ? "Farmacia"
        : "Supermercado";
    const quantity = typeof row.quantity === "number" && Number.isFinite(row.quantity)
      ? row.quantity : 1;
    return {
      id: String(row.id),
      name: String(row.item_name || "Producto"),
      checked: isPurchased(row.status),
      qty: `${quantity}${row.unit ? ` ${row.unit}` : " ud"}`,
      category,
    };
  });
}

export function projectDomiShoppingResponse(response: unknown): ShoppingItem[] {
  if (!response || typeof response !== "object" ||
      !Array.isArray((response as { items?: unknown }).items)) {
    throw new Error("INVALID_SHOPPING_API_RESPONSE");
  }
  return projectDomiShoppingRows((response as { items: DomiShoppingApiRow[] }).items);
}
