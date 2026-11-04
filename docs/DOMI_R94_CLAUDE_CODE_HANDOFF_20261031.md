# DOMI R94 — Encargo verificable a Claude Code
Fecha: 2026-10-31

## Objetivo
Preparar, implementar y verificar una prueba de continuidad DOMI entre un **computador Windows y un teléfono físico** usando el backend familiar auténtico, sesión autorizada y datos exclusivamente inventados. Primero auditar lo ya construido (P5, R85–R93) y evitar reconstrucciones. **No se autoriza despliegue público, nueva facturación o uso de datos reales.**

## Base confirmada
- Rama estable de ensayo: `domi-neon-staging-pg-startup-gate-20261010`; commit `cd28bb4b9112c6c3f168a86a287debd3fc08ed84`.
- Security Gate `41217065337` SUCCESS y Chromium `41217062176` SUCCESS.
- Vercel Preview READY, pero no acredita backend remoto ni teléfono físico.
- `tools/windows/Start-DOMI-R86-Local.ps1` solo escucha loopback, por diseño. Un teléfono no puede usar directamente `127.0.0.1` del computador.
- El canon conservador sigue en 28,5% global; no existe puerta real PC–teléfono aprobada.

## Secuencia a ejecutar en Claude Code local
1. Abrir el repositorio `majofreasenjo-jpg/Vantdomus`, checkout de `domi-r94-claude-code-handoff-20261031` y leer `CLAUDE.md`, canon, los checkpoints R85–R93, servicios FastAPI, proxy Next, pruebas de RLS y P5 de transporte.
2. Confirmar qué capacidad ya existe y qué falta para continuidad autenticada entre dos dispositivos. Proponer un diagrama de confianza con separación del backend, cliente web, dispositivos, usuarios y hogares.
3. Ejecutar el sistema local con **datos ficticios** usando el lanzador existente. Comprobar alta de hogar, autenticación, escritura de memoria, reinicio y relectura en el mismo dispositivo.
4. Para el segundo dispositivo proponer un transporte cifrado y autenticado, con limitación de acceso, expiración de sesión, revocación, prevención de replay, validación de host/origen, CSRF y aislamiento por hogar. Comparar las opciones antes de instalar o abrir servicios. **No abrir 0.0.0.0, puertos públicos ni túneles de terceros sin autorización concreta.**
5. Preparar un procedimiento y banco E2E que no confundan viewport móvil con teléfono físico. Separar: pruebas automáticas en runner; sesión física de Windows; sesión física Android/iPhone; lectura y escritura cruzadas; denegación entre hogares; rotación de sesión, logout y readback después de reinicio.
6. Reportar el bloqueo de infraestructura concreto y los pasos exactos que requieren acción del Owner, sin atribuirlos a errores del código cuando correspondan a conexión, permisos o costos.
7. Incorporar tests nuevos, ejecutar los anteriores, abrir PR **draft** hacia la rama estable y adjuntar matriz de pruebas y evidencia. No hacer merge ni promover producción.

## Criterios de aceptación
- Debe verse desde el PC y desde un teléfono **físico** el mismo recuerdo ficticio, con la misma identidad legítimamente autorizada.
- Cambios desde un dispositivo deben ser leídos desde el otro tras refresco, sin transportar memoria sin autorización.
- Una cuenta de otro hogar y un invitado deben obtener denegación sin exposición de memoria.
- Revocación y expiración deben impedir nuevas lecturas. El backend debe conservar datos tras reinicio.
- Integridad, consentimiento explícito y no filtración de credenciales en cliente/logs/artefactos.
- Todas las pruebas automáticas y el procedimiento físico deben aportar evidencia fechada y verificable; si un dispositivo no fue ensayado, resultado **PENDIENTE**, no PASS.

## Obligaciones de gobierno
No tocar producción, Neon archivado, Render Billing, datos personales, publicidad, proveedores IA externos ni outreach sin nueva autorización. No sobrescribir versiones previas. El manuscrito rector y los 12 órganos de DOMI siguen vigentes.

## Scorecard obligado (conservar hasta nueva puerta aprobada)
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
| GLOBAL | 28,5% |

## Entrega esperada
PR draft + diff, comandos, resultados CI, trazabilidad de R93, instrucciones de ejecución/rollback, amenazas y mitigaciones, evidencia PC/teléfono o bloqueo explícito, y scorecard D01–D10.
