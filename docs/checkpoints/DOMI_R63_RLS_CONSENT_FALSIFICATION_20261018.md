# DOMI R63 — Refutación de permisos amplios y piloto PostgreSQL de solo lectura
Fecha: 2026-10-18. Registro append-only. PR #2 DRAFT, no merge.

## Evidencia previa
Security Gate #299 (39070479533) = SUCCESS. El paso R62 con dos conexiones PostgreSQL desechables de verdad, CAS sobre una fila y rollback tardío superó CI. No implica Neon real ni autorización PostgreSQL RLS para los 53 módulos restantes.

## Hallazgo adversarial determinante
La primera propuesta 305_domi_r63_reminder_pilot_rls_up.sql concedía UPDATE(status,...) y operaciones INSERT al rol domi_app_runtime de PostgreSQL con filtros de pertenencia. **Esto no prueba consentimiento humano**: un cliente SQL autenticado podría actualizar status='confirmed' directamente, sin pasar por /assistant/proposals/{id}/confirm. No debemos confundir pertenencia con autorización semántica. Por ello el diseño escribible fue RETRACTADO antes de ejecutar migración fuera del repositorio.

## Corrección R63
- Migración candidata 305 en commit 642db4a03d6a2e435fc58e1279393f11b8cc64c4: ahora permite exclusivamente SELECT sobre assistant_proposals propias y family_reminders compartidos del hogar; NO concede INSERT, UPDATE, DELETE, ni acceso de escritura a auditoría; rechaza esquemas distintos de 57 FORCE RLS y roles peligrosos. No permite completar flujo de confirmación, deliberadamente.
- Pruebas adversariales 85140c053c2a98dddfd63700ac9604462047efae y ajuste 4c98fd7fa2e08d301bd9260258c8926b6f17bdb4: inspeccionan grants, políticas limitadas SELECT, ausencia de permisos para falsificar estado y lectura denegada sin sesión verificada. Ejecutan candidato dentro de transacción sobre PostgreSQL local desechable y lo revierten íntegramente al terminar.
- Paso de seguridad agregado en CI commit c0dad8e96e25bb23b1572ae59438b18dd53f1d19, en job postgres-real-auth-candidate, posterior a R62 y anterior al ensayo R50.
- R63 CI AÚN NO CERTIFICADO al registrar. No declarar PASS sin comprobar logs.

## Distinción importante
R62 demostró concurrencia e idempotencia física con rol PostgreSQL superusuario desechable, NO operación segura bajo domi_app_runtime con RLS.
R63, una vez aprobado, certificaría solo lectura restringida, NO escrituras seguras.
Se necesita mecanismo independiente de autoridad de confirmación (por ejemplo función PostgreSQL SECURITY DEFINER de mínimo privilegio llamada exclusivamente desde identidad de aplicación verificada y comprobante anti-replay; evitar que un rol SQL pueda fabricar el consentimiento) y prueba adversarial en DB antes de abrir INSERT/UPDATE.

## Roadmap cualitativo
- Pruebas HTTP SQLite recordatorios: PASS hasta R61.
- PG transacción dos conexiones: PASS R62.
- Permisos PG lectura restringida: R63 candidato, CI pendiente.
- Permisos escritura PG con confirmación real: BLOCKED por HCO de autorización semántica.
- Claude familiar en vivo: NO, solo Playground manual y sombra ficticia.
- RLS Neon 57 tablas, backend Reactivación Render, acceso PC-teléfono: no certificados.
- Beta personal/producción: NO habilitada.

## Cápsula de rehidratación
DOMI_R63=READ_ONLY_RLS_PILOT_UNCERTIFIED
R62_SECURITY_GATE_299=SUCCESS
R63_READONLY_MIGRATION=642db4a03d6a2e435fc58e1279393f11b8cc64c4
R63_TESTS=4c98fd7fa2e08d301bd9260258c8926b6f17bdb4
R63_CI_STEP=c0dad8e96e25bb23b1572ae59438b18dd53f1d19
PR_2=DRAFT
NEON_WRITES=NONE
RENDER_WRITES=NONE
ANTHROPIC_API_CALLS=NONE_THIS_TURN
PERSONAL_BETA=BLOCKED

## Exact Prompt Restart
Retoma DOMI/VANTDOMUS R63 desde PR #2 borrador, rama domi-neon-staging-pg-startup-gate-20261010. Comprueba CI del último commit y logs del test R63 PostgreSQL, arregla fallas sin conceder UPDATE(status) ni INSERT de recordatorios al runtime: R63 debe permanecer lectura exclusiva. La primera versión R63 escribible fue REFUTADA porque podía falsificar confirmación en SQL: la pertenencia a hogar no acredita consentimiento humano. Diseñar luego autoridad de confirmación a nivel de base con función restringida e idempotencia, probar contra dos conexiones y otros hogares usando SQL LOGIN sin privilegios, sin conectar Neon. No tocar Render, Railway, Vercel producción; sin secretos ni costos. Bitácora append-only y nuevo restart.
