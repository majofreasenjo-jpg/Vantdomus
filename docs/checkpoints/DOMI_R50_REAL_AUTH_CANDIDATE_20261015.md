# DOMI R50 — migración candidata de autenticación real, SOLO OFFLINE

## Estado comprobado
- Security Gate R49 #257 (run 38823655917): SUCCESS. 9/9 pruebas R49 live PostgreSQL, 62/62 piloto auth, 39/39 R31 RLS, backend/web/mobile PASS; staging-smoke SKIPPED.
- Neon de validación solitary-dawn-70172559 / br-broad-poetry-aksbxhbf se inspeccionó solo por lectura: 57 tablas public, RLS 0/57, FORCE 0/57.
- Esquema auténtico de auth: created_at / expires_at TEXT, is_active / is_enabled / success INTEGER. Índices reales enumerados. No convertir pruebas del piloto a producción sin adaptación.

## Entregable R50
- apps/api/postgres_staging_migrations/security/303_domi_r50_real_auth_up.sql, commit 0c2450eff84a7c713a6b07bd7ce1bffcd736abba.
- **CANDIDATO NO EJECUTADO NI CERTIFICADO**: contempla preflight 57 RLS/FORCE y tipos, separación de roles, nueve funciones de autenticación firmada, MFA, bloqueo de login, emisión una sola vez, controles y grants restrictivos, metadata y rollback por denegación.
- No contiene secretos ni activa usuarios reales; ambos roles SQL de auth quedan NOLOGIN.
- Debe probarse sobre PostgreSQL desechable, compararse con pg_auth_readiness.py R48 y someterse a pruebas adversariales de sesión, MFA, permisos, PUBLIC y reversión antes de autorizar cualquier cambio Neon.
- R31+R33 deben existir antes de ejecutar la migración candidata.
- No se realizó escritura alguna en Neon ni despliegue Railway. PR #2 sigue DRAFT; beta real bloqueada.

## Riesgos activos (no cerrar)
- Falta prueba de ejecución y reversión de SQL 303. Revisar tipos de retorno, esquema de cifrado, propiedad, roles, acceso por columna, predicados RLS, expiración y atomicidad.
- Falta aprobación explícita y específica para la rama de Neon aislada; nunca main.
- Falta alta/recovery/logout JWT/MFA real, test físico PC-teléfono y política de gastos.

## Cápsula de Rehidratación
DOMI_STATUS=R50_REAL_AUTH_SQL_CANDIDATE_UNTESTED
R49_SECURITY_GATE_257=SUCCESS
R50_COMMIT=0c2450eff84a7c713a6b07bd7ce1bffcd736abba
NEON_VALIDATION_RLS=0/57
NEON_WRITES=NONE
RAILWAY=NOT_DEPLOYED
OWNER_BETA=BLOCKED

## Exact Prompt Restart
Retoma DOMI VANTDOMUS desde R50, commit 0c2450eff84a7c713a6b07bd7ce1bffcd736abba y checkpoint DOMI_R50_REAL_AUTH_CANDIDATE_20261015.md, GitHub majofreasenjo-jpg/Vantdomus PR #2 draft rama domi-neon-staging-pg-startup-gate-20261010. Ejecuta y falsifica 303_domi_r50_real_auth_up.sql exclusivamente en base PostgreSQL local desechable, luego completa rollback seguro y verifica el gate pg_auth_readiness.py. Corrige defectos sin simplificar las barreras; CI y aplicación real se certifican por separado. NO ejecutar migración en Neon sin autorización explícita de rama aislada, ni modificar main, ni desplegar Railway, ni incurrir en gastos. Mantén documentos append-only, cápsula y exact prompt restart.
