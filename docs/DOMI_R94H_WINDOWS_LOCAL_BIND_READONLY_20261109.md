# DOMI R94-H — Diagnóstico de escucha local, sin cambios de infraestructura

Fecha: 2026-11-09. Base: R94-G `4fa034940aa85319bb3b9bbf64f15ab962003b86` — CI [42636891250](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/42636891250) SUCCESS (seis jobs).

## Problema y columna vertebral
La prueba sintética R94-F y el filtro de cabeceras R94-G cerraron barreras de identidad, memoria y confianza interna, pero no demostraron que el PC real mantuviera los servicios HTTP restringidos a loopback. El banco R94-A necesita comprobar primero esa invariante antes de proponer HTTPS y DNS privados. **Este diagnóstico no supone autorización para ejecutarlo en el equipo del Owner:** entrega código y ensayos de diseño.

## Entregable
- `tools/windows/Get-DOMI-R94H-ReadOnlyReadiness.ps1`: diagnóstico pasivo de los listeners locales TCP 3000 (Next) y 8001 (FastAPI) con `Get-NetTCPConnection`. No se abre ni prueba ninguna conexión, ni se modifican puertos, CA, DNS, certificados, firewall, cuentas o bases.
- Resultado JSON de código fijo, sin IP, PID, usuario, tokens, rutas del equipo ni datos familiares.
- `LOOPBACK_ONLY` solo cuando **todas** las escuchas del puerto están restringidas a `127.0.0.1` o `::1`; `NON_LOOPBACK_OR_UNKNOWN` ante cualquier bind más amplio; `NOT_LISTENING` si no se observan listeners. Si inspección falla, `INSPECTION_UNAVAILABLE`.
- `source=SYNTHETIC_FIXTURE` permite CI con escenarios ficticios sin consultar la máquina. Un resultado de este modo **nunca** equivale a evidencia del PC.
- `tools/r94a/domiR94hReadOnlyReadiness.test.mjs`: validaciones adversariales ejecutando `pwsh` con fixtures, incluyendo coexistencia de listener loopback y `0.0.0.0`, direcciones LAN y entrada malformada. Security Gate obligatorio.

## Ejecución futura en PC Windows (NO ejecutada, requiere una acción local expresa)
Desde el checkout del código revisado, sin privilegios de administrador y sin copiar secretos:
```powershell
pwsh -NoProfile -File tools/windows/Get-DOMI-R94H-ReadOnlyReadiness.ps1
```
No enviar capturas con nombres reales o rutas; el JSON de la herramienta contiene únicamente clasificación. No es necesario instalar certificados ni tocar el firewall para ejecutar este comando pasivo.

## Riesgos que NO se cierran
- El script no acredita que el proceso que escucha sea realmente Next/FastAPI: `listenerIdentityVerified=false`.
- Aunque ambos listeners sean loopback, eso no certifica el futuro ingreso TLS único, confianza del certificado, resolución privada del nombre, firewall, CSRF o conectividad física.
- El proxy TLS privado debe ser la única escucha en LAN y la API debe seguir en loopback. La configuración de confianza DNS-01 o CA local permanece por decidir y requiere autorización específica.
- La fase física F1–F10 continúa PENDIENTE y el resultado `physicalDeviceCertified=false` jamás cambia en este script.
- Si se observa una escucha de interfaz amplia, detener la instalación futura hasta revisión humana. **El script no intenta repararla.**

## Gobernanza y métricas
PR aislado contra R94-G. No fusionar sin autorización Owner, no editar `main` ni red. Todos los cambios son código, test sintético y documentación.

| Eje | Acreditado | Delta |
|---|---:|---:|
| D01 Personal | 45 % | 0 |
| D02 Familiar | 45 % | 0 |
| D03 Desarrollativo | 25 % | 0 |
| D04 Federado | 45 % | 0 |
| D05 Multidispositivo | 45 % | 0 |
| D06 Organizacional | 10 % | 0 |
| D07 DOMI–EDIS | 10 % | 0 |
| D08 Legado | 10 % | 0 |
| D09 Titan/comercial | 25 % | 0 |
| D10 MICR/ciencia | 25 % | 0 |
| **Global** | **28,5 %** | **0** |
