# DOMI R27 — comprobante de emisión de sesiones de un solo uso · 2026-10-12

Predecesor append-only: DOMI_CHECKPOINT_R26_2026_10_12.md.

## Hechos verificados
- Security Gate #200, ejecución 38329557121, SUCCESS: web, backend y móvil PASS; piloto PostgreSQL 46/46 PASS; npm audit web 0 vulnerabilidades.
- PR #2 DRAFT, sin merge. No activación de Railway o migraciones Neon.
- Neon validación previo: 57 tablas públicas, 0 políticas RLS. Los fixtures CI son sintéticos y no equivalen al esquema real.

## Implementación R27
- Commit 39b2c3e72f58b6c383f4a9f2236ac06de06f59f2.
- Nuevo fixture SQL exclusivamente de CI: tabla de pruebas efímeras auth_session_proofs con RLS/FORCE, ID aleatorio UUID, usuario/JTI/ID de sesión, caducidad a 45 s, consumo único en UPDATE condicionado.
- La identidad SQL lookup prepara comprobante; rol issuer consume comprobante y crea la sesión vinculada. Se REVOCA a issuer el mecanismo heredado no vinculado issue_session. Nunca se entrega comprobante al cliente.
- El orquestador FastAPI genera token, crea comprobante tras contraseña y MFA, confirma lookup, y solo devuelve token cuando issuer confirma sesión y auditoría.
- Suite aumenta de 46 a 53 pruebas (7 adicionales) para verificar prohibición de emisión sin prueba, privilegios inversos, reutilización, mezcla de identidades, expiración, nonce inválido e invisibilidad antes de COMMIT.
- CI R27 no certificado todavía. No atribuir PASS sin registro de ejecución.
- Riesgo pendiente: como el rol lookup puede generar comprobantes al invocar la función directamente con un user_id, aún **no existe garantía criptográfica de que el propio SQL lookup haya comprobado bcrypt/MFA**. Su aislamiento limita la capacidad del issuer comprometido, pero el mecanismo debe fortalecerse con un comprobante generado únicamente por un verificador de identidad confiable y auditado, y pruebas de concurrencia/revocación antes de producción.

## Obligaciones previas a Owner Beta personal
- Confirmar Security Gate R27 completo, 53 pruebas, y reparar fallos reales sin desactivar controles.
- Vincular emisión al resultado verificable de credencial y MFA, no solo a conocimiento de un identificador; definir amenazas de compromiso de lookup y issuer.
- Migrar funciones y policies diseñadas para el esquema real TEXT/INTEGER en rama de validación y probar las 57 tablas con aislamiento de hogares y organizaciones.
- Completar registro, invitaciones, recuperación, revocación, MFA y auditoría.
- No fusionar PR, no tocar Neon main ni desplegar Railway hasta autorización explícita.

## Cápsula de rehidratación
DOMI_R27_ONE_TIME_SESSION_PROOF_20261012 | R26 CI #200 46/46 PASS | R27 contrato prueba efímera SQL implementado, 53 tests por certificar | 57 tablas Neon 0 RLS, Railway sin desplegar, memoria personal NO activa.

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde DOMI_R27_ONE_TIME_SESSION_PROOF_20261012 en PR #2 de majofreasenjo-jpg/Vantdomus, rama domi-neon-staging-pg-startup-gate-20261010, commit 39b2c3e72f58b6c383f4a9f2236ac06de06f59f2. Verifica la ejecución del Security Gate, exige 53/53 PostgreSQL PASS, backend/web/mobile PASS, npm audit web 0. Repara fallas auténticas conservando pruebas, roles segregados y protocolo de comprobante. Luego diseña una prueba de identidad realmente vinculante al verificador bcrypt/MFA y continúa RLS para el esquema real solo en Neon validación. No tocar Neon main, merge ni desplegar Railway sin autorización. Registrar bitácora/cápsula/reinicio append-only.
