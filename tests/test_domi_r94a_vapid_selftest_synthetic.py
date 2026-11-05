"""
DOMI R94-A — Validación VAPID con claves SINTÉTICAS y sin exposición de secretos.

Verificación 3 previa a la integración de FastShip. Comprueba dos cosas sobre
`apps/api/scripts/`:

  1. `gen_vapid_keys.py` produce un par EC P-256 con la forma exacta que exige
     Web Push: clave pública = punto sin comprimir de 65 bytes (base64url) y
     clave privada = escalar de 32 bytes (base64url). Si la forma fuese otra, el
     navegador rechazaría `applicationServerKey` o la firma fallaría en campo.
  2. `selftest_vapid.py` NUNCA imprime material de clave: solo presencia y
     longitud. Se ejecuta con claves sintéticas generadas aquí mismo y se
     inspecciona su salida completa.
  3. Con una clave sintética válida, `selftest_vapid.py` FIRMA de verdad
     (acreditación positiva). Sin esto, el test pasaría igual con una firma
     rota: solo probaría que nada explota. Requiere `pywebpush`, garantizado en
     CI por `apps/api/requirements.txt`; si falta en una máquina de desarrollo
     se omite con motivo explícito en vez de dar un rojo engañoso.

Las claves son sintéticas, se generan en el proceso de test y no se escriben a
disco ni a ninguna variable persistente. No hay red, no se envía ninguna
notificación, no se instala ningún certificado.
"""

from __future__ import annotations

import base64
import importlib.util
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
GEN = API_ROOT / "scripts" / "gen_vapid_keys.py"
SELFTEST = API_ROOT / "scripts" / "selftest_vapid.py"


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _generate_synthetic_pair() -> tuple[str, str]:
    """Ejecuta el generador real y devuelve (publica, privada) en base64url."""
    proc = subprocess.run([sys.executable, str(GEN)], capture_output=True, text=True,
                          cwd=str(API_ROOT))
    assert proc.returncode == 0, proc.stderr
    pub = priv = None
    for line in proc.stdout.splitlines():
        if line.startswith("VAPID_PUBLIC_KEY="):
            pub = line.split("=", 1)[1].strip()
        elif line.startswith("VAPID_PRIVATE_KEY="):
            priv = line.split("=", 1)[1].strip()
    assert pub and priv, proc.stdout
    return pub, priv


def test_generator_emits_web_push_shaped_keys():
    """La forma debe ser la que exige Web Push, no 'algo parecido'."""
    pub, priv = _generate_synthetic_pair()
    pub_raw, priv_raw = _b64url_decode(pub), _b64url_decode(priv)
    assert len(pub_raw) == 65, "la clave publica debe ser un punto EC sin comprimir"
    assert pub_raw[0] == 0x04, "prefijo 0x04 = punto sin comprimir"
    assert len(priv_raw) == 32, "la clave privada debe ser el escalar de 32 bytes"
    # base64url sin relleno: lo que el navegador acepta como applicationServerKey.
    for value in (pub, priv):
        assert re.fullmatch(r"[A-Za-z0-9_-]+", value), "base64url sin relleno ni '+/'"


def test_generator_pair_is_fresh_each_run():
    """Dos ejecuciones no pueden devolver el mismo par (entropia real)."""
    assert _generate_synthetic_pair() != _generate_synthetic_pair()


def _run_selftest(env_extra: dict) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", **env_extra}
    return subprocess.run([sys.executable, str(SELFTEST)], capture_output=True,
                          text=True, cwd=str(API_ROOT), env=env)


def _pywebpush_installed() -> bool:
    """¿Está `pywebpush` disponible para el intérprete que corre los subprocesos?"""
    return importlib.util.find_spec("pywebpush") is not None


def _running_in_ci() -> bool:
    return os.environ.get("CI", "").strip().lower() in {"1", "true", "yes", "on"}


