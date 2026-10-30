# DOMI / VANTDOMUS — Checkpoint append-only R88 (2026-10-30)

## Fuente rectora y alcance
Biblia Rectora Canónica V2.1 + Addenda 31–32 y `docs/governance/DOMI_CANON_10_SCORECARD_BASELINE_20261019.json`; sin reducir DOMI a calendario/compras. R88 examina el acceso inicial sobre HTTP real, no prueba identidad, afectividad, legado ni continuidad física.

## Baseline de continuidad
R87: commit `0d039df2a26adb2a69454d233e5048a4a3c948d8`; Security Gate [41067868430](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41067868430) SUCCESS en las seis suites; Vercel Preview READY. E2E de navegador real no acreditado hasta R88.

## Implementación R88
- `apps/web/tests/domi-r88-browser-e2e.mjs`: Chromium real + Next.js local + FastAPI local + SQLite temporal, sin servicios externos.
- Recorrido: primer ingreso con alias ficticio, cookies, alta del hogar, memoria compartida mediante proxy CSRF, relectura, reinicio del proceso FastAPI, segunda sesión independiente con viewport móvil, aislamiento anónimo y entre dos hogares.
- `.github/workflows/domi-r88-browser-e2e.yml`: runner separado, instalación acotada de Playwright y Chromium, no se conecta a Neon ni a Render. El runner Ubuntu 26.04 falló por compatibilidad Playwright antes de ejecutar la prueba; se fijó Ubuntu 24.04. Repetición [41079340907](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41079340907) iniciada, resultado pendiente al preparar este checkpoint.
- Simular viewport móvil NO equivale a probar teléfono físico; no se declarará cobertura de Android/iOS ni redes reales.
- Sin cambios al backend de producción, secretos, datos familiares, servicios de facturación ni DB cloud.

## Scorecard obligatorio
| Eje | Avance previo conservado | Cambio probado R88 |
|---|---:|---:|
| D01 Personal | 45% | 0 |
| D02 Familiar | 45% | 0 |
| D03 Desarrollativo | 25% | 0 |
| D04 Federado | 45% | 0 |
| D05 Multidispositivo | 45% | 0 |
| D06 Organizacional | 10% | 0 |
| D07 DOMI–EDIS | 10% | 0 |
| D08 Legado | 10% | 0 |
| D09 Titan/comercial | 25% | 0 |
| D10 MICR/ciencia | 25% | 0 |
| GLOBAL | 28,5% | 0 |

## Gates restantes
1. CI R88 completa y eventuales correcciones de test/producto verificadas.
2. Ensayo local físico Windows, PC y teléfono real bajo autenticación con readback y control de acceso.
3. Backend privado PostgreSQL de staging con RLS validada, secrets y cuotas autorizados, sin intervención de Neon archivado no autorizada.
4. Continuidad longitudinal genuina, memoria por persona, gobierno familiar, órganos, legado, relaciones y donantes EDIS/MICR, según canon.

## Gobernanza
Append-only. Los porcentajes permanecen iguales hasta aprobar las puertas definidas; no declarar producción/uso familiar operativo. No outreach; no gastos; no datos reales.
