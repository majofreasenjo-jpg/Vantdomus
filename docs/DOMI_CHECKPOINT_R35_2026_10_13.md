# DOMI R35 — pruebas RLS con identidad SQL no privilegiada · 2026-10-13

## Evidencia observada
- Security Gate #219, run 38482091943: backend, web y móvil SUCCESS. PostgreSQL autenticación 62/62 PASS; RLS R33: **12/16 PASS, 4 FAIL**.
- Fallas causales diferenciadas: (1) test de caducidad/borrado deja fixture con `deleted_at` y contamina pruebas positivas posteriores; (2) el arnés simula runtime con sesión PostgreSQL `postgres` superusuario y `SET ROLE`, por lo que no es válida su prueba de escalada negativa; (3) rollback revoca la función firmante como está diseñado, pero un test intentaba invocarla al preparar contexto.
- No implican aprobación del protocolo. R33 no está certificado.
- PR #2 DRAFT, no merge. Neon real 0/57 RLS en última comprobación; Railway sin desplegar.

## Implementación R35
- Commit `8a932bf7c35ddf5fced9a74a10227414b0be6bed`: cambia exclusivamente `tests/security/test_domi_r31_real_schema_rls.py`.
- Crea `domi_r31_ci_client` como LOGIN de CI sin superuser/BYPASS/CREATEROLE/CREATEDB, contraseña efímera aleatoria. La prueba de runtime se conecta como este usuario y pasa temporalmente al rol limitado `domi_app_runtime`; nunca se opera como superusuario mientras se comprueban denegaciones.
- `test_expiry_and_soft_delete_fail_closed` restaura datos sintéticos en `finally` tras comprobar sus condiciones negativas.
- La reversión fail-closed se verifica intentando invocar la función firmante revocada y una lectura de memoria denegada desde el rol limitado, sin suponer que el helper continúe operativo.
- Añadida una prueba de separación efectiva entre `session_user` / `current_user` y rechazo de ascenso al rol de la función protegida. Suite RLS ahora **17 pruebas definidas** (previas 16).
- Security Gate R35 run `38488326092` estaba QUEUED al verificar. No atribuir PASS hasta leer sus logs.

## Obligaciones no cerradas
- RLS real NO aplicada en Neon. Las migraciones son candidatas offline, no habilitar memoria personal.
- Integración del contexto HMAC con JWT y wrapper real sigue pendiente; prueba superusuario del fixture no equivale a un control en el backend.
- Falta rollback específico 301 en CI y validación del aislamiento con usuario sin acceso SQL arbitrario.
- Mantener seguridad de menores y consentimiento, revocación/recuperación e integración física PC-teléfono.
- Sin deploy Railway, sin cambios Neon main/validación y sin costos autorizados.

## Cápsula de rehidratación
DOMI_R35_UNPRIVILEGED_RLS_FIXTURE_20261013 | #219 auth 62/62 PASS, RLS 12/16 FAIL cuatro casos. Commit 8a932bf7 introduce verdadero LOGIN no privilegiado, restaura fixture y prueba rollback fail-closed; 17 pruebas RLS definidas, nueva CI por verificar. Neon 0/57, Railway no desplegado.

## Exact Prompt Restart
Retoma VANTDOMUS DOMI desde DOMI_R35_UNPRIVILEGED_RLS_FIXTURE_20261013, GitHub PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Comprueba Security Gate run 38488326092 o el run del siguiente checkpoint; exige backend/web/mobile PASS, 62 pruebas PostgreSQL auth PASS, 17 RLS PASS y auditoría web cero. Diagnosticar y corregir el primer error causal sin desactivar controles. Después preparar rollback 301 fail-closed y conectar JWT→PgSessionContext→HMAC en backend existente, con pruebas de transacción y revocación, antes de considerar Neon validación. No aplicar a Neon main ni desplegar Railway sin autorización explícita. Registrar bitácora, cápsula y Exact Prompt Restart append-only.
