# DOMI R64 — R63 test separation from R36 fail-closed rollback
Fecha: 2026-10-18. PR #2 DRAFT. Bitácora append-only.

## Hallazgo reproducido
Security Gate #305 (run 39141555613): postgres-real-auth-candidate FAILED paso R63, 3 PASS 1 FAIL. Tras ejecutar el archivo R31, su test terminal R36 revocó SELECT de household_memberships, así que evaluar SELECT assistant_proposals con una subconsulta directa contra esa tabla provocó psycopg2.errors.InsufficientPrivilege. Esta denegación es SEGURA, pero el R63 candidato no puede restaurar silenciosamente permisos cerrados por R36. CI #305 aún estaba en progreso durante diagnóstico; no declararlo PASS.

## Rectificaciones
- 305_domi_r63_reminder_pilot_rls_up.sql, commit 1ce2ef61a317fc97076f9eee60cdfdd319bcecf3, incorpora preflight: exige grants SELECT households/household_memberships, USAGE de esquema firmado, EXECUTE verificadores y secret 'active', y la política memberships_self; tras R36 fail-closed da R63_BASE_PREREQUISITE_CLOSED antes de GRANT.
- tests/security/test_domi_r63_readonly_pilot_sql.py commit e2d8445988f8d99144e28046fd515cf73c1ea4a8: sin signed session, SELECT que devuelve 0 o InsufficientPrivilege es fallo cerrado; no se convierte en éxito funcional para lector autenticado.
- Nuevo tests/security/test_domi_r64_post_rollback_denial.py commit 32b6c89c1d322ec6d6d6cdbddcab868539ac3dad: al finalizar R36 garantiza que 305 aborta y runtime mantiene 0 derechos SELECT/INSERT/UPDATE/DELETE sobre ambas tablas.
- Workflow commit 4d33726377146bd26f94c8b52575328574549ffd separa:
  * postgres-real-auth-candidate: R31 suite completa con R36 terminal; R64 negativo post-rollback (en vez de R63 lectura) y R50;
  * postgres-r64-readable-pilot: CLUSTER PostgreSQL CI nuevo separado; R31/R33 completos EXCEPTO R36 terminal; candidato R63 SELECT-only en transacción, rollback al final; NO redes externas ni Neon.
- R64 CI por verificar; aún no constituye prueba positiva de lectura firmada (requiere preparar signed context en mismo proceso), ni acredita permiso de escribir/confirmar.

## Riesgo y objetivo terminal
La autorización semántica independiente en base para confirmar recordatorios sigue pendiente. Sin consentimiento DB fiable, no conceder UPDATE proposal.status ni INSERT family_reminders al runtime aunque tenga membresía. Recordatorios de SQLite quedan certificados, no beta con Neon.

## Cápsula
DOMI_R64=R63_ISOLATED_READ_PILOT_SPLIT_COMMITTED_CI_UNVERIFIED
R63_GATE_305=FAIL_POST_ROLLBACK_MEMBERSHIPS_DENIAL
R64_CI_SHA=4d33726377146bd26f94c8b52575328574549ffd
NEON_WRITES=NONE
RENDER_CHANGES=NONE
ANTHROPIC_API_CALLS=NONE
PR_2=DRAFT
PERSONAL_BETA=BLOCKED

## Exact Prompt Restart
Retoma VANTDOMUS DOMI PR #2 draft rama domi-neon-staging-pg-startup-gate-20261010 desde R64. Consultar GitHub Actions Security Gate último commit en especial jobs postgres-r64-readable-pilot y postgres-real-auth-candidate. R63 original falló debido a haber corrido después de R36 rollback, no abrir permisos para arreglarlo. Se separaron dos clústeres desechables: uno certifica el bloqueo R36 e imposibilidad de reapertura R63, otro base R31/R33 activa y R63 SOLO SELECT. Corregir CI con logs. Próxima meta: probar lecturas R63 bajo login restringido, firma R33 correcta en transacción, dos hogares; encontrar y cerrar HCO de autorización humana verificable para escrituras, sin concesiones generales. No Neon, Render, Railway, producción, créditos ni datos reales. Preservar checkpoint append-only.
