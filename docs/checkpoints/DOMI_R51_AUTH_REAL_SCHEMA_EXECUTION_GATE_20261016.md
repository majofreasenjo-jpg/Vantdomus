# DOMI R51 — ejecución SQL R50 sobre PostgreSQL desechable, no Neon

Fecha: 2026-10-16. PR #2: DRAFT, no merge.

## Objetivo de cierre
R50 entregó 303_domi_r50_real_auth_up.sql pero solo como migración candidata, sin prueba de ejecución real. R51 convierte su ejecución en un gate de CI obligatorio, después de la creación del esquema public de 57 tablas y R31/R33. No inferir beta personal terminada a partir de ello.

## Nueva evidencia/código
- Security Gate #259 del commit de R50 estaba PENDING en el primer barrido; no declararlo SUCCESS sin comprobar de nuevo.
- 304_domi_r51_auth_fail_closed_disable.sql, commit 5221c6876be05be7b4723a5d6807f47c7fa51e85. Desactiva LOGIN, EXECUTE y USAGE sobre funciones del esquema de autenticación sin perder FORCE RLS ni borrar datos.
- tests/security/test_domi_r50_real_auth_sql.py, commit abbb76bb541ad90f6c01744a34f843671fcbcf94. Ejecución offline de 303, validación de 9 funciones, roles NOLOGIN, grants divididos, ausencia de secreto HMAC, prohibición de emitir sesión sin proof, gate de firmas real mediante cambios transaccionales de atributos y reversión/rollback.
- Security Gate modificado: commit 3eef15285dc2a3c8a349ccea98f9a2b91968954a. Paso nuevo R51 DESPUÉS de test_domi_r31_real_schema_rls.py, sobre el MISMO servicio PostgreSQL efímero de GitHub. Nunca Neon.

## Límite de validación
- El test todavía no ha sido confirmado PASS contra CI tras estos commits.
- La suite no prueba todavía una sesión HMAC positiva de extremo a extremo con los tres roles autenticados: necesita más casos y una migración inicial de roles con secret provisioning fuera de Git.
- Se necesita prueba de reversión de las funciones con conexiones separadas y tests de alto nivel de registro/logout/reset y dispositivo real.
- No se tocó Neon main ni rama de validación, no hubo deploy Railway, gasto o datos personales.
- Para aplicar a la rama Neon aislada se necesita autorización explícita posterior y preflight con observabilidad y rollback; never main.

## Cápsula de rehidratación
DOMI_R51=REAL_SCHEMA_AUTH_SQL_CI_ADDED_PENDING
PR=2_DRAFT
SQL_UP=303_domi_r50_real_auth_up.sql
SQL_DISABLE=304_domi_r51_auth_fail_closed_disable.sql
CI_COMMIT=3eef15285dc2a3c8a349ccea98f9a2b91968954a
NEON_VALIDATION=57_PUBLIC_TABLES_0_RLS
NEON_WRITES=NONE
RAILWAY_DEPLOY=NONE
PERSONAL_BETA=BLOCKED

## Exact Prompt Restart
Retoma DOMI VANTDOMUS desde R51 checkpoint DOMI_R51_AUTH_REAL_SCHEMA_EXECUTION_GATE_20261016.md de GitHub majofreasenjo-jpg/Vantdomus, PR #2 borrador, rama domi-neon-staging-pg-startup-gate-20261010. Verifica Security Gate del commit que incorpora 304 R51 disable, test_domi_r50_real_auth_sql.py y modificación en workflow, interpretando logs reales del paso R51. Corrige directamente si falla sin debilitar seguridad. Ejecuta falsificación positiva y negativa de HMAC/multirrol y reversibilidad en CI sintético. No ejecutar nada en Neon, no fusionar, no desplegar Railway ni habilitar usuarios personales sin gates completos y aprobación posterior. Cierra con checkpoint append-only, cápsula y exact prompt restart.
