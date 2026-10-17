# DOMI R26 — Cierre Security Gate R25 y preflight de login PostgreSQL · 2026-10-12

Predecesor append-only: DOMI_CHECKPOINT_R25_2026_10_12.md.

## Evidencia comprobada
- Security Gate #198, ejecución 38322566990: SUCCESS. Backend, web, móvil y PostgreSQL PASS; **46 passed, 2 warnings**. Auditoría web `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades.
- PR #2 sigue en borrador; no fusionado.
- Inspección de solo lectura Neon `solitary-dawn-70172559`, rama de validación `br-broad-poetry-aksbxhbf`: **57 tablas públicas, 0 RLS, 0 policies**.
- El esquema auténtico almacena `auth_sessions.{created_at,expires_at,revoked_at,last_seen_at}` como TEXT, `users.is_active` como INTEGER, y `memory_items` tiene campos de consentimiento/visibilidad; no coincide con fixture sintético.

## Cambio R26
- Commit `5d7c46b8138001f6c0ff3388df97b7ea3685e105`: El endpoint FastAPI de login PostgreSQL opt-in ahora rechaza si el cuerpo JSON falta **o si se suministra cualquier credencial en parámetros de URL**, antes de resolverlos; previene uso accidental de secretos en historial/proxy/logs. SQLite legacy preservado.
- Este nuevo cambio **no cuenta como PASS CI** hasta la siguiente ejecución.
- El doble rol `domi_auth_lookup` y `domi_auth_session_issuer` ya pasó 46 pruebas en fixture. Aún queda vincular emisión de sesiones a prueba de identidad no reutilizable y revisar token/JTI, MFA, errores y auditoría de seguridad.
- No se modificó Neon; no se desplegó Railway ni se generaron costos deliberados.

## Puertas pendientes para Owner Beta real
1. Certificar CI de R26. No confundir pruebas sintéticas con funcionamiento en Neon real.
2. Diseñar y verificar protocolo de prueba efímera autenticada entre verificación y emisor sin permitir que el emisor cree sesiones arbitrarias.
3. Implementar las políticas RLS y migraciones versionadas para el esquema **real** sobre rama Neon aislada y ejecutar pruebas negativas de acceso cruzado.
4. Completar MFA, recuperación, invitaciones, revocación, event ledger y control de consentimiento; después staging backend autorizado y memoria real E2E y continuidad PC-teléfono.

## Cápsula de rehidratación
DOMI_R26_LOGIN_QUERY_DENIAL_20261012 — R25 CI #198 completo 46/46 PASS y 0 vulnerabilidades web. Commit R26 fortalece JSON-only y rechaza secretos URL para PostgreSQL; nueva CI pendiente. Neon 57 tablas sin RLS. Railway sin desplegar, Owner Beta real no lista.

## Exact Prompt Restart
Retoma VANTDOMUS DOMI en PR #2, rama domi-neon-staging-pg-startup-gate-20261010 desde DOMI_R26_LOGIN_QUERY_DENIAL_20261012. Primero verifica CI más reciente del commit y exige 46/46 PostgreSQL PASS, web/backend/mobile PASS y 0 vulnerabilidades. Revisa login JSON-only con pruebas positivas y negativas de credenciales en query string, y autorización de emisor de sesiones ligada a prueba de identidad efímera; nunca habilites auth en Neon real antes de RLS. La rama Neon validación tiene 57 tablas sin RLS, fechas TEXT: requiere migraciones y pruebas específicas, no copiar fixture. No tocar Neon main, no fusionar PR, no desplegar Railway sin aprobación explícita. Mantener bitácora append-only, cápsula y Exact Prompt Restart.