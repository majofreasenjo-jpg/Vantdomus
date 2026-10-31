# DOMI / VANTDOMUS — R89 (2026-10-30)

## Continuidad y criterios de aceptación
Biblia Rectora Canónica V2.1 + Addenda 31–32 y `docs/governance/DOMI_CANON_10_SCORECARD_BASELINE_20261019.json`. Registro append-only. Se preserva el alcance de los doce órganos y diez ejes del programa integral.

## Hallazgos verificables
- R88 navegador real con memoria, reinicio e aislamiento, CI [41079680470](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41079680470): SUCCESS, datos ficticios y SQLite desechable.
- R88 Security Gate general [41079693521](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41079693521): FAILURE en el build de la web, no en backend/PostgreSQL. Logs indican error de Turbopack resolviendo `next/font/google` desde la ruta `app/hogar/[householdId]/page.tsx`.
- Identificada en `domiSameOrigin.mjs` una alternativa no justificada: el parámetro `fallbackOrigin` permitía dar por válido un origen que coincidiera con el fallback aun si el Host real era distinto. Requería endurecimiento.

## Cambios R89 (rama de desarrollo)
1. Pantalla principal de hogar ahora usa alias locales `--domi-font-*` ya definidos en `app/globals.css`; sin `next/font/google`, manteniendo jerarquía visual y tipografías sustitutivas del diseño.
2. El proxy valida igualdad estricta Host:port con URL Origin. HTTP permitido solo en loopback local, HTTPS requerido para hosts externos; no permite el fallback como bypass. Se mantiene token CSRF/cookie y autenticación.
3. Test de rechazo de origen ajeno aun cuando fallback coincida, y de HTTP remoto. Ampliación del test de fuentes a la ruta principal.
4. Browser CI vuelve a dispararse cuando cambie la ruta principal y su configuración de regresión.

## Evidencia y estado
La aceptación R89 requiere **ambos**: Security Gate completo SUCCESS y E2E Chromium SUCCESS en el mismo SHA final; Preview READY por sí solo no acredita cierre. Resultados aún pendientes al escribir el checkpoint. No afirmar test físico móvil.

## Diez ejes
| Eje | % acreditado | Delta R89 |
|---|---:|---:|
| D01 Personal | 45 | 0 |
| D02 Familiar | 45 | 0 |
| D03 Desarrollativo | 25 | 0 |
| D04 Federado | 45 | 0 |
| D05 Multidispositivo | 45 | 0 |
| D06 Organizacional | 10 | 0 |
| D07 DOMI–EDIS | 10 | 0 |
| D08 Legado | 10 | 0 |
| D09 Titan/comercial | 25 | 0 |
| D10 MICR/ciencia | 25 | 0 |
| **Global** | **28,5** | **0** |

## Siguiente puerta, sin reducción del objetivo
Con Gate y browser aprobados: despliegue de staging familiar dedicado con autenticación, readback móvil-PC físico y RLS PostgreSQL vigente, autorizado y aislado. Luego completar memoria longitudinal por integrante, identidad, interacción, órganos, legado, DOMI-EDIS y Titan. No Neon archivado, billing, datos reales, producción o outreach sin autorización.
