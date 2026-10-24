# DOMI R48 — auditoría adversarial del gate de autenticación · 2026-10-15

## Continuidad
Predecesor: docs/checkpoints/DOMI_R47_REAL_AUTH_READINESS_20261015.md. PR #2 DRAFT.

## Evidencia verificada
GitHub Security Gate #251, run 38741096585, completado SUCCESS: backend/web/mobile/postgres-rls-pilot PASS y staging-smoke SKIPPED. Este gate certificó la implementación R47, no un despliegue en Neon.
Neon validación (solitary-dawn-70172559 / br-broad-poetry-aksbxhbf): 57 tablas public, RLS 0/57, FORCE RLS 0/57, sin cambio alguno.

## Falsificación R47 y correcciones R48
R47 solo cotejaba nombres/aridad de funciones; podía omitir firma de argumentos, retorno, overloads extra, search_path y EXECUTE vía PUBLIC. Los roles NOINHERIT podían ser miembros de otros roles con capacidad SET ROLE; los grants por columna no quedan cubiertos al mirar solo has_table_privilege.
R48 introduce:
- rechazar membresía en cualquier otro rol de las dos identidades de autenticación;
- rechazar privilegios efectivos en tablas o columnas de public/domi_auth/domi_r31;
- comparar oidvectortypes de argumentos y tipo de retorno y proretset, sin argumentos con default;
- rechazar funciones no SECURITY DEFINER, propietarios privilegiados, lenguajes fuera de SQL/PLpgSQL, search_path no fijado, permiso al runtime o al otro rol, y EXECUTE otorgado a PUBLIC;
- rechazar funciones adicionales o sobrecargas accesibles a roles de autenticación.
- pruebas unitarias positivas/negativas, incluidas membresía y función extra.

Código: commit bda7b67aa00a60dc0d1732c53e6b05d48600493a.
Pruebas: commit 87bfa015375f86ab96ee8e9211bb641ada9dbfbb.

## Limitaciones y próximos gates
Las pruebas de contrato inspeccionan SQL, pero se exige validación ejecutando las consultas contra PostgreSQL desechable con roles y funciones reales antes de aprobar R48.
Comprobar firmas exactas y proconfig; identificar posibles privilegios de objetos PUBLIC por defecto y fallas inesperadas.
Completar migaciones del esquema de autenticación real y casos HTTP PC/teléfono. Ningún dato personal ni servidor externo.
Neon main y validación NO modificados; Railway no desplegado; PR draft.

## Cápsula de rehidratación
DOMI_R48=AUTH_GATE_HARDENED_CI_NOT_YET_VERIFIED
R47_SECURITY_GATE_251=PASS
R48_GATE_COMMIT=bda7b67aa00a60dc0d1732c53e6b05d48600493a
R48_TEST_COMMIT=87bfa015375f86ab96ee8e9211bb641ada9dbfbb
NEON_VALIDATION=57_TABLES_0_RLS_0_FORCE
OWNER_BETA_REAL=BLOCKED
PRODUCTION_WRITE=NONE

## Exact Prompt Restart
"Retoma DOMI desde checkpoint R48 AUTH_CATALOG_FALSIFICATION de 2026-10-15, repositorio majofreasenjo-jpg/Vantdomus, PR #2 draft en rama domi-neon-staging-pg-startup-gate-20261010. Primero verifica Security Gate del último commit; diagnostica y corrige sin debilitar políticas. Valida el nuevo gate pg_auth_readiness.py de R48 con ejecución PostgreSQL desechable, en especial tipos exactos, proretset, proconfig, acl PUBLIC, roles miembros y grants columna. Después desarrolla migración versión real de autenticación para las 57 tablas, previa validación sintética y aprobación específica para Neon aislado; nunca main ni Railway. Mantén bitácora append-only y nuevas cápsulas + Exact Prompt Restart."
