# DOMI — bitácora append-only R6 | 2026-10-10
Predecesor: `DOMI_CHECKPOINT_R5_2026_10_10.md`. PR #2 en borrador.

## Evidencia previa al parche
GitHub Actions `38083425671` en R5: backend **PASS**, web **PASS**, escáner de secretos **PASS**, `npm ci` móvil **PASS**. Mobile typecheck **FAILED** exclusivamente con 9 TS2591 (`process.env` sin tipos). Global Security Gate **FAILED** por el trabajo móvil.
Estados Vercel del commit mostraron fallos de `build-rate-limit` vinculados al límite de compilaciones; son externos al Security Gate y no certifican ni invalidan por sí solos la seguridad.
Neon validación: 57 tablas, 0/57 RLS, 0 políticas, sin claves foráneas declaradas; `neondb_owner` BYPASSRLS. Railway: 124 cambios STAGED, seis servicios no desplegados.

## Cambios R6
- Declaración explícita de `@types/node@25.4.0` (versión ya fijada en el lockfile); `types` incluye `node`.
- Gate PostgreSQL endurecido: rechaza **cualquier** tabla pública ordinaria sin política RLS, no solo catálogo de políticas vacío.
- Prueba determinista para rechazar 56/57 tablas cubiertas.
- Matriz RLS de 57 tablas generada del catálogo real y registrada en `docs/DOMI_RLS_TABLE_MATRIX_R6_2026_10_10.md`.

## Evidencia y límites
Los cambios de este commit son implementación. Su resultado CI aún requiere ejecución observable posterior. El contrato RLS es diseño, **NO** política aplicada ni prueba funcional viva. No se modifica producción, Neon main ni Railway.

## Gates siguientes
1. Leer workflow completo correspondiente al nuevo HEAD y cerrar CI.
2. Resolver ruta bootstrap autenticación + identidad verificada y contexto SQL transaccional.
3. Aplicar esquema de privilegios mínimos y RLS en Neon validación, con 2 hogares/2 organizaciones y pruebas adversariales; mantener perfiles familiares y seguridad existente.
4. Conectar API a rol limitado y preparar staging físico solo con autorización explícita de costos.
5. Ejecutar continuidad computador–teléfono física, recibos de transporte y recuperación.

## Cápsula de rehidratación
`DOMI_R6_MOBILE_TYPES_POLICY_COVERAGE_20261010`: backend y web aprobados en workflow anterior, mobile último error TS2591 aislado, corrección directa `@types/node` realizada. Gate PG exige ahora cero tablas sin políticas. Matriz 57 tablas documentada. Neon 0/57 RLS, Railway STAGED sin despliegue. PR #2 sigue draft.

## Exact Prompt Restart
Retomar DOMI desde `DOMI_R6_MOBILE_TYPES_POLICY_COVERAGE_20261010`, repositorio `majofreasenjo-jpg/Vantdomus`, PR #2 sobre rama `domi-neon-staging-pg-startup-gate-20261010`. Primero verificar en CI que `npm ci` y `tsc` móviles pasaron y que backend/web mantienen PASS; no ocultar Vercel build-rate-limit. Luego tomar la matriz real de 57 tablas para implementar y demostrar políticas por clase en rama Neon `br-broad-poetry-aksbxhbf`, con runtime no privilegiado, contexto autenticado confiable, integridad referencial sin FKs y pruebas adversariales. No fusionar PR ni desplegar Railway sin cerrar los gates y autorizar costos. En cada avance anexar bitácora, cápsula de rehidratación y Exact Prompt Restart.
