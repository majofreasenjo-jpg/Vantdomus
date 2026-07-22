"""
OPS-2 M2 — Guarda de aislamiento LIVE/TEST.

Blinda que la suite automática NUNCA pueda escribir en la base LIVE:
el conftest fija APP_ENV=test y limpia DB_PATH/DATABASE_URL heredados, y cada
test usa su propia base temporal. Si alguien rompe esa garantía, este test falla.
Ejecutar: python -m pytest tests/test_live_test_isolation.py -q
"""
import os


def test_env_is_canonical_test():
    # conftest.py fija APP_ENV=test para toda la sesión (nunca family-live/prod).
    assert os.environ.get("APP_ENV") == "test"


def test_no_inherited_live_db_pointers():
    # No debe haber punteros a una base LIVE heredados de la shell del dev.
    assert not os.environ.get("DATABASE_URL"), "DATABASE_URL no debe estar seteado en tests"
    db_path = os.environ.get("DB_PATH", "")
    # Si algo lo setea, jamás debe apuntar al disco persistente de producción.
    assert "/data/" not in db_path.replace("\\", "/"), "DB_PATH no debe apuntar a /data (LIVE)"


def test_skip_local_env_flag():
    # Garantiza que no se carguen .env/.env.local del desarrollador.
    assert os.environ.get("VANTDOMUS_SKIP_LOCAL_ENV") == "1"
