"""
Suite determinista (microcheckpoint correctivo CP1d-FAMILY-PILOT-1a).

Garantías que exige el gate de cierre:
1. Los tests NUNCA heredan los `.env`/`.env.local` del desarrollador:
   `VANTDOMUS_SKIP_LOCAL_ENV=1` hace que `app.config._load_local_env()` no
   cargue archivos locales durante la sesión de pytest.
2. El entorno del proceso se LIMPIA de variables de la aplicación heredadas de
   la shell del desarrollador antes de recolectar tests.
3. `APP_ENV=test` fijo: configuración segura, sin ramas de producción y sin
   depender de la máquina donde corra.
4. `os.environ` se snapshotea y restaura alrededor de CADA test, para que
   ninguna mutación directa contamine al siguiente (monkeypatch ya cubre su
   propio uso; esto cubre escrituras directas).
5. Ningún test automático debe llamar servicios externos; los scripts legacy
   que lo hacían viven ahora en `tests/manual/` (excluido en pytest.ini).
"""

from __future__ import annotations

import os

import pytest

# Prefijos de variables de la aplicación que podrían venir contaminadas desde
# la shell del desarrollador o desde lanzadores locales.
_APP_ENV_PREFIXES = (
    "VANTDOMUS_",
    "ASSISTANT_",
    "SMTP_",
    "CORS_",
    "OPENAI_",
)
_APP_ENV_NAMES = {"APP_ENV", "DB_PATH", "DATABASE_URL", "JWT_SECRET"}


def _scrub_process_env() -> None:
    for key in list(os.environ):
        if key in _APP_ENV_NAMES or key.startswith(_APP_ENV_PREFIXES):
            del os.environ[key]
    # Nunca cargar .env/.env.local del desarrollador dentro de la suite.
    os.environ["VANTDOMUS_SKIP_LOCAL_ENV"] = "1"
    # Entorno canónico de test: no-producción, determinista.
    os.environ["APP_ENV"] = "test"


# Se ejecuta al importar el conftest (antes de recolectar y de que cualquier
# módulo de test importe `app.*`).
_scrub_process_env()


@pytest.fixture(autouse=True)
def _isolated_environ():
    """Snapshot/restauración de os.environ alrededor de cada test."""
    snapshot = dict(os.environ)
    yield
    os.environ.clear()
    os.environ.update(snapshot)
