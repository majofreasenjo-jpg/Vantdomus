# DOMI — R7 aislamiento RLS / contrato de certificación
Fecha: 2026-10-10. Estado: **diseño de integración** y **CI PASS**; RLS no aplicado todavía.

## Evidencia certificada
- GitHub Security Gate run 38087000880, commit 306fb32097021748377522e70a5129c2c90272c5: conclusión **success**. Jobs web, mobile y backend success. staging-smoke **skipped**.
- PR #2 continúa DRAFT, no fusionado.
- Neon validation br-broad-poetry-aksbxhbf: 57 tablas, 0 RLS habilitado, 0 FORCE, 0 políticas. Solo neondb_owner, BYPASSRLS true.
- La rama Neon main br-wandering-pond-ak5f1qhb no se modificó.
- Railway staging: patch 33cfd4c6-4d56-4a4e-a43d-47bddba80368 sigue STAGED, 124 cambios, seis servicios sin deployment.
- Vercel reportó fallas de checks externos, varias con build-rate-limit: **GitHub CI PASS no equivale a deployments Vercel PASS**.

## Hallazgo de arquitectura: bootstrap
La API actual ejecuta `get_db` y luego `get_current_user`: valida JWT y consulta auth_sessions con el mismo acceso SQL. Una política global que exija ya un usuario SQL autenticado en auth_sessions rompería el bootstrap o fomentaría una excepción demasiado amplia. Es OBLIGATORIO separar el carril de verificación de sesiones de los datos de aplicación.

## Contrato de ejecución segura (aún sin aplicar)
A. Canal de autenticación y recuperación: un conjunto mínimo de funciones SECURITY DEFINER, con propietario separado, search_path fijado, entradas parametrizadas y resultado limitado. No dar SELECT directo a hashes, tokens, secretos o sesiones. Examinar las llamadas exactas de registro, login, MFA, revocación y reset antes de diseñar la firma final.
B. Canal runtime: rol sin BYPASSRLS, sin CREATEDB/CREATEROLE, no propietario de tablas; revocar PUBLIC donde corresponda y otorgar solo tablas/operaciones indispensables.
C. Contexto verificado: transacciones explícitas, autenticación en servidor, SET LOCAL de identificadores solo después de validación. Advertencia: los GUC son modificables por quien puede emitir SQL; no confundir SET LOCAL con una frontera de seguridad frente a inyección SQL o código de API comprometido. Complementar con privilegios, validación de membresía y amenazas de inyección.
D. Política de datos: cobertura de 57 tablas con USING y WITH CHECK estrictos, coherencia household_id / organization_id, desambiguación de campos NULL, controles de entidades hijas y permiso de usuario. Reglas especiales para 6 tablas de identidad y 2 tablas exclusivas de servicio.
E. Integridad: esquema tiene cero FOREIGN KEY declaradas. Crear contrato explícito de claves cruzadas y pruebas huérfanos, no asumir integridad inexistente.
F. Certificación: bajo 2 hogares y 2 organizaciones sintéticas, probar SELECT/INSERT/UPDATE/DELETE, intento de mover tenant, hogares ajenos, contexto vacío, sesión revocada, privilegios de rol, pools concurrentes y regreso a contexto vacío tras transacción. Fallo de cualquiera deja HOLD.
G. Deploy: no unir PR ni activar Railway hasta CI, aislamiento vivo, secreto runtime restringido, disponibilidad de auth y aprobación de costos.

## Secuencia para cierre
1. Obtener inventario de accesos SQL del backend a usuarios, sesiones y membresías.
2. Implementar función de verificación mínima y sus tests negativos en rama de código.
3. Crear un piloto en Neon validación con roles no privilegiados y datos de prueba sintéticos, sin afectar tablas operativas hasta validar el contrato.
4. Migrar permisos y RLS por grupos definidos en matriz R6, con rollback, monitoreo y controles de regresión.
5. Conectar API a usuario restringido y realizar staging físico, una vez autorizados costos.

## Bitácora
R7 no pretende que 57/57 políticas estén aplicadas. La victoria comprobada es CI PASS. El obstáculo restante es la identidad SQL confiable y la verificación adversarial RLS.

## Cápsula de rehidratación
Checkpoint DOMI_R7_CI_PASS_AUTH_RLS_BOOTSTRAP_CONTRACT_20261010. GitHub Security Gate #165 38087000880 PASS (backend/web/mobile). Neon validation 57 tablas, 0 políticas, rol owner BYPASSRLS, auth bootstrap por resolver. Railway 124 STAGED, sin deploy. PR #2 DRAFT, sin merge.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R7_CI_PASS_AUTH_RLS_BOOTSTRAP_CONTRACT_20261010. Mantén el Security Gate ya aprobado en run 38087000880 sin rehacer R1-R6. Inspecciona todas las rutas de auth/login/registro/MFA/reset y dependencias de sesiones; desarrolla un canal bootstrap con funciones privilegiadas mínimas y auditables, distinto del rol runtime, con pruebas negativas. Luego crea y certifica un piloto RLS aislado con dos hogares y dos organizaciones sintéticas, control de roles, SET LOCAL transaccional, WITH CHECK, contextos cruzados y sin recursión, antes de 57-tablas. No atribuyas RLS PASS hasta observar la ejecución real. No modificar main o producción, ni desplegar Railway ni generar cargos sin autorización. Mantén bitácora append-only, cápsula y Exact Prompt Restart.
