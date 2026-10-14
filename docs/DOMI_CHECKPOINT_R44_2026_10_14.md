# DOMI R44 — arranque PostgreSQL firmado con control de contratos — 2026-10-14

## Evidencia de base
- Security Gate #242, run 38618914575: backend/web/mobile/Pg PASS; auth 62/62, RLS+HTTP 37/37 PASS y auditoría web cero. Staging smoke omitido.
- Inspección READ-ONLY de Neon proyecto solitary-dawn-70172559, rama br-broad-poetry-aksbxhbf: 57 tablas públicas, RLS 0, FORCE 0, policies 0; roles solo neondb_owner entre los requeridos, rol dueño con BYPASSRLS/CREATEROLE; pgcrypto ausente. Nada mutado.
- PR #2 DRAFT, sin merge. Railway no desplegado.

## Diagnóstico
- `apps/api/app/pg_staging_gate.py` exigía siempre helper legado `domi_auth.activate_session(text,text)` aun si modo HMAC firmado estaba activo. Esto impide certificar el nuevo contrato y podría inducir a habilitar componentes viejos innecesarios.
- El esquema de Neon carece de roles, extensión y políticas; no es seguro conectarlo a recuerdos personales. Pruebas de PostgreSQL desechable no sustituyen políticas reales.
- Arranque de runtime actualmente conectado desde main.initialize_app_state solo en DATABASE_URL PostgreSQL. El helper real sujeto/JTI por HMAC necesita verificaciones adicionales a RLS estructural.

## Implementación R44
- Commit 99cfcad9c088eac44aac319e6587e7da9dc00666.
- `check_postgres_staging_readiness(db,signed_rls=True)` mantiene los controles existentes para 57 tablas con FORCE RLS, políticas y roles no privilegiados y exige adicionalmente: membresía NOLOGIN/NOINHERIT en domi_app_runtime, SECURITY DEFINER domi_r31.subject_id() de owner restringido, permisos de EXECUTE a runtime, tabla criptográfica context_secrets FORCE RLS privada y extensión pgcrypto con HMAC disponible. No acepta helper legado en modo firmado. Modo anterior conserva validación original.
- Startup enlaza DOMI_ENABLE_SIGNED_RLS_RUNTIME a comprobación específica, preservando fail closed.
- Tres pruebas unitarias negativas y positivas de gate + dos pruebas contra esquema PostgreSQL desechable. RLS+HTTP ahora define 39 pruebas; resultado de CI nuevo PENDIENTE, no declarado PASS.
- Solo archivos del PR actualizados. No DDL ejecutado en Neon ni despliegue.

## Limitaciones bloqueantes
1. Revisar nueva CI completa: backend/web/mobile PASS, PostgreSQL auth 62/62 y RLS 39/39, npm audit cero. Corregir errores sin debilitar políticas.
2. Preparar y probar migraciones contra rama aislada Neon bajo autorización expresa; no utilizar neondb_owner como runtime.
3. Revisar funciones de autenticación reales y su portabilidad a esquema DATE TEXT/INTEGER y confidencialidad de claves; luego staging con credenciales restringidas y costos autorizados.
4. Flujo físico PC–teléfono, cookies CSRF, inicio/cierre de sesión y recuerdos autorizados todavía no probado. Owner Beta no habilitada.

## Cápsula de rehidratación
DOMI_R44_SIGNED_POSTGRES_STARTUP_GATE_20261014 | baseline CI #242 PASS 62 auth/37 RLS/HTTP | Neon validation 57 public tables 0 RLS/FORCE/policies y sin pgcrypto ni roles restringidos | R44 código signed startup gate 99cfcad9, 39 pruebas RLS definidas, CI pendiente | no Railway, no personal beta.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R44_SIGNED_POSTGRES_STARTUP_GATE_20261014, repositorio majofreasenjo-jpg/Vantdomus PR #2 rama domi-neon-staging-pg-startup-gate-20261010, commit 99cfcad9c088eac44aac319e6587e7da9dc00666. Verifica Security Gate nuevo: backend/web/mobile PASS, auth 62/62, RLS 39/39, web audit 0. Si falla, reparar causa sin omitir pruebas. Confirmar contra contrato real Neon: 57 tablas públicas, 0 RLS, owner con BYPASSRLS, faltan roles y pgcrypto; NO ejecutar migraciones sin control de cambio y autorización en aislado, nunca main. No desplegar Railway ni fusionar PR. Priorizar Owner Beta real, sesiones/revocación/memoria autorizada y PC-teléfono. Crear bitácora/cápsula/reinicio append-only por avance.
