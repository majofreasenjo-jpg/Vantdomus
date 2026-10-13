# DOMI R34 — Corrección R33 SQL de identidad transaccional (2026-10-13)

Documento append-only. Predecesor: DOMI_CHECKPOINT_R33_2026_10_13.md.

## Diagnóstico verificable
- Security Gate #217, ejecución 38476246357: backend/web/mobile SUCCESS; job PostgreSQL FAIL.
- Autenticación PostgreSQL anterior conservó sus 62 tests PASS; suite RLS endurecida R33: 1/16 PASS, 15 fallas originadas durante verificación de sujeto.
- Stack trace: psycopg2.errors.UndefinedFunction, `function pg_catalog.nullif(text, unknown) does not exist`, en `domi_r31.subject_id()`. No concluir que los 15 controles fueron falsificados: se bloquearon por SQL inválido.
- PR #2 DRAFT; Neon validación y main no modificados, sin despliegue Railway.

## Implementación R34
- Commit a77efc7e3e08ebad373c007b29ff5c3130a5553f.
- Cinco expresiones `pg_catalog.nullif(...)` corregidas a forma SQL `NULLIF(...)` en la migración R33 301.
- Se conservan los 16 casos adversariales, todas las políticas, roles y HMAC; no se relajaron controles.
- Nueva CI R34 pendiente de certificación. Si continúa fallando, inspeccionar el *primer error causal* y reparar con evidencia.

## Riesgos pendientes y condiciones de release
- R33 ainda no implementa en PgSessionContext la llamada vinculada JWT→HMAC; el helper pg_rls_context.py existe pero no está conectado en backend autenticado. No permitir Owner Beta real.
- R33 rollback fail-closed separado pendiente.
- Neon reales: 57 tablas, 0 RLS en última inspección; no migraciones aplicadas.
- La superficie de escritura de memoria y consentimiento debe validarse con 16/16 y nuevas pruebas de sesión SQL; solo fixture desechable.

## Cápsula de rehidratación
DOMI_R34_POSTGRES_NULLIF_FIX_20261013 | Security Gate #217 FAIL PG RLS 1/16 por cinco `pg_catalog.nullif`; commit a77efc7e corrige expresiones; CI nuevo pendiente. Backend/web/mobile PASS. Neon sin RLS real, Railway sin desplegar. Personal memory NO LIVE.

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde DOMI_R34_POSTGRES_NULLIF_FIX_20261013, GitHub PR #2 rama domi-neon-staging-pg-startup-gate-20261010, implementación a77efc7e3e08ebad373c007b29ff5c3130a5553f. Verificar próximo Security Gate con backend/web/mobile PASS, auth 62/62 y RLS 16/16. Si falla, corregir error causal sin eliminar controles. Después integrar JWT→PgSessionContext→HMAC transaccional, rollback fail-closed, y verificar en PostgreSQL disposable antes de cualquier migración Neon. No tocar Neon main, no desplegar Railway ni fusionar PR; mantener bitácora/cápsula/restart append-only.
