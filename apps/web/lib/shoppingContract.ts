/**
 * CP1c-FUNC-MIN-3.3a — Espejo tipado del CONTRATO CANÓNICO de Compras.
 *
 * La definición de verdad vive en el backend (`apps/api/app/shopping_contract.py`)
 * y se expone en `GET /household_shopping/{hid}/summary`. Este módulo es su
 * MIRROR para la capa de presentación (mapear items a la UI); NO inventa
 * criterios propios y su paridad con el backend está cubierta por test
 * (test_assistant_gateway: paridad summary == derivación de items).
 *
 * Estados canónicos: needed | in_cart | purchased | cancelled
 * Criterios: por comprar = needed+in_cart · comprado = purchased · excluido = cancelled.
 */

export const SHOPPING_STATUS = {
  NEEDED: "needed",
  IN_CART: "in_cart",
  PURCHASED: "purchased",
  CANCELLED: "cancelled",
} as const;

export type ShoppingStatus = (typeof SHOPPING_STATUS)[keyof typeof SHOPPING_STATUS];

export const isPorComprar = (status: string): boolean =>
  status === SHOPPING_STATUS.NEEDED || status === SHOPPING_STATUS.IN_CART;

export const isPurchased = (status: string): boolean => status === SHOPPING_STATUS.PURCHASED;

export const isExcluded = (status: string): boolean => status === SHOPPING_STATUS.CANCELLED;

/** Forma del resumen canónico que devuelve /household_shopping/{hid}/summary. */
export interface ShoppingSummary {
  por_comprar: number;
  needed: number;
  in_cart: number;
  purchased: number;
  cancelled: number;
  criteria: { por_comprar: string; comprado: string; excluido: string };
}
