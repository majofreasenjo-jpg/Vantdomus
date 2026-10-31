# DOMI R8 — Contrato de prueba RLS PostgreSQL (piloto)

Estado: **experimento ejecutable en CI; no equivale al RLS de Neon**.

## Alcance
- Ejecutar doce casos adversariales con PostgreSQL 16 real en servicio efímero de GitHub Actions, solo contra base local `domi_rls_ci`.
- Probar un ejemplo de `task_items` ligado a dos hogares, dos organizaciones, membresías, usuarios, sesiones y contexto SQL transaccional.
- Un rol `domi_pilot_app` sin BYPASSRLS, sin login, sin administración ni acceso a tablas privadas; se simula con SET ROLE dentro del contenedor.
- Tres funciones SECURITY DEFINER con search_path seguro: activar sesión comprobando JTI, recuperar sujeto vigente y comprobar membresía y organización por fila. Revocación y expiración deniegan.
- Políticas RLS `USING` y `WITH CHECK` para SELECT, INSERT, UPDATE y DELETE en tabla sintética `task_items`. Tabla de sesiones privada no visible directamente.
- Ensayar acceso sin contexto, identificación cruzada, escritura cruzada, cambio de tenant, usuario deshabilitado, sesión caducada, revocación, reset tras COMMIT, claims modificados y separación entre conexiones.
- Prueba de PostgreSQL real, **no** de Neon staging, no de 57 políticas ni de integración funcional de la API.

## Límites y pasos para integrar
- El CI usa superusuario efímero como dueño del fixture; producción debe usar un **propietario acotado**, nunca postgres o neondb_owner de runtime.
- El rol runtime no puede leer directamente usuarios, hashes, tokens y sesiones; rutas de login, reset, MFA e invitación todavía necesitan funciones SQL de privilegio mínimo.
- La identidad transaccional se pierde al hacer COMMIT. Las rutas de FastAPI existentes hacen COMMIT durante peticiones: requieren transacciones conscientemente delimitadas y nuevo bootstrap cuando corresponda, sin heredar datos de otras solicitudes.
- Las variables de sesión de PostgreSQL (`set_config`) son modificables por una sesión con SQL. No son un perímetro absoluto frente a inyección SQL; los helpers vuelven a verificar JTI y membership. Además se requiere prevenir inyección, usar SQL parametrizado y limitar EXECUTE/SELECT.
- El esquema real de Neon tiene cero FOREIGN KEY. El fixture prueba integridad con FK; transferir el contrato exige diseñar migraciones compatibles con datos existentes o comprobaciones equivalentes.
- Tras aprobar piloto, migrar las 57 tablas por clases con pruebas funcionales de autenticación y auditabilidad, staging separado, rollback documentado.
- No tocar rama Neon main ni Railway; la infraestructura queda STAGED sin costos nuevos.

## Fuentes reproducibles
`tests/security/sql/domi_rls_pilot_v1.sql` y `tests/security/test_domi_pg_rls_pilot.py` integrados al workflow Security Gate (`postgres-rls-pilot`).
