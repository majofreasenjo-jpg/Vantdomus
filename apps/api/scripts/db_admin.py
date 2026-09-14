"""
OPS-2 M2 — Utilidad SEGURA de administración de la base LIVE.

Solo lectura + snapshot; NO borra nada. Sirve para:
  - `inventory`  → ver qué hay en la base (hogares, dueños, sintéticos vs reales,
                   conteos). Read-only.
  - `snapshot`   → copia consistente de la base a /data/backups (VACUUM INTO),
                   para tener respaldo/restore antes de cualquier cambio.

La separación LIVE/TEST se hace apuntando el servicio a una base LIVE nueva y
limpia (ver docs/OPS-2_M2_LIVE_TEST_ISOLATION.md); esta herramienta NO muta la
base actual, así que la mezclada queda intacta como respaldo.

Uso (desde apps/api):
    python scripts/db_admin.py inventory
    python scripts/db_admin.py snapshot
"""
import os
import sys
from datetime import datetime, timezone

_API_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _API_DIR not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from app.db import connect  # noqa: E402
from app.config import settings  # noqa: E402

# Patrones que marcan datos SINTÉTICOS/de prueba (no reales).
_SYNTH_EMAIL = ("sintetic", "piloto-sintetico", "@sintetico.test", "@piloto-sintetico.test")
_SYNTH_NAME = ("sintetic", "aislado", "test", "demo", "prueba")


def _is_synth(email: str | None, name: str | None) -> bool:
    e = (email or "").lower()
    n = (name or "").lower()
    return any(p in e for p in _SYNTH_EMAIL) or any(p in n for p in _SYNTH_NAME)


def _count(con, table: str) -> int:
    try:
        return con.execute(f"SELECT COUNT(*) c FROM {table}").fetchone()["c"]
    except Exception:
        return -1


def inventory() -> None:
    con = connect()
    print("== BASE LIVE ==")
    print("  DB_PATH:", settings.DB_PATH)
    for t in ("users", "households", "persons", "household_memberships",
              "memory_items", "task_items", "household_shopping_items",
              "document_route_candidates", "family_board_posts"):
        print(f"  {t:28s}: {_count(con, t)}")
    print("\n== HOGARES ==")
    rows = con.execute(
        """
        SELECT h.id, h.name,
               (SELECT u.email FROM household_memberships m
                  JOIN users u ON u.id=m.user_id
                 WHERE m.household_id=h.id AND m.role='owner' LIMIT 1) AS owner_email,
               (SELECT COUNT(*) FROM persons p WHERE p.household_id=h.id) AS n_persons,
               (SELECT COUNT(*) FROM memory_items mi WHERE mi.household_id=h.id) AS n_mem
        FROM households h ORDER BY h.created_at
        """
    ).fetchall()
    synth = real = 0
    for r in rows:
        flag = "SINTÉTICO" if _is_synth(r["owner_email"], r["name"]) else "REAL     "
        if flag.startswith("SINT"):
            synth += 1
        else:
            real += 1
        print(f"  [{flag}] {r['name'][:28]:28s} owner={r['owner_email'] or '—'} "
              f"personas={r['n_persons']} memorias={r['n_mem']} id={r['id'][:8]}")
    print(f"\n  Totales: {real} reales, {synth} sintéticos.")
    if synth and real:
        print("  [!] LIVE mezcla datos reales y sinteticos. Ver runbook M2 para aislar.")


def snapshot() -> None:
    con = connect()
    db_path = settings.DB_PATH
    backup_dir = os.path.join(os.path.dirname(db_path) or ".", "backups")
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = os.path.join(backup_dir, f"vantdomus-{ts}.db")
    if "'" in out:
        print("ERROR: ruta de backup inválida."); sys.exit(2)
    con.execute(f"VACUUM INTO '{out}'")
    size = os.path.getsize(out) if os.path.exists(out) else 0
    print("Snapshot creado:", out)
    print("Tamaño:", size, "bytes")
    print("Para restaurar: detén el servicio y copia este archivo sobre", db_path)


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "inventory":
        inventory()
    elif cmd == "snapshot":
        snapshot()
    else:
        print("Uso: python scripts/db_admin.py [inventory|snapshot]")
        sys.exit(2)


if __name__ == "__main__":
    main()
