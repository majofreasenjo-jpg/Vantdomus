# DOMI / VANTDOMUS — R94-G · Límite de confianza de cabeceras del proxy (2026-11-09)

## Columna vertebral canónica
Biblia Rectora V2.1 + Addenda 31–32 · 12 órganos · D01–D10. El objetivo de este corte es eliminar la suplantación de metadatos de proxy entre navegador, Next.js y API FastAPI antes de ejecutar una prueba de transporte privado real.

## Línea base
- PR #10 R94-F, SHA `e64443dcf8958fd531d92d4c24253b5a007cdcec`: Security Gate [42625034486](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/42625034486) **SUCCESS**.
- R94-E, PR #9: integración conjunta FastShip, R94-B y R94-C/D, igualmente certificada.
- R94-A es únicamente diseño; NO hay instalación de TLS, DNS, CA, reglas de firewall ni servidor LAN.

## Hallazgo y corrección R94-G
Los dos proxies de Next.js ya filtraban `Host`, `Cookie` y `Authorization` del navegador. Sin embargo, el forwarder copiaba cabeceras de origen controlables por el cliente como `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Real-IP` y variantes `X-Original-*` sin un límite de confianza explícito.

Se añadió `apps/web/lib/domiProxyHeaderPolicy.mjs` como única política compartida de filtrado de cabeceras de entrada, empleada por:
- `apps/web/app/api/proxy/[...path]/route.ts` (autenticado)
- `apps/web/app/api/public/[...path]/route.ts` (login/invitación)

La política deniega metadatos de red y reescritura provenientes del navegador y los hop-by-hop, pero mantiene encabezados de aplicación como `Content-Type`, `Accept`, `Origin` y `X-CSRF-Token`. El token Bearer del proxy autenticado se agrega exclusivamente desde la cookie gestionada por el servidor; el proxy público no lo incorpora.

`apps/web/tests/domi-r94g-forwarded-header-firewall.test.mjs` verifica la política con entradas adversariales, el recorrido de ambos proxies y una simulación de colección de cabeceras. El Security Gate ejecuta esta suite obligatoriamente.

## Limitaciones y pendientes
1. La prueba es **offline** y de código Node. No existe verificación de un servidor HTTPS real ni de un teléfono físico.
2. Un proxy inverso real debe validar el `Host` en la primera frontera de confianza, borrar cabeceras `Forwarded` y `X-Forwarded-*` arbitrarias del cliente y, si son necesarias, reemplazarlas por valores generados por el borde.
3. La política Next.js no reemplaza los controles de `TrustedHostMiddleware`, autenticación, CSRF, aislamiento multi-hogar, certificados de confianza, escucha exclusiva en loopback y firewall mínimo.
4. El expediente de transporte R94-A conserva **SIN RESOLVER** la confianza TLS, el DNS privado, la ruta física PC–teléfono y los recibos F1–F10.
5. No se ejecutaron instalaciones, aperturas de puertos, conexiones a servicios, publicación ni operaciones con datos reales.

## Criterio de cierre
GitHub Security Gate completo SUCCESS sobre el SHA definitivo de esta rama, con prueba R94-G explícitamente aprobada. La aceptación no aumenta porcentajes ni acredita la conectividad física.

## Matriz de ejes, sin inflación
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

## Gobernanza
R94-G queda en rama aislada y PR draft contra R94-F. No fusionar PR #5, #7, #8, #9, #10 ni esta propuesta sin autorización expresa. No tocar `main` ni producción. Reversión: descartar los cambios de filtrado en la rama de laboratorio.
