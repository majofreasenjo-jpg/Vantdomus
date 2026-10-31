# DOMI R33 — protección de identidad SQL y campos de memoria (2026-10-13)

## Evidencia de entrada
- GitHub Security Gate #215 (38449280185) SUCCESS: backend/web/mobile PASS, PostgreSQL autenticación 62/62 PASS y RLS R31 9/9 PASS, web npm audit 0.
- PR #2 draft, sin merge. Neon validación y main siguen sin aplicar RLS: última observación 57 tablas, 0/57, owner neondb_owner BYPASSRLS; Railway sin despliegue.

## Material implementado
- Commit `9935661e5028d7c5d79b4cb7d76832b1c679881e`.
- Migración 301 `apps/api/postgres_staging_migrations/security/301_domi_r33_owner_beta_rls_hardening.sql`: firma HMAC SHA-256 de sujeto+JTI+timestamp+nonce+identificador de conexión+ID de transacción, clave bajo tabla privada FORCE RLS, función SECURITY DEFINER que rechaza firmas modificadas o vencidas y comprueba sesión activa.
- Permisos de UPDATE en memoria restringidos a contenido y fecha; ningún UPDATE directo de consentimiento, sujeto, hogar, sensibilidad, estado de inferencia ni visibilidad. Se incluyen políticas restrictivas para consentimiento privado no compartible.
- Nuevo módulo `apps/api/app/pg_rls_context.py`: firma de contexto local en transacción; requiere DOMI_RLS_CONTEXT_SECRET servidor independiente y distinta de JWT y atestación; solo se habilitará después de verificar JWT. **El enlace al wrapper de runtime aún NO ha sido integrado ni certificado: NO habilitar en staging real**.
- Piloto R31 extendido de 9 a 16 pruebas (7 adicionales) para falsificación, replay entre transacciones, restricción de columnas, acceso a clave y consentimiento. **Nuevo CI pendiente**, no declarar PASS sin logs.
- Sólo repositorio GitHub actualizado; ninguna sentencia ejecutada en Neon, ninguna activación en producción o Railway.

## Limitaciones prioritarias
- Revisar SQL y fixture frente al PostgreSQL desechable. La construcción HMAC no equivale a despliegue seguro hasta resolver todos los fallos y auditar el vínculo JWT→wrapper→transacción.
- Las policies R31 iniciales aún deben revisarse para tipos de fechas TEXT y datos inesperados. Existe riesgo si cliente puede ejecutar SQL arbitrario como rol de runtime; prohibirlo totalmente y validar confianza del servidor.
- El rollback 300 no retira todavía los objetos nuevos de 301; preparar rollback R33 fail-closed antes de aplicar en Neon validación.
- Persistencia de memoria auténtica y continuidad física PC→teléfono NO verificadas.
- 53 otras tablas deliberadamente cerradas, por lo que producto no está listo para uso real.

## Cápsula de rehidratación
DOMI_R33_CONTEXT_AND_MEMORY_HARDENING_20261013 | baseline CI #215 PASS 62/62 auth +9/9 R31 | commit 9935661e R33 HMAC contexto por transacción y actualización por columnas, pruebas 16 totales EN CI PENDIENTE | Neon 0/57 RLS; Railway sin deploy; Owner Beta real cerrada.

## Exact Prompt Restart
Retoma VANTDOMUS DOMI en PR #2 rama domi-neon-staging-pg-startup-gate-20261010 desde DOMI_R33_CONTEXT_AND_MEMORY_HARDENING_20261013, commit 9935661e5028d7c5d79b4cb7d76832b1c679881e. Primero verifica Security Gate nuevo, exige PostgreSQL auth 62/62 y RLS 16/16, backend/web/mobile PASS y web audit 0. Corrige fallas SQL/cifrado/consentimiento sin suprimir pruebas ni abrir permisos. Después integra atestación del contexto en pg_session_context.py y flujo JWT, genera rollback 301 fail-closed y valida en base desechable. Neon validación y main no alterados. No desplegar Railway, fusionar PR ni habilitar datos personales. Mantener bitácora, cápsula y Exact Prompt Restart append-only.
