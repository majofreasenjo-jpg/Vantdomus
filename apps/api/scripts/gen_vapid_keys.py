"""
OPS-2 M7.B — Generador de llaves VAPID para Web Push.

Genera un par de llaves EC P-256 e imprime los valores base64url que van en las
variables de entorno de Render:
  VAPID_PUBLIC_KEY   → clave pública (la usa el navegador para suscribir)
  VAPID_PRIVATE_KEY  → clave privada (SECRETA; la usa el backend para firmar)

Solo depende de `cryptography` (ya instalado), así puedes generarlas aunque
`pywebpush` todavía no esté desplegado.

Uso (una sola vez, p.ej. en el Shell de Render):
    python scripts/gen_vapid_keys.py

Copia PUBLIC/PRIVATE a las env vars y NO las vuelvas a generar (regenerar
invalida las suscripciones existentes de los dispositivos).
"""

import base64

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def main() -> None:
    key = ec.generate_private_key(ec.SECP256R1())

    # Clave pública: punto EC sin comprimir (65 bytes) → base64url. Es el
    # applicationServerKey que el navegador espera.
    pub_raw = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    # Clave privada: valor escalar (32 bytes big-endian) → base64url. pywebpush
    # (py-vapid) la acepta directamente como vapid_private_key.
    priv_raw = key.private_numbers().private_value.to_bytes(32, "big")

    print("VAPID_PUBLIC_KEY=" + _b64url(pub_raw))
    print("VAPID_PRIVATE_KEY=" + _b64url(priv_raw))
    print()
    print("# Además pon en Render:")
    print("#   VAPID_SUBJECT=mailto:tu-correo@dominio.com")
    print("#   REMINDER_TICK_SECRET=<una cadena larga y aleatoria>")


if __name__ == "__main__":
    main()
