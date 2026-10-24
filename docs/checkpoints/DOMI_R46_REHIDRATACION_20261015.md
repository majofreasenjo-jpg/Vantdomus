# DOMI R46 — checkpoint, cápsula y Exact Prompt Restart
Fecha: 2026-10-15. Rama: domi-neon-staging-pg-startup-gate-20261010. PR #2 (draft, no merge).

## Evidencia y avance
- Security Gate #245, run_id 38654022042: backend FAIL, web PASS, mobile PASS, postgres-rls-pilot PASS; staging-smoke SKIPPED.
- Backend suite: 351 PASS, 1 FAIL, 101 SKIPPED. Fallo único en tests/security/test_domi_pg_startup_gate.py::test_pg_gate_signed_mode_accepts_real_signed_auth_without_legacy_helper.
- Causa: assertion obsoleta buscaba cadena domi_r31.subject_id() en la consulta; desde R45 la verificación usa pg_proc + pg_namespace + pg_roles sin to_regprocedure sobre esquema privado.
- R46 código: commit 691a20445ce397e3d5d915cc4a93bb5c16638aa0, únicamente prueba de contrato; mantiene checks sobre n.nspname, p.proname, p.pronargs, SECURITY DEFINER, propietario, EXECUTE y ausencia de lookup restringido.
- Nuevo Security Gate: pendiente de observación/resultado, NO declarar PASS anticipadamente.

## Neon comprobado, lectura solamente
- Proyecto solitary-dawn-70172559, rama de validación br-broad-poetry-aksbxhbf, NO principal.
- 57 tablas public, 0 RLS, 0 FORCE RLS; solo rol neondb_owner en roles API.
- No se realizaron cambios de esquema, permisos, roles, migraciones ni despliegues.

## Riesgos y órdenes de prioridad
1. Confirmar CI del commit R46 e investigar cualquier falla real.
2. Auditar migraciones declarativas R31, firmas HMAC, política de aislamiento para 57 tablas, identidad SET LOCAL/SET ROLE, rol LOGIN mínimo, GRANT/REVOKE, search_path del SECURITY DEFINER.
3. Preparar plan transaccional con rollback y pruebas adversariales; aplicar SOLO a validación identificada cuando se permita explícitamente, nunca a main.
4. Comprobar no lectura cruzada hogar/organización, reutilización de sesión, expiración/revocación, memoria entre sesiones y consentimiento externo a LLM.
5. Staging real y pruebas físicas PC-teléfono, siempre antes de habilitar datos personales.
6. Railway sin despliegue ni gasto nuevo. PR sigue draft.

## Cápsula de Rehidratación
STATUS=R46_CODE_FIX_COMMITTED_CI_UNVERIFIED
REPO=majofreasenjo-jpg/Vantdomus
BRANCH=domi-neon-staging-pg-startup-gate-20261010
PR=2
LAST_IMPLEMENTATION_COMMIT=691a20445ce397e3d5d915cc4a93bb5c16638aa0
NEON_VALIDATION_PROJECT=solitary-dawn-70172559
NEON_VALIDATION_BRANCH=br-broad-poetry-aksbxhbf
NEON_RLS=0/57
NEON_FORCE_RLS=0/57
STAGING_WITH_PERSONAL_DATA=BLOCKED
RAILWAY_DEPLOYMENT=NOT_AUTHORIZED
PRODUCTION_CHANGES=NONE

## Exact Prompt Restart
"Retoma DOMI VantDomus desde el checkpoint R46 (2026-10-15) en PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Primero verifica Security Gate del commit 691a20445ce397e3d5d915cc4a93bb5c16638aa0; no declares PASS sin resultado. Luego audita exhaustivamente la preparación de Neon aislado (solitary-dawn-70172559 / br-broad-poetry-aksbxhbf) para 57 tablas RLS y FORCE RLS, roles restringidos y firma de identidad, con barreras fail-closed y pruebas de dos hogares. Avanza hacia una beta personal con persistencia y PC-teléfono, sin cambios en Neon main, sin despliegue Railway, gastos ni datos personales, sin fusionar el PR; mantiene bitácora append-only y entrega al cierre cápsula y reinicio exacto."
