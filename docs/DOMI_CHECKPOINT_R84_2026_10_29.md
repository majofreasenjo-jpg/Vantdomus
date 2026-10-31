# DOMI / VANTDOMUS — CHECKPOINT R84 (2026-10-29)

## Alcance
Continuidad de R83, preservando la Biblia Rectora Canónica V2.1 en Google Drive como referencia superior. R84 es únicamente un avance del **ensayo familiar sintético offline**; no se declara DOMI integral, sincronización real, memoria personal real ni producción.

## Implementación
- Codec estricto: `apps/web/lib/domiSyntheticTransfer.mjs`.
- Interfaz de ensayo: `apps/web/app/family-local-pilot/FamilyLocalPilot.tsx`.
- Pruebas positivas y adversariales: `apps/web/tests/domi-r84-synthetic-transfer.test.mjs`.
- Gate integrado: `.github/workflows/security-gate.yml`.
- Exportación JSON manual y lectura de archivo desde navegador, sin API ni servicios externos.
- Consentimiento afirmativo y confirmación de reemplazo; validación de campos, esquema, tamaño máximo, referencias de integrantes, IDs duplicados y pérdidas de datos.
- Advertencia permanente: sólo datos ficticios; la confirmación humana **no acredita por sí sola** que un contenido sea ficticio. No usar datos reales.

## Estado verificable
- R83: última Preview READY y Security Gate PASS antes de R84.
- R84: cambios comprometidos en rama de ensayo; requeridos CI concluyente, Preview READY de SHA final y prueba visual/manual para acreditar cierre funcional.
- Render: fallo por suspensión de facturación según expediente anterior. No reactivado ni autorizado cobro.
- Ningún cambio a Neon, datos reales, memoria del Owner, producción o outreach.

## Scorecard canónico conservado
| Eje | Avance acreditado | Delta R84 |
|---|---:|---:|
| D01 Personal | 45% | 0 |
| D02 Familiar | 45% | 0 |
| D03 Desarrollativo | 25% | 0 |
| D04 Federado | 45% | 0 |
| D05 Multidispositivo | 45% | 0 |
| D06 Organizacional | 10% | 0 |
| D07 DOMI-EDIS | 10% | 0 |
| D08 Legado | 10% | 0 |
| D09 Titan/comercial | 25% | 0 |
| D10 MICR/ciencia | 25% | 0 |
| GLOBAL | 28,5% | 0 |

Regla: un Preview mejorado no acredita una puerta de aceptación integral. No subir porcentajes sin evidencia de cierre del eje.

## Próximo hito de cierre real
Revisar servicio backend familiar existente en el workspace Render **confirmado por Owner**; resolver facturación sólo con intervención/autorización expresa; probar end-to-end login, roles, RLS por hogar, memoria gobernada y readback móvil-PC. Preservar autoridad y linaje de DOMI y los doce órganos, evitando reducir el producto al planificador.

## Gobierno
Append-only; el presente checkpoint no sustituye R81–R83 ni la Biblia Rectora, sino que los complementa.
