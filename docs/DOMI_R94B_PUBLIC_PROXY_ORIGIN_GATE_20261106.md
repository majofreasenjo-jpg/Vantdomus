# DOMI / VANTDOMUS — R94-B · Origin del proxy público (2026-11-06)

## Continuidad canónica
Biblia Rectora V2.1 + Addenda 31–32, 12 órganos, diez ejes. Cambio limitado al transporte seguro del perfil familiar, sin activar ni reconfigurar infraestructura física.

## Baseline certificado
- FastShip `4464c471d02d5a84e788444f5f26a74dc54be843`: Security Gate [42245671087](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/42245671087) SUCCESS.
- PR #5 permanece draft y **no se fusiona** sin autorización específica.
- R94 `361bf1c304205bdfadffede945b2504d31e2b613`: configuración de API Host separada y banco HTTPS de diseño.
- Ni Vercel Preview ni viewport móvil son un teléfono físico.

## Hallazgo
El proxy privado `apps/web/app/api/proxy/[...path]/route.ts` ya utilizaba `sameOriginForProxy(origin, request.headers.get("host"), request.nextUrl.origin)`; sin embargo, el proxy **público** `apps/web/app/api/public/[...path]/route.ts` comparaba `origin === request.nextUrl.origin`.

Con un futuro proxy inverso HTTPS privado, el navegador puede enviar `Origin: https://domi.lab.example.invalid`, mientras la URL de Next.js reconstruida internamente apunta a `http://localhost:3000`. Un POST legítimo de login, recuperación de contraseña o invitación podría devolver 403. Es un conflicto de origen, no autorización para omitir CSRF.

## Corrección R94-B (rama aislada)
- El proxy público reutiliza el comparador de origen exacto del proxy autenticado: `Origin` debe corresponder al encabezado `Host` y requerir HTTPS fuera de loopback.
- Se mantienen allowlist de rutas, métodos GET/POST, límite de tamaño, `no-store`, y la prohibición de reenviar cookies o Authorization al upstream.
- `apps/web/tests/domi-r94b-public-proxy-origin.test.mjs`: prueba de contrato, aceptación con Host público exacto y rechazo de dominios ajenos, bypass por fallback, HTTP LAN, credenciales en URL, puertos y rutas malformadas.
- Security Gate exige ejecutar el test antes del build web.

## Riesgos y condiciones de revisión
- Este cambio **no instala TLS** y no demuestra la seguridad de un proxy inverso real; solo prepara la validación de origen.
- Un proxy de borde debe normalizar y validar Host y X-Forwarded-Host y descartar encabezados de cliente no confiables; sin esa condición, comparar contra Host no es defensa autónoma frente a host-header injection.
- `Origin` ausente conserva el comportamiento anterior: la validación adicional de CSRF del flujo de invitación y controles de sesión siguen siendo obligaciones y deben probarse por separado.
- El bootstrap privado del primer propietario y la confianza TLS todavía no están certificados físicamente.
- Aceptación R94-B: Security Gate completo SUCCESS en SHA final y revisión del diff; no habilita fusión del PR #5 ni redes.

## Scorecard canónico sin incrementos
| Eje | % |
|---|---:|
| D01 Personal | 45 |
| D02 Familiar | 45 |
| D03 Desarrollativo | 25 |
| D04 Federado | 45 |
| D05 Multidispositivo | 45 |
| D06 Organizacional | 10 |
| D07 DOMI–EDIS | 10 |
| D08 Legado | 10 |
| D09 Titan/comercial | 25 |
| D10 MICR/ciencia | 25 |
| **Global** | **28,5** |

## Ruta posterior
Integrar de forma controlada el proxy público con FastShip una vez revisado, certificar R94 en commit conjunto y seguir con pruebas de transporte LAN autorizado solo después de resolver TLS, DNS privado, firewall e intervención física del Owner. Sin datos reales, sin facturación y sin producción.

## Reversión
Revertir únicamente el PR R94-B; no existen sockets, CA, firewall, secretos ni datos afectados.
