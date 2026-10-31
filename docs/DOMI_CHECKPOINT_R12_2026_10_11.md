# VANTDOMUS/DOMI — bitácora append-only R12 · 2026-10-11

Predecesor: `DOMI_CHECKPOINT_R11_2026_10_11.md`. No reemplazar ninguna cápsula anterior.

## Evidencia verificada antes de este commit
- Security Gate GitHub #170, run **38158633429**: conclusión **SUCCESS**. Trabajos backend, web, mobile y postgres-rls-pilot SUCCESS; staging-smoke SKIPPED deliberadamente por ser PR.
- PostgreSQL R11: **18 passed in 0.37s** en base sintética efímera, con login directo restringido y funciones SECURITY DEFINER de propietario no privilegiado.
- Rama PR #2: `domi-neon-staging-pg-startup-gate-20261010` permanece DRAFT y no fusionada.
- Neon validación `br-broad-poetry-aksbxhbf`: 57 tablas ordinarias; última evidencia 0 políticas RLS/57 y cero políticas. No modificada en R12.
- Railway: último checkpoint 124 cambios STAGED, no deployment. No ejecutar gasto ni cambiar producción.

## Tres defectos/lagunas de seguridad R11 identificados
1. La reautenticación sobre una misma conexión con claims vacíos retornaba FALSE sin limpiar forzosamente el `SET LOCAL` de la transacción anterior ni revertir sus escrituras.
2. El gate rechazaba atributos directos privilegiados, pero no membresía transitiva del login de aplicación en roles privilegiados/propietarios que podrían conceder SET ROLE o herencia de privilegios.
3. El gate computaba `force_rls_count` pero nunca lo comparaba contra el total de tablas; una tabla sin `FORCE RLS` podía superar el gate.

## R12 implementado (aún requiere CI del nuevo commit)
- `PgSessionContext.bind_verified_claims`: si se intenta una segunda vinculación sobre una conexión ya asociada, primero rollback transaccional y limpieza en Python; evita que la autenticación fallida conserve identidad SQL o escrituras sin confirmar.
- `check_postgres_staging_readiness`: comprueba herencia/membresía en roles con BYPASSRLS, atributos elevados o propiedad de tablas del esquema público; falla por defecto.
- Requisito `FORCE ROW LEVEL SECURITY` en las 57 tablas además de `ENABLE RLS` y políticas por tabla.
- 2 pruebas negativas adicionales del gate y 2 pruebas adversariales PostgreSQL sintético de rebind/rollback; piloto **20 casos** (frente a 18 en R11).

## Límites reales no cerrados
- Las 20 pruebas R12 son contractuales/sintéticas. Todavía no prueban la API FastAPI completa ni las 57 tablas reales.
- Login/registro por invitación, MFA, verificación y recuperación continúan consultando directamente tablas privadas. Antes de habilitar Neon RLS se requieren interfaces autenticación bootstrap SQL mínimas y pruebas de regresión completas.
- `domi_auth.activate_session` existe únicamente en fixture CI; no ha sido instalado en Neon. La presencia del helper y sus permisos deben comprobarse contra una migración versionada.
- El piloto RLS tiene claves foráneas en datos sintéticos, pero Neon real tiene cero claves foráneas declaradas.
- No se desplegó Railway, no se creó branch adicional ni servicio pagado.
- GATE R12 CI: PENDING hasta observar run del nuevo commit; no extrapolar PASS histórico.

## Cápsula de rehidratación
`DOMI_R12_REBIND_ROLLBACK_FORCE_RLS_MEMBERSHIP_GATES_20261011`
Último Security Gate probado: #170, 18/18 PASS. R12 corrige limpieza en rebind y endurece gate de rol transitivo y FORCE RLS. 20 tests PostgreSQL CI previstos. RLS Neon real pendiente 0/57; Railway staged 124.

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde DOMI_R12_REBIND_ROLLBACK_FORCE_RLS_MEMBERSHIP_GATES_20261011 en GitHub majofreasenjo-jpg/Vantdomus PR #2. Primero verifica el Security Gate para el commit R12 y exige piloto PostgreSQL **20 passed**, backend/web/mobile SUCCESS, sin skips indebidos. Si hay fallas, inspecciona el job y repara su causa, preservando la arquitectura de R1–R11. Luego diseñar e integrar un bootstrap auth restringido que permita login/registro con invitación/MFA/reset sin otorgar acceso directo del rol runtime a hashes/tokens, y migraciones RLS por familias de las 57 tablas en Neon validación con pruebas adversariales antes de cualquier deploy. No cambiar Neon main ni servicios Railway sin autorización expresa de costos. Actualiza bitácora append-only, cápsula y Exact Prompt Restart.