# DOMI R16 — Bitácora append-only, cápsula y exact restart (2026-10-11)

## Evidencia
- GitHub Security Gate #176, run 38172423165: SUCCESS, jobs backend/web/mobile/postgres-rls-pilot SUCCESS; piloto 26/26 PASS.
- PR #2 DRAFT, no merge. Baseline R15 2b66b6aab0091bc5a3b7e3faea5609ed408b8ec5.
- Neon validación: esquema PostgreSQL real consultado; tables user_mfa, user_mfa_recovery_codes, auth_login_attempts, users, auth_sessions presentes. RLS sigue 0/57 según checkpoint anterior; no se aplicó SQL a Neon.
- Railway sigue STAGED sin deployment ni autorización de costo.

## R16 implementado
- Commit be5c14c2da8e3bc344f27f6981fc25c6140d2a1a. Amplía fixture efímero PostgreSQL 16 con MFA, recuperación de uso único, intentos fallidos y las políticas RLS específicas del rol autenticador.
- Funciones SECURITY DEFINER no privilegiadas y con SET search_path fijo; acceso privado sólo por columna y rol `domi_auth_lookup` dedicado, sin SELECT directo a tablas ni permiso desde `domi_pilot_app`.
- 8 nuevos casos adversariales: acceso prohibido a tablas, acceso prohibido al runtime, lectura MFA acotada, consumo único de código de recuperación, rechazo código incorrecto, conteo de fallos con ventana, limpieza selectiva y prevención de escalamiento de escrituras.
- 34 pruebas sintéticas definidas. Resultado **PENDING** en el nuevo commit hasta CI real.
- `pg_auth_bootstrap.py` amplía funciones de servidor, sin conectar todavía login público FastAPI. No se altera el esquema ni seguridad de Neon.

## Riesgos y límites
- El flujo FastAPI existente contiene login, invitación, MFA, recuperación, verificación y registro de auditoría; aún lee tablas privadas mediante la conexión normal PostgreSQL. No funciona seguro bajo rol RLS restringido hasta portarlo a API bootstrap, controlar transacciones, auditoría y emisión JWT/sesiones.
- En el piloto, la función lookup MFA devuelve secreto cifrado al servidor autenticador de confianza. No exponerla al cliente, ni registrar secretos. Limitar conexión y secretos en runtime.
- Pruebas R16 verifican PostgreSQL sintético y no certifican RLS en las 57 tablas reales.
- La prueba de 34 casos requiere nueva ejecución CI; no declarar PASS por implementación.
- Prohibido modificar rama Neon main, producción, fusionar PR, o desplegar Railway sin gates y autorización expresa de gastos.

## Roadmap
1. Certificar Security Gate R16 y 34 pruebas; corregir cualquier falla.
2. Diseñar y probar emisión de sesión y registro auditado por función específica, manteniendo rate limiting, anti-enumeración, MFA y controles de privacidad.
3. Integrar en FastAPI en modo aislado/fail-closed con pruebas completas y rollback.
4. Ensayar migración RLS sobre rama aislada Neon y datos sintéticos para 57 tablas; sólo después staging físico computador–teléfono y comercialización.

## Cápsula de rehidratación
`DOMI_R16_MFA_RECOVERY_THROTTLE_PILOT_20261011`: R15 CI #176 PASS 26/26, R16 34-case PostgreSQL CI pilot implementado commit be5c14c2da8e3bc344f27f6981fc25c6140d2a1a, pending. Neon 0/57 RLS, Railway 124 STAGED. No producción.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R16_MFA_RECOVERY_THROTTLE_PILOT_20261011 en majofreasenjo-jpg/Vantdomus PR #2. Verifica el GitHub Actions más reciente y exige backend/web/mobile SUCCESS y postgres-rls-pilot 34 PASS, sin skips. Repara fallos genuinos sin debilitar seguridad. Luego incorpora emisión de sesiones JWT y almacenamiento de auth_sessions mediante SQL de privilegios mínimos, dejando conectado el flujo de login real con MFA, rate limit, recuperación y auditoría, sin contraseñas ni secretos expuestos. Ejecutar primeramente pruebas PostgreSQL sintéticas y después Neon validación; jamás Neon main. Mantener PR draft, Railway staged sin deploy y bitácora append-only, cápsula y Exact Prompt Restart.
