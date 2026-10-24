# DOMI R41 — Owner UI TypeScript y admisión RLS 57/57 · 2026-10-14

## Evidencia verificada
- Security Gate #234, run 38586959638: PostgreSQL autenticación 62/62 PASS, RLS+HTTP R40 35/35 PASS; web falló TypeScript OwnerPrivateClient.tsx línea 62 (sender inferido como string). Móvil PASS, backend aún en curso en esa consulta. No atribuir éxito al gate global.
- El PR #2 continúa DRAFT. RLS real Neon validación última consulta 0/57; Railway sin despliegue.

## Cambios implementados
- Commit 86e05f7917b1e4afac09e7f64cd8ce71f11273b0 repara tipo Message[] sin alterar interacción ni consentimiento.
- Commit 00ee0cddea5a1a733aef15b320e1f3f133bd3f91 instala barrera fail-closed en _require_owner_memory_enabled: cada ruta Owner de datos personales exige esquema public con exactamente 57 tablas y todas relrowsecurity, relforcerowsecurity, y al menos una política; fallas de inspección devuelven HTTP 503. Esta comprobación no reemplaza auditoría semántica de políticas ni autorización de roles.
- Dos pruebas adversariales nuevas: NO FORCE RLS de tabla scheduler_runs y drift de 58a tabla; las pruebas restauran al finalizar. RLS/HTTP pasa a 37 funciones de prueba definidas. Nueva CI pendiente, no declarar 37/37 PASS.
- No se aplicaron migraciones sobre Neon real ni se habilitaron datos personales. La barrera por catálogo no convierte a la Owner Beta en producto operativo.

## Pendientes prioritarios
1. Verificar Security Gate siguiente al commit 00ee0cd: backend, web, móvil, 62/62 auth, 37/37 RLS+HTTP, cero auditoría web. Corregir errores causales conservando test y privacidad.
2. Preflight de roles PostgreSQL en Neon rama aislada; revisión por tablas/policies con 57/57 FORCE, plus prohibición de LOGIN dueño/privilegios. Solo luego aplicar migración validada bajo autorización y control de cambio.
3. Verificar login con cookies HttpOnly + CSRF y flujo Owner-private real con modelo de IA controlado; pruebas de computador y teléfono.
4. No modificar Neon main ni Railway ni fusionar PR sin autorización.

## Cápsula de rehidratación
DOMI_R41_OWNER_UI_FIX_AND_RLS_ADMISSION_20261014 | CI #234 auth 62/62 + RLS 35/35 PASS pero web TypeScript FAIL | commits 86e05f7 y 00ee0c; 37 pruebas RLS definidas, nueva CI pendiente | Neon real RLS 0/57 | Railway sin deploy | Owner Beta real bloqueada.

## Exact Prompt Restart
Retoma VANTDOMUS DOMI desde DOMI_R41_OWNER_UI_FIX_AND_RLS_ADMISSION_20261014, repo majofreasenjo-jpg/Vantdomus, PR #2, rama domi-neon-staging-pg-startup-gate-20261010, commit 00ee0cddea5a1a733aef15b320e1f3f133bd3f91. Comprueba Security Gate de este commit, exige auth PostgreSQL 62 PASS y RLS 37 PASS y backend/web/mobile PASS. Corrige fallos de UI o RLS sin eliminar la comprobación 57/57. Luego avanza al entorno Neon validación bajo aprobación, jamás main, sin desplegar Railway ni gastos. Conservar documentación append-only, cápsula y Exact Prompt Restart.
