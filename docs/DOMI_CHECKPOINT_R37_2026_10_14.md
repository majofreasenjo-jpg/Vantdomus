# DOMI R37 — corrección de importación del arnés de autenticación · 2026-10-14

Predecesor append-only: DOMI_CHECKPOINT_R36_2026_10_13.md.

## Evidencia
- Security Gate #224, ejecución 38499835200, FAILURE. Web y móvil PASS. Backend y PostgreSQL FAIL durante recolección de pruebas, antes de evaluarlas.
- Primera causa: tests/security/test_domi_pg_rls_pilot.py importaba pg_session_context.py con importlib.spec_from_file_location, perdiendo el contexto del paquete. R36 añadió importación relativa `from .pg_rls_context import bind_signed_rls_context` correcta en `app`, pero inválida al cargar un archivo aislado.
- Último gate íntegro certificado: #221, autenticación 62/62 y RLS 17/17 PASS. Las 19 pruebas R36 todavía NO están certificadas.
- Neon real no modificado; 57 tablas sin RLS en última comprobación, Railway sin desplegar, PR #2 DRAFT.

## R37 implementado
- Commit `07e961df44cd0d71c278a80e40140faa99556d81` modifica solo tests/security/test_domi_pg_rls_pilot.py.
- El módulo PgSessionContext ahora se importa por su nombre `app.pg_session_context`, incorporando apps/api a sys.path del arnés en lugar de usar importlib sobre un archivo desnudo. Mantiene 62 casos de autenticación y no toca el código de autorización de producción.
- CI R37 PENDIENTE; verificar antes de afirmar aprobado. Requiere backend/web/mobile, auth 62/62, RLS 19/19 y npm audit sin alertas.
- Rollback R36 y HMAC opt-in siguen sin desplegarse. Nada aplicado a Neon ni a Railway.

## Cápsula de rehidratación
DOMI_R37_PG_SESSION_IMPORT_FIX_20261014 | #224 falla al coleccionar pruebas por importación directa fuera de paquete | commit 07e961df corrige a app.pg_session_context | nueva CI pendiente | Neon RLS real 0/57 | Railway no desplegado | Owner Beta real NO LISTA.

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde DOMI_R37_PG_SESSION_IMPORT_FIX_20261014, GitHub majofreasenjo-jpg/Vantdomus PR #2 rama domi-neon-staging-pg-startup-gate-20261010, commit 07e961df44cd0d71c278a80e40140faa99556d81. Primero inspecciona nuevo GitHub Security Gate, exige backend/web/mobile PASS, 62/62 auth, 19/19 RLS y web npm audit 0. Si falla, corregir causa real sin desactivar controles; después verificar integración HTTP JWT→Postgres HMAC y rollback fail-closed en entorno desechable. No Neon main ni validación mutable hasta autorización/control de cambio, no Railway deploy ni merge del PR. Preservar bitácora append-only, cápsula y reinicio exacto.
