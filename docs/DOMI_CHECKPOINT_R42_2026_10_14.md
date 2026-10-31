# DOMI R42 — corrección sintaxis Owner Private UI · 2026-10-14

## Evidencia comprobada
- Security Gate #237, run 38600603405: backend, mobile, postgres-rls-pilot SUCCESS; web FAILED al typecheck con TS1005/TS1011 sobre OwnerPrivateClient.tsx:62. Staging-smoke SKIPPED.
- R41 añade puerta de admisión 57/57 RLS y 37 pruebas de RLS/HTTP en código. PostgreSQL job SUCCESS; sin evidencia de despliegue con memoria personal real.
- PR #2 continúa DRAFT y no fusionado. Neon principal y rama validación sin modificaciones; RLS real pendiente. Railway sin desplegar.

## Corrección R42
- Commit 872594b5b765d5558d0ee70b02173bd0b2b7d35f modifica únicamente apps/web/app/owner-private/OwnerPrivateClient.tsx.
- El setMessages ahora usa `setMessages(old => [...old,{sender:"me" as const,text},{sender:"domi" as const,text:result.reply}].slice(-20))`, sin anotación sintácticamente incorrecta ni ampliación del tipo sender a string.
- Nueva CI aún pendiente de verificación. No afirmar PASS hasta comprobar compilación, postbuild, backend, mobile, auth 62/62 y RLS+HTTP 37/37.

## Cápsula de rehidratación
DOMI_R42_OWNER_WEB_TS_FIX_20261014 | #237 falla únicamente web TypeScript, backend/mobile/PG success; commit 872594b5 corrige callback sender literal; nueva CI pendiente, Neon RLS real no aplicado, Railway no deploy.

## Exact Prompt Restart
Retoma DOMI desde DOMI_R42_OWNER_WEB_TS_FIX_20261014, GitHub majofreasenjo-jpg/Vantdomus PR #2 branch domi-neon-staging-pg-startup-gate-20261010, commit 872594b5b765d5558d0ee70b02173bd0b2b7d35f. Verifica CI más reciente, exige backend/web/mobile PASS, PostgreSQL autenticación 62/62 y RLS 37/37 PASS, auditoría web 0. Corrige defectos sin abrir acceso a datos privados ni suprimir pruebas. Siguiente tarea: migración revisada a Neon validación y pruebas reales, nunca main ni Railway sin autorización explícita. Mantén bitácora append-only, cápsula y Exact Prompt Restart.
