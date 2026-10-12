# DOMI R25 — cierre de fallos CI PostgreSQL + fuentes locales — 2026-10-12

## Evidencia
- Security Gate #196, run 38306732688: backend PASS, mobile PASS, PostgreSQL 45 PASS / 1 FAIL, web FAIL.
- PostgreSQL: test_throttle_clear_failed_does_not_erase_successful omitió COMMIT en conexión issuer antes de consultar desde lookup; aislamiento transaccional impidió observar borrado. No se modifican permisos ni funciones SQL para corregirlo.
- Web: Next.js 16.4.0 Turbopack falló al compilar next/font/google Inter y Space_Grotesk de /login y /finance/[householdId], 56 errores de resolución interna de fuente. El proyecto ya tiene stacks --domi-font-inter y --domi-font-grotesk locales.
- CI #196 del web registró npm ci audit 0 vulnerabilidades antes de fallar en next build.
 
## Cambio implementado
- Commit 97783fabddd1c9acfd5fcca178a98705cf77c383.
- PostgreSQL: fixture único con email sintético, 2 fallos y 1 éxito; confirma visibilidad de fallos tras COMMIT, invisibilidad de eliminación antes de COMMIT, cero tras COMMIT; comprueba con rol administrador sintético que el éxito no fue borrado.
- Web: login y Finanzas eliminan import next/font/google y carga Inter/Space_Grotesk remota; usan variables locales de DOMI sin alterar vistas de seguridad/autenticación ni estilo cromático.
- Test de determinismo tipográfico ahora incluye ambas rutas y verifica referencias a variables existentes.
- Mantiene 46 pruebas PostgreSQL, sin suprimir otras pruebas, sin desactivar auditoría.
- Nuevo resultado de GitHub Security Gate para R25: pendiente de observar, no atribuir PASS sin logs.

## Límites y siguientes gates
- Auth roles de lectura y emisión están separados en CI sintético, pero token issuance aún necesita prueba vinculante e intransferible de autenticación.
- Neon validación última lectura: 57 tablas, cero RLS/FORCE/policies; no se modificó.
- Railway y producción intocados; PR #2 DRAFT.
- Real Owner Beta con memoria entre sesiones y teléfono: aún bloqueada por auth/RLS + pruebas físicas.

## Cápsula de rehidratación
DOMI_R25_WEB_PG_CI_REPAIR_20261012 | security gate #196 FAILED PostgreSQL 45/46 y build Next Google Fonts. Commit 97783fabddd1c9acfd5fcca178a98705cf77c383 corrige ambas causas, deja 46 pruebas, nuevo CI pendiente. Neon RLS 0/57; Railway sin desplegar. Owner Beta real NO habilitada.

## Exact Prompt Restart
Retoma DOMI en GitHub majofreasenjo-jpg/Vantdomus PR #2, rama domi-neon-staging-pg-startup-gate-20261010, desde DOMI_R25_WEB_PG_CI_REPAIR_20261012. Verifica Security Gate correspondiente a 97783fabddd1c9acfd5fcca178a98705cf77c383 o checkpoint sucesor, exige 46/46 PostgreSQL PASS, backend/web/mobile PASS y web audit cero. Si hay nuevos fallos, corrígelos conservando permisos, pruebas y Next.js parcheado. A continuación cierra autorización criptográfica ligada al usuario para emisor y flujo de sesión, completa auth y RLS 57 tablas de Neon en rama aislada, sin tocar main, sin fusionar PR y sin desplegar Railway sin autorización. Documenta bitácora, cápsula y exact prompt restart.
