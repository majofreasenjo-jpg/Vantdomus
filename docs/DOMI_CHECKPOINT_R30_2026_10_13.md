# DOMI R30 — inventario real Neon, roadmap Owner Beta, bitácora append-only
Fecha: 2026-10-13. Predecesor: DOMI_CHECKPOINT_R29_2026_10_13.md.

## Evidencia
- Security Gate #206 (38343413617) SUCCESS: backend/web/mobile PASS; PostgreSQL **62/62 PASS**, auditoría web **0 vulnerabilidades**; smoke staging omitido.
- Neon `solitary-dawn-70172559`, validación `br-broad-poetry-aksbxhbf`, consultas SELECT read-only: **57 tablas públicas, RLS 0, FORCE 0, políticas 0, claves foráneas 0 declaradas**.
- Esquema real difiere de fixture CI: sesiones/fechas TEXT e indicadores MFA y activos INTEGER. Runtime con dueño de tablas no sería un mecanismo de aislamiento válido. `reltuples=-1` no equivale a ausencia de datos.
- Inventario y clasificación registrados en `docs/DOMI_NEON_R30_REAL_SCHEMA_RLS_MATRIX_2026_10_13.md`, commit `3d8c8f5087c9694f43b8f674c47f51be131424a2`.

## Hallazgo de bloqueo central
A pesar de 62/62 pruebas de seguridad sintéticas, el acceso a datos personales reales **debe permanecer cerrado**. Hay 57 tablas sin RLS en Neon validación y ningún control SQL de tenant certificado sobre el esquema verdadero; aplicar automáticamente la política genérica de hogar a todas podría filtrar datos personales, consentimiento de menores, MFA o documentos. No abrir beta real hasta migraciones específicas y pruebas negativas.

## Secuencia de cierre orientada a uso personal
1. Revisar y preparar migración versionada/reversible de identidad+hogar+memoria y su fixture adaptado al esquema real sin datos sensibles.
2. Crear roles de mínimo privilegio y completar RLS/FORCE para las 57 tablas sin exclusiones silenciosas, con pruebas SELECT/INSERT/UPDATE/DELETE, contexto verificado, consentimiento, revocación y relaciones indirectas.
3. Completar login/MFA/logout/reset/invite/audit con claves seguras; conectar API staging tras autorización de gastos, solo a entorno aislado.
4. Prueba real Owner computador: login, conversación, memoria consentida, cerrar y reabrir sesión; repetir desde teléfono, caducidad/revocación y rollback.
5. Titan OEM únicamente después de Owner Beta funcional.

## Cambios y límites
- Solo documentación de inventario R30 en GitHub; **sin cambio de políticas Neon, sin despliegue Railway ni mezcla producción**.
- El resultado 62/62 es para PostgreSQL sintético, no verifica las 57 tablas reales.
- PR #2 sigue en borrador y sin merge. Owner Beta actual disponible solo como Preview sintético.

## Cápsula de rehidratación
DOMI_R30_NEON_REAL_SCHEMA_RLS_INVENTORY_20261013 | CI #206 PASS 62/62 PG, web audit 0 | Neon validación 57 tablas, 0 RLS/FORCE/policies, 0 FKs declaradas | inventario real documentado, RLS no aplicado | Railway sin deploy | Owner Beta real NO LISTA.

## Exact Prompt Restart
Retoma DOMI en GitHub majofreasenjo-jpg/Vantdomus PR #2, rama domi-neon-staging-pg-startup-gate-20261010, desde DOMI_R30_NEON_REAL_SCHEMA_RLS_INVENTORY_20261013. Parte del inventario `docs/DOMI_NEON_R30_REAL_SCHEMA_RLS_MATRIX_2026_10_13.md`: Neon validación proyecto solitary-dawn-70172559, rama br-broad-poetry-aksbxhbf tiene 57 tablas, ninguna RLS/FORCE/policies ni FOREIGN KEY declarada; esquema fechas TEXT y flags INTEGER. Security Gate #206 verificado 62/62 PASS con web audit 0, únicamente sintético. Prepara primera migración versionada por dominio de identidad/hogar/memoria, prueba aislamiento cross-household y evita políticas universales que filtren datos. No ejecutar migraciones en Neon main, ni Railway ni gastos sin autorización explícita; no fusionar PR. Mantener bitácora append-only, cápsula y Exact Prompt Restart. Objetivo es Owner Beta real de conversación, memoria persistente entre sesiones y continuidad física PC-teléfono.
