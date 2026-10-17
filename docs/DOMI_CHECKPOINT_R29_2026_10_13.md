# DOMI R29 — reparación sintaxis PostgreSQL HMAC · 2026-10-13

Predecesor append-only: DOMI_CHECKPOINT_R28_2026_10_12.md.

## Evidencia observada
- Security Gate #204, run 38339377826: FAILURE. Backend/web/mobile SUCCESS, PostgreSQL piloto ERROR al inicializar fixture, por SQLSTATE sintaxis cerca de FROM en `pg_catalog.extract(epoch FROM ...)`.
- No hubo resultados válidos de 62 pruebas PostgreSQL porque el fixture no pudo inicializarse. No confundir con 62 tests reprobados.
- Última certificación íntegra: R27, Security Gate #202, 53/53 PostgreSQL PASS, web audit 0.
- GitHub PR #2 DRAFT, sin merge. Neon main y validación intactos; Railway sin desplegar.

## Corrección R29 efectivamente aplicada
- Commit `3a75ab06150ee219f4488a5c4dbfb44f93a37aad` únicamente cambia `tests/security/sql/domi_auth_hmac_pilot_v1.sql`.
- Sustituye la expresión SQL inválida `pg_catalog.extract(epoch FROM pg_catalog.clock_timestamp())` por `pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())`, conservando la ventana temporal y las obligaciones HMAC.
- Security Gate #205, run `38343381149`, estaba QUEUED cuando se verificó. No se declara PASS.
- La implementación R28 sigue limitada a fixture sintético; no se instala en Neon real.

## Próximos controles
1. Inspeccionar Security Gate #205; exigir 62/62 PostgreSQL, backend/web/mobile PASS, audit web cero; corregir cualquier fallo adicional sin debilitar HMAC ni RLS.
2. Completar pruebas de firmas / concurrencia y rotación del secreto independiente.
3. Diseñar políticas RLS para 57 tablas según esquema real en Neon rama aislada; migraciones versionadas con pruebas negativas.
4. Auth personal, memoria entre sesiones y continuidad PC/teléfono solo tras staging autorizado y pruebas físicas.

## Cápsula de rehidratación
DOMI_R29_POSTGRES_EPOCH_FIX_20261013 | R28 CI #204 FAIL fixture SQL `EXTRACT`; R29 commit 3a75ab06 cambia a date_part válido. Nueva CI #205 QUEUED. Neon RLS 0/57, Railway no desplegado, Owner Beta real no disponible.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R29_POSTGRES_EPOCH_FIX_20261013, PR #2 de majofreasenjo-jpg/Vantdomus rama domi-neon-staging-pg-startup-gate-20261010. Verifica GitHub Security Gate #205 (run 38343381149): 62/62 tests PostgreSQL PASS, backend/web/mobile PASS, audit web 0. Corrige errores auténticos sin suprimir casos ni tocar permisos. Posteriormente completa HMAC proof con auditoría y competencia/concurrencia y prepara RLS específico para 57 tablas Neon validación, nunca main. No desplegar Railway ni fusionar PR sin aprobación. Bitácora, cápsula y reinicio append-only obligatorios.
