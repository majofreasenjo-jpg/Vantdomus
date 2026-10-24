# DOMI R28 — Atentación HMAC post-credenciales (2026-10-12)

Documento append-only, predecesor DOMI_CHECKPOINT_R27_2026_10_12.md.

## Evidencia verificada
- GitHub Security Gate #202, run 38333719166: SUCCESS, backend/web/mobile PASS, PostgreSQL **53 passed** y auditoría web 0 vulnerabilidades. Staging smoke omitido.
- PR #2 DRAFT, no merge. Neon principal y validación sin modificaciones; RLS real últimas lecturas 0/57; Railway sin desplegar.

## Implementación R28
- Código commit `7d5c880372c61cd33013ff83a6f91a47f40acac7`.
- El backend ahora firma con HMAC SHA-256 sobre ID usuario, sesión, JWT JTI, TTL, instante y nonce aleatorio, **después** de validar bcrypt/MFA. Exige clave servidor independiente `DOMI_AUTH_ATTESTATION_SECRET`, ausencia provoca fail-closed.
- Fixture CI SQL guarda la clave exclusivamente bajo dueño SECURITY DEFINER con RLS/FORCE; rol lookup e issuer no tienen SELECT. `prepare_session_proof` exige MAC correcto, tolerancia temporal limitada y unicidad de sesión/JTI; función sin firma eliminada.
- `issue_session_bound` comprueba además TTL firmado y consumo único. Roles continúan segregados.
- Suite ampliada a **62 casos definidos**: HMAC incorrecto, sujeto/JTI/TTL diferentes, expiración, nonce, repeticiones, privilegios y ausencia de clave; CI R28 AÚN NO CERTIFICADO.
- Riesgo explícito: una aplicación servidora comprometida podría firmar atestaciones falsas; custodia/rotación de clave debe validarse, falta auditoría criptográfica y pruebas de concurrencia. Se han usado firmas sobre fixture sintético, NO Neon real.
- No hay autorización para activar auth real, desplegar Railway ni utilizar recuerdos personales.

## Puertas pendientes
1. Verificar GitHub Security Gate R28: 62/62 PG, backend/web/mobile, npm audit 0. Corregir fallas sin debilitar controles.
2. Revisar clave separada de JWT, validación de formato UUID y rollback de token/nonce en límites transaccionales.
3. Migraciones específicas para 57 tablas Neon real, pruebas interhogar, revocación, recuperación/invitaciones y event ledger.
4. Owner Beta autenticada solo tras staging autorizado y verificación física computador–teléfono.

## Cápsula de rehidratación
DOMI_R28_HMAC_ATTESTATION_20261012 | previo Security Gate #202 53/53 PASS. HMAC para autorización sesiones implementado en commit 7d5c8803, 62 pruebas definidas pero SIN CI observado. Neon RLS 0/57; Railway no desplegado.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R28_HMAC_ATTESTATION_20261012 en GitHub majofreasenjo-jpg/Vantdomus PR #2, rama domi-neon-staging-pg-startup-gate-20261010, commit 7d5c880372c61cd33013ff83a6f91a47f40acac7. Verifica Security Gate nuevo para 62/62 PostgreSQL, backend/web/mobile PASS y npm audit 0; corrige errores SQL/HMAC reales sin desactivar pruebas. Después cierra el control de claves, pruebas de concurrencia, flujos MFA/revocación, y prepara RLS real en la rama validación de Neon (nunca main). No mezclar demostración sintética con beta personal ni ejecutar Railway sin autorización. Registrar cada avance en bitácora/cápsula/reinicio append-only.
