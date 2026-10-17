# DOMI R59 — Propuesta de recordatorios y control de confirmación
Fecha: 2026-10-17. Bitácora append-only. PR #2 DRAFT.

## Evidencia de reanudación
Security Gate #284 (run 38981436756) SUCCESS: backend, web, mobile, postgres-rls-pilot, postgres-real-auth-candidate; staging-smoke SKIPPED. R58 corrigió contaminación APP_ENV en el test local. No es certificación de staging real.
Se revisaron los módulos del calendario y recordatorios ya existentes: app/assistant/reminders.py con entrega pull e idempotencia; calendar_export.py con exportación ICS; rutas /daily_activities y /assistant/reminders. El catálogo del asistente no tenía herramienta de creación propuesta de recordatorios.

## Cambios materiales R59
- registry.py commit 51243959c270e4b0906305343bccaeb7c65bd87e: contrato propose_family_reminder, rol member, clase family sensible, confirmación humana y módulo reminders.
- proposals.py commit 03c6da53c2575efc1c2431eba8331086a05d6ae0: solo el endpoint de CONFIRMACIÓN existente puede invocar create_reminder para una propuesta pending; valida título, ISO con offset UTC explícito, fecha futura; dedupe por id de propuesta y ámbito household_shared. No hay ejecución por el modelo.
- tests/security/test_domi_r59_reminder_contract.py commit ba2937c3cda2fe2634a74d6a54a211b2aaa62033: contrato y negativas del gateway, sin red.
- Workflow gate R59 commit 7b3f715ccbf4f3c7d5106f3f37075ebd817e3c97 incluye tests.
- CI R59 AÚN PENDIENTE; las pruebas aún no demuestran ciclo HTTP completo, idempotencia real, aislamiento de otra familia ni corrección en esquema PostgreSQL. No declarar beta terminada.

## Decisión de arquitectura
La interpretación de 'mañana a las 19:00' requiere contexto de fecha/zona horaria y consentimiento explícito; la herramienta R59 exige ISO con offset, no transforma expresiones relativas. El MockProvider no tiene aún parser de recordatorios, por lo que el cambio habilita el contrato/confirmación, no la experiencia conversacional completa. No conectar Claude real ni memoria externa hasta certificaciones futuras.

## Roadmap terminal de beta privada (semáforo cualitativo sin porcentajes arbitrarios)
A. Interfaz Vercel family-pilot: base desplegada identificada, UX end-to-end no certificada.
B. Proveedor Claude: Playground manual satisfactorio; adaptador sombra R55/R57 offline certificado en CI anterior; chat real NO conectado.
C. Herramientas: compras/avisos/estudio existentes; recordatorio R59 candidato; pruebas E2E pendientes.
D. Seguridad: PostgreSQL desechable probado; Neon validación 57 tablas 0 RLS en último chequeo, bloqueado.
E. Infraestructura: Render familiar/backend suspendido por facturación en última inspección; sin reactivación y sin gastos.
F. PC↔teléfono y memoria persistente: pendiente validación física.
G. Comercial/publicación: sin activación externa.

## Cápsula de rehidratación
DOMI_STATUS=R59_REMINDER_CONTRACT_IMPLEMENTED_CI_UNVERIFIED
LATEST_CERTIFIED_GATE=R58_284_SUCCESS
R59_CI_COMMIT=7b3f715ccbf4f3c7d5106f3f37075ebd817e3c97
PR_2=DRAFT
NEON_WRITES=NONE
RENDER_DEPLOY=NONE
CLAUDE_API_CALLS_BY_ASSISTANT=NONE
PERSONAL_BETA=BLOCKED

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde checkpoint R59 en PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Comprueba Security Gate de R59 commit 7b3f715ccbf4f3c7d5106f3f37075ebd817e3c97, en particular pruebas de registry/proposals. Profundiza pruebas E2E sintéticas de recordatorio pending -> confirm -> create con fecha/offset explícitos, autorización member, otro hogar, idempotencia y reintentos; no inventar función de calendario de IA que aún no existe. Antes de cualquier beta real cerrar 57 RLS y roles Neon aislado con autorización diferenciada; Render suspendido por billing no reactivar; Claude sombra no conecta al chat live. Preservar producción, no gastos ni secretos. Registrar cápsula y restart append-only en próximo avance.