def test_selftest_proves_a_real_vapid_signature():
    """
    Acreditación POSITIVA: una clave sintética válida debe producir una firma
    real, no solo "no explotó". Es lo que demuestra que el formato que emite
    `gen_vapid_keys.py` y el pin `pywebpush==1.14.1` son compatibles de verdad.

    `pywebpush` es una dependencia de `apps/api/requirements.txt`, así que en CI
    SIEMPRE está y la exigencia es dura. En una máquina de desarrollo puede no
    estar instalada: en ese caso se omite con motivo explícito, porque un rojo
    que dice "clave inválida" cuando en realidad falta una dependencia es una
    señal falsa, y aquí las señales falsas son el enemigo. La guarda sobre CI
    impide que la omisión tape una regresión del entorno de integración.
    """
    if not _pywebpush_installed():
        assert not _running_in_ci(), (
            "en CI `pywebpush` DEBE estar instalado (apps/api/requirements.txt): "
            "si falta, la acreditacion positiva de firma no se esta ejecutando"
        )
        pytest.skip(
            "pywebpush no instalado en este entorno: la firma positiva se exige en CI. "
            "Para ejecutarla localmente: pip install -r apps/api/requirements.txt"
        )
    pub, priv = _generate_synthetic_pair()
    result = _run_selftest({
        "VAPID_PUBLIC_KEY": pub,
        "VAPID_PRIVATE_KEY": priv,
        "VAPID_SUBJECT": "mailto:pruebas@example.invalid",
        "REMINDER_TICK_SECRET": "secreto-de-tick-sintetico-para-pruebas",
    })
    salida = result.stdout + result.stderr
    assert result.returncode == 0, (
        "Una clave VAPID valida DEBE producir una firma real "
        "(stdout/stderr omitidos por privacidad)"
    )
    assert "firma generada correctamente: OK" in salida, "Firma VAPID positiva no acreditada"
    assert "RESULTADO: OK" in salida, "El self-test no acredita exito"


def test_selftest_never_prints_key_material():
    """
    Requisito explícito: la consola es sensible. El self-test puede decir si una
    clave está y cuánto mide, nunca cuánto vale.

    No depende de que la firma funcione: la salida no puede filtrar material de
    clave ni en el camino de éxito ni en el de error, así que esta prueba corre
    siempre, con o sin `pywebpush`.
    """
    pub, priv = _generate_synthetic_pair()
    tick = "secreto-de-tick-sintetico-para-pruebas"
    result = _run_selftest({
        "VAPID_PUBLIC_KEY": pub,
        "VAPID_PRIVATE_KEY": priv,
        "VAPID_SUBJECT": "mailto:pruebas@example.invalid",
        "REMINDER_TICK_SECRET": tick,
    })
    salida = result.stdout + result.stderr
    assert priv not in salida, "la clave PRIVADA no puede aparecer en la salida"
    assert pub not in salida, "tampoco la publica completa"
    assert tick not in salida, "ni el secreto del tick"
    # Fragmentos: ni siquiera un prefijo reconocible de la privada.
    assert priv[:12] not in salida
    assert "pruebas@example.invalid" not in salida, "El subject puede contener una direccion privada"
    assert "mailto:pruebas@example.invalid" not in salida
    assert "presente (mailto)" in salida
    # Lo que sí debe decir: presencia y longitud.
    assert "presente" in salida
    assert str(len(priv)) in salida, "debe informar la longitud, no el valor"


def test_selftest_reports_missing_configuration_without_inventing_success():
    """Sin variables, no puede declarar que el push está listo."""
    result = _run_selftest({
        "VAPID_PUBLIC_KEY": "", "VAPID_PRIVATE_KEY": "",
        "VAPID_SUBJECT": "", "REMINDER_TICK_SECRET": "",
    })
    salida = result.stdout + result.stderr
    assert "AUSENTE" in salida
    assert result.returncode != 0, "debe salir con error si falta configuracion"
    assert "OK — push listo para operar" not in salida


def test_selftest_rejects_a_malformed_private_key_without_echoing_it():
    """
    Una clave privada inválida debe producir un diagnóstico, nunca el valor.
    (Si falta `pywebpush`, el self-test lo dice y sale: también es un resultado
    honesto, así que el test acepta ambos caminos sin inventar un PASS.)
    """
    pub, _ = _generate_synthetic_pair()
    basura = "esto-no-es-una-clave-valida-pero-es-larga"
    result = _run_selftest({
        "VAPID_PUBLIC_KEY": pub,
        "VAPID_PRIVATE_KEY": basura,
        "VAPID_SUBJECT": "mailto:pruebas@example.invalid",
        "REMINDER_TICK_SECRET": "x" * 24,
    })
    salida = result.stdout + result.stderr
    assert basura not in salida, "nunca se hace eco del valor de la clave"
    assert result.returncode != 0
    assert ("pywebpush" in salida) or ("ERROR firmando" in salida), salida[-400:]
