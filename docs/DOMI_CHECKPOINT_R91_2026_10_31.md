# DOMI/VANTDOMUS — R91 — 2026-10-31

## Referencia superior
Biblia Rectora Canónica V2.1+Addenda31–32, 12 órganos, 10 ejes. Append-only; no reemplazar checkpoints previos.

## Auditoría de R90
- Último SHA R90: c59334f8f12970923407b09f6939a060a0697e8f
- Security Gate 41165179217: SUCCESS; Preview READY.
- Chromium E2E 41165154360: FAILURE por selector de texto ambiguo (dos nodos visibles con idéntico recuerdo). Los HTTP POST/GET de memoria retornaron 200; falla de automatización, no prueba de rechazo de servidor. R90 NO estaba cerrado integralmente.

## Cambios R91
- Evento cliente por hogar sin contenido ni token `apps/web/lib/domiMemoryEvents.ts`: el servidor permanece única fuente de verdad.
- `DomiMemory.tsx`: notifica después de alta, pide confirmación antes de eliminar y recupera lista desde API tras borrado, sincronizando biblioteca del mismo hogar.
- `MemoryLibrary.tsx`: sincroniza edición corregida con la lista de recuerdos.
- `apps/web/tests/domi-r88-browser-e2e.mjs`: selectores R90 más específicos y tramo R91 de corrección, recarga y eliminación por UI.
- Browser CI rastrea también componentes de memoria y el mecanismo de actualización.
- Sin cambios en servidor ni su política de autorización; eliminación persistente es soft-delete `deleted_at` y no borrado físico ni supresión de respaldos.

## Estado y criterio de cierre
Los nuevos commits están en rama de ensayo. Solo cerrar R91 cuando Security Gate y Chromium E2E resulten SUCCESS en código correspondiente. No declarar móvil físico o backend remoto. Revisar especialmente el selector del botón «Olvidar» y el retorno del API antes de acreditar la eliminación.

## Scorecard por eje
| Eje | % conservador | Delta R91 |
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
| **Global** | **28,5%** | **0** |

## Ruta crítica
Cerrar CI; ensayar interfaz real en Windows + teléfono físico con autorización y entorno familiar privado; habilitar Postgres/RLS staging sin Neon archivado o Render billing sin autorización. Después culminar identidad longitudinal, relación, desarrollo, órganos, legado, EDIS y MICR. Sin datos reales ni outreach.
