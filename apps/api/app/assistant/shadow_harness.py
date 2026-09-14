"""
CP1c-FUNC-MIN-3.3b — Shadow harness: prueba de la primera llamada externa
controlada, con DATOS 100% SINTÉTICOS y sin side effects.

CÓMO SE USA (solo el owner, en su terminal local):

  1. Abrir una terminal en apps/api (con el venv activado).
  2. Exportar los flags Y la key SOLO en esa terminal (mueren al cerrarla):
       set ASSISTANT_PROVIDER_MODE=openai
       set ASSISTANT_REAL_PROVIDER_ENABLED=true
       set ASSISTANT_EXTERNAL_CALLS_ALLOWED=true
       set ASSISTANT_SHADOW_MODE=true
       set APP_ENV=local
       set OPENAI_API_KEY=<key nueva/rotada — NUNCA pegarla en chats/repo/logs>
  3. Ejecutar:  python -m app.assistant.shadow_harness
  4. Cerrar la terminal al terminar (los flags vuelven a apagado solos porque
     eran variables de ESA sesión). El repo y .env no se tocan.

El harness NO usa la DB del hogar real, NO autentica a nadie, NO persiste
propuestas y NO ejecuta tools. Hace UNA (1) llamada externa como máximo.
"""

import json
import os
import sys

from .gateway import GatewayRequest, gateway, provider_flags, shadow_gates


# Fixture 100% sintético — nada de esto existe en la DB real.
SYNTHETIC_REQUEST = GatewayRequest(
    household_id="hogar-sintetico-prueba",
    user_id="usuario-sintetico-prueba",
    user_message="agrega leche sintética y pan sintético a la lista",
    home_context={
        "persons": [
            {"id": "persona-sintetica-1", "name": "Ana"},
            {"id": "persona-sintetica-2", "name": "Luis"},
        ],
        "summary_text": "Hogar de prueba: faltan productos de ejemplo.",
    },
    synthetic=True,
)


def run_shadow_test() -> dict:
    """Ejecuta la comparación shadow con el fixture sintético (sin DB)."""
    return gateway.shadow_compare(SYNTHETIC_REQUEST, db=None)


def main() -> int:
    print("=" * 62)
    print("VantDomus — MIN-3.3b SHADOW TEST (datos sintéticos, sin ejecución)")
    print("=" * 62)
    flags = provider_flags()
    print(f"flags: {flags} · APP_ENV={os.getenv('APP_ENV', 'local')}")
    ok, missing = shadow_gates(SYNTHETIC_REQUEST)
    if not ok:
        print(f"GATES INCOMPLETOS → NO habrá llamada externa. Faltan: {missing}")
    report = run_shadow_test()
    # El reporte es sanitizado por construcción (sin key, sin prompt completo).
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print("-" * 62)
    print(f"llamada externa realizada: {report['external_call_made']} · "
          f"tools ejecutadas: {report['tools_executed']} · "
          f"propuestas persistidas: {report['persisted_proposals']}")
    print("")
    print("LIMPIEZA (pega estas líneas en esta MISMA terminal antes de cerrarla):")
    print("  set OPENAI_API_KEY=")
    print("  set ASSISTANT_PROVIDER_MODE=")
    print("  set ASSISTANT_REAL_PROVIDER_ENABLED=")
    print("  set ASSISTANT_EXTERNAL_CALLS_ALLOWED=")
    print("  set ASSISTANT_SHADOW_MODE=")
    print("  set APP_ENV=")
    print("Luego cierra la terminal. Los flags quedan apagados y nada tocó .env.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
