"""
OPS-2 M7.B — Self-test de firma VAPID (no envía nada, no imprime secretos).

Verifica, ANTES de confiar en el Cron, que el push está realmente operativo:
  1. `pywebpush` instalado;
  2. las tres variables VAPID presentes;
  3. la firma VAPID se genera sin error para un endpoint de ejemplo.

NO contacta ningún push service, NO envía notificaciones y NUNCA imprime el
valor de las claves (solo si están presentes y su longitud).

Uso:  python scripts/selftest_vapid.py     → exit 0 si todo OK, 1 si falta algo.
"""

import os
import sys


def _mask(value: str) -> str:
    """Nunca imprime la clave: solo presencia y longitud."""
    return f"presente ({len(value)} chars)" if value else "AUSENTE"


def main() -> int:
    ok = True

    pub = os.getenv("VAPID_PUBLIC_KEY", "").strip()
    priv = os.getenv("VAPID_PRIVATE_KEY", "").strip()
    subject = os.getenv("VAPID_SUBJECT", "").strip()
    tick = os.getenv("REMINDER_TICK_SECRET", "").strip()

    print("[1/3] Variables de entorno")
    print(f"      VAPID_PUBLIC_KEY     : {_mask(pub)}")
    print(f"      VAPID_PRIVATE_KEY    : {_mask(priv)}")
    print(f"      VAPID_SUBJECT        : {subject or 'AUSENTE'}")
    print(f"      REMINDER_TICK_SECRET : {_mask(tick)}")
    if not (pub and priv and subject):
        print("      -> FALTAN variables VAPID: el push queda deshabilitado.")
        ok = False
    if not tick:
        print("      -> Falta REMINDER_TICK_SECRET: el endpoint /reminders/tick responderá 503.")
        ok = False
    if subject and not subject.startswith(("mailto:", "https://")):
        print("      -> VAPID_SUBJECT debería ser 'mailto:tu@correo' o una URL https.")
        ok = False

    print("[2/3] Librería pywebpush")
    try:
        from py_vapid import Vapid01  # noqa: F401  (viene con pywebpush)
        import pywebpush  # noqa: F401
        print("      pywebpush disponible: OK")
    except Exception as exc:
        print(f"      pywebpush NO disponible ({type(exc).__name__}): el push queda deshabilitado.")
        return 1

    print("[3/3] Firma VAPID (sin enviar nada)")
    if not (priv and subject):
        print("      omitido: faltan clave privada o subject.")
        return 1
    try:
        from py_vapid import Vapid02
        v = Vapid02.from_raw(priv.encode("ascii"))
        headers = v.sign({"aud": "https://push.example.com", "sub": subject})
        if headers.get("Authorization"):
            print("      firma generada correctamente: OK")
        else:
            print("      la firma no produjo cabecera Authorization.")
            ok = False
    except Exception as exc:
        print(f"      ERROR firmando ({type(exc).__name__}: {exc}).")
        print("      Revisa que VAPID_PRIVATE_KEY sea la clave base64url que emitió")
        print("      scripts/gen_vapid_keys.py (no la pública, no un PEM recortado).")
        ok = False

    print()
    print("RESULTADO:", "OK — push listo para operar" if ok else "INCOMPLETO — revisa lo marcado arriba")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
