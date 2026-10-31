# DOMI / VANTDOMUS — R90 — 2026-10-31

## Marco rector
Biblia Rectora Canónica V2.1 + Addenda 31–32; diez ejes y doce órganos permanecen vigentes. Registro append-only, sin reemplazar R89. No confundir un piloto aislado con la terminación del programa.

## Cierre R89 (verificado)
- GitHub Security Gate [41160755639](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41160755639) SUCCESS, 6 suites: backend, web, móvil y tres PostgreSQL CI.
- E2E Chromium [41160734262](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/41160734262) SUCCESS en el commit funcional anterior; el último commit R89 fue documental.
- Vercel Preview READY (no backend familiar público ni prueba de dispositivo físico).

## Implementación R90
- En la pantalla de Domi, la opción «Más» ofrece «Memoria y perfiles» cuando el hogar está autenticado y su estado de datos es real. Enlace al componente canónico `/perfiles/[householdId]`, no una nueva memoria paralela.
- `apps/web/tests/domi-r90-memory-navigation.test.mjs`: contrato de ruta autenticada, estado real y reutilización de memoria/biblioteca existentes.
- E2E Chromium ampliado: desde el hogar, navegar a memoria, crear un recuerdo inventado en interfaz real y recuperar ese texto tras recarga.
- El backend gobierna visibilidad y permisos: el cliente no modifica la autoridad ni el modelo de datos.
- Gate web y workflow browser activados. Aceptación pendiente hasta SUCCESS final de ambos sobre SHA relevante.

## Restricciones
Datos enteramente inventados. Sin cambios Neon archivado, Render, producción, planes de pago, outreach, dispositivos físicos o datos personales del Owner. Simular viewport móvil no prueba dispositivo móvil físico.

## Diez ejes canónicos
| Eje | Avance conservador | Delta aceptado R90 |
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
| **GLOBAL** | **28,5%** | **0** |

## Ruta crítica posterior
Superar E2E R90 en la interfaz (incluida corrección/eliminación de memoria como obligaciones futuras); ejecutar recorrido físico Windows, teléfono y persistencia backend compartida; habilitar staging PostgreSQL/RLS aislado con autorización explícita; continuar identidad longitudinal, relación, desarrollo, órganos, legado, EDIS, Titan y MICR. Ningún porcentaje se incrementa por entregables preparatorios sin la puerta completa.
