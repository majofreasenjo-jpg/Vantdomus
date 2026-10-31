# DOMI R32 — gate CI aislado para RLS 57 tablas — 2026-10-13

## Evidencia
- Security Gate #213, run 38446222430: FAILURE global. PostgreSQL job SUCCESS (62/62 auth + 9/9 R31), web SUCCESS, mobile SUCCESS. Backend falló porque su suite general ejecutaba 9 pruebas R31 sin DSN sintético y el preflight las rechazó.
- Ninguna prueba R31 falló dentro de PostgreSQL desechable; el error era únicamente en asignación de suite.
- R31 continúa solo en código GitHub; Neon validación y producción NO modificados. En último preflight real, 57 tablas, 0 políticas, propietario neondb_owner con BYPASSRLS.

## Código R32
- Commit fc20f452047ddbedbd8ef19ebc3de0eaeddbec48, `tests/security/test_domi_r31_real_schema_rls.py`.
- Solo se omiten nueve pruebas en entorno sin `DOMI_RLS_TEST_DSN` cuando `DOMI_RLS_REQUIRE_LIVE` no está exigido. Si `DOMI_RLS_REQUIRE_LIVE=1` y DSN ausente, fallo explícito. La suite PostgreSQL de CI sigue requiriendo ejecución obligatoria de 62+9 tests.
- Prohibida la conexión remota: la función checked() conserva verificación 127.0.0.1/localhost y /domi_rls_ci.

## LIMITACIONES DE SEGURIDAD NO CERRADAS
- GUC DOMI sujeto/JTI es configurable desde conexiones SQL; el rol runtime no debe tener una interfaz de SQL arbitrario; verificar JWT vinculado en API y evitar impersonación como requisito previo a datos reales.
- R31 concede UPDATE directo sobre memoria personal y debe revisarse protección de campos de autoridad/consentimiento (no confiar solo en RLS, pues permite modificar otras columnas si el nuevo registro cumple WITH CHECK). Pendiente migración por columnas/funciones más restrictivas.
- R31 no es autorización para ejecutar política en Neon validación todavía: hay revisión de amenazas y flujos pendientes.
- No Railway, no main, no PR merge.

## Cápsula
DOMI_R32_RLS_CI_SUITE_ROUTING_20261013 | #213 PG 62/62 + R31 9/9 PASS; backend failed incorrect fixture routing; R32 isolates suite and keeps required PG live gate. CI nuevo pendiente. Neon 0/57 RLS, Railway undeployed.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R32_RLS_CI_SUITE_ROUTING_20261013 GitHub PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Verifica Security Gate siguiente al commit fc20f452047ddbedbd8ef19ebc3de0eaeddbec48 y exige backend/web/mobile PASS, PostgreSQL 62+9 PASS. No deshabilitar el job PG obligatorio. Después endurecer el modelo de identidad: GUCs sujetos/JTI son falsificables desde SQL, cerrar la superficie de consultas y las columnas editables de memoria. Solo tras certificación, preparar aplicación en Neon validación con cambio autorizado, sin tocar main. Añadir checkpoint/cápsula/restart append-only.
