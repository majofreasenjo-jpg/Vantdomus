# DOMI / VANTDOMUS — Checkpoint R86 — 2026-10-29

## Referencia canónica
Biblia Rectora V2.1 de Drive y `docs/governance/DOMI_CANON_10_SCORECARD_BASELINE_20261019.json`. Continuidad append-only. No modificar los checkpoints anteriores.

## Cierre de R85
Security Gate [40982074024](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/40982074024): SUCCESS en backend, web, mobile, y tres suites PostgreSQL. Incluye prueba R85 del reinicio de aplicación sobre SQLite desechable con autenticación, readback de memoria, calendario, compras e aislamiento entre hogares. No constituye una prueba de un servicio en nube ni experiencia física móvil.

## Avance material R86
- `tools/windows/Start-DOMI-R86-Local.ps1`: lanzador para Windows usando backend FastAPI y web Next.js existentes.
- `tools/windows/Run-DOMI-R86-Web.ps1`: arranque web restringido a loopback.
- `tests/test_domi_r86_local_launcher_contract.py`: control estático del aislamiento y restricciones.
- Security Gate integra la prueba R86.
- La base de ensayo queda separada en LOCALAPPDATA, nunca en la base habitual o Neon.
- No lee ni escribe memorias personales de la familia real; requiere uso exclusivamente sintético.
- No provee backend remoto, acceso físico desde teléfono, sincronización ni servicio 24/7.
- Requiere Setup-LocalDev previo, dependencias existentes y prueba física Windows; CI no equivale a esa comprobación.
- No se desplegó backend ni migración, ni se modificó Neon o producción.

## Seguimiento ejes
| Eje | Avance |
|---|---:|
| D01 Personal | 45% |
| D02 Familiar | 45% |
| D03 Desarrollativo | 25% |
| D04 Federado | 45% |
| D05 Multidispositivo | 45% |
| D06 Organizacional | 10% |
| D07 DOMI–EDIS | 10% |
| D08 Legado | 10% |
| D09 Titan/comercial | 25% |
| D10 MICR/ciencia | 25% |
| **GLOBAL** | **28,5%** |

R86 no cierra ninguna puerta adicional de aceptación del canon; cambio de porcentajes = 0. Faltan backend familiar aislado y seguro, RLS operativo, prueba real móvil↔computador, persistencia legítima y gates constitutivos.

## Próxima obligación
1. Certificar CI R86 en SHA final y ensayar en Windows con información inventada.
2. Estabilizar el backend family-pilot cerrado con PostgreSQL y RLS en entorno aislado autorizado.
3. Realizar E2E autenticado entre dispositivos reales, con política de privacidad, consentimiento, autoridad, observabilidad y reversión.
4. Continuar órganos constitutivos, relación, desarrollo, legado, EDIS y MICR sin reducir DOMI al piloto.

## Restricciones
NO REAL DATA. NO PRODUCTION PROMOTION. NO BILLING CHANGE. NO OUTREACH. NO SCIENTIFIC CLAIM PROMOTION.
