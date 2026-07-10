"""
CP1c-FUNC-MIN-3.3a — CONTRATO CANÓNICO de estados y conteos de Compras.

ÚNICA definición de verdad. Cualquier lugar que necesite clasificar o contar
compras (Domi, endpoints, dashboards) debe usar ESTE módulo — nunca re-derivar
el criterio con SQL o condiciones propias. El frontend consume el endpoint
`GET /household_shopping/{hid}/summary` (que envuelve `shopping_summary`) y el
espejo tipado `apps/web/lib/shoppingContract.ts` (documentado como mirror de
este contrato, con test de paridad backend).

Estados canónicos:
- needed    = pendiente de conseguir
- in_cart   = en el carro tentativo
- purchased = comprado
- cancelled = excluido (no se muestra ni se cuenta)

Criterios canónicos:
- POR COMPRAR = needed + in_cart
- COMPRADO    = purchased
- EXCLUIDO    = cancelled
"""

STATUS_NEEDED = "needed"
STATUS_IN_CART = "in_cart"
STATUS_PURCHASED = "purchased"
STATUS_CANCELLED = "cancelled"

# Conjuntos canónicos (frozenset = inmutables por diseño)
POR_COMPRAR_STATUSES = frozenset({STATUS_NEEDED, STATUS_IN_CART})
VISIBLE_STATUSES = frozenset({STATUS_NEEDED, STATUS_IN_CART, STATUS_PURCHASED})
ALL_STATUSES = frozenset({STATUS_NEEDED, STATUS_IN_CART, STATUS_PURCHASED, STATUS_CANCELLED})


def is_por_comprar(status: str) -> bool:
    return status in POR_COMPRAR_STATUSES


def is_purchased(status: str) -> bool:
    return status == STATUS_PURCHASED


def is_excluded(status: str) -> bool:
    return status == STATUS_CANCELLED


def shopping_summary(db, household_id: str) -> dict:
    """
    Resumen canónico de Compras de un hogar. TODOS los consumidores (card de la
    home, Domi, módulo Compras, QA) deben mostrar estos números, no otros.
    """
    rows = db.execute(
        "SELECT status, COUNT(*) AS c FROM household_shopping_items "
        "WHERE household_id=? GROUP BY status",
        (household_id,),
    ).fetchall()
    by_status = {r["status"]: r["c"] for r in rows}
    needed = by_status.get(STATUS_NEEDED, 0)
    in_cart = by_status.get(STATUS_IN_CART, 0)
    purchased = by_status.get(STATUS_PURCHASED, 0)
    cancelled = by_status.get(STATUS_CANCELLED, 0)
    return {
        "por_comprar": needed + in_cart,
        "needed": needed,
        "in_cart": in_cart,
        "purchased": purchased,
        "cancelled": cancelled,
        # eco del criterio, para que cualquier consumidor pueda autovalidarse
        "criteria": {
            "por_comprar": "needed + in_cart",
            "comprado": "purchased",
            "excluido": "cancelled",
        },
    }


def shopping_rows_por_comprar(db, household_id: str) -> list:
    """Filas 'por comprar' (needed + in_cart), con el criterio canónico."""
    placeholders = ",".join("?" for _ in POR_COMPRAR_STATUSES)
    return db.execute(
        f"SELECT * FROM household_shopping_items WHERE household_id=? AND status IN ({placeholders}) "
        "ORDER BY created_at DESC",
        (household_id, *sorted(POR_COMPRAR_STATUSES)),
    ).fetchall()
