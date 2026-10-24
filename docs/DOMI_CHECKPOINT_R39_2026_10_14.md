# DOMI R39 — conversación opt-in con memoria PostgreSQL privada · 2026-10-14

## Evidencia previa
- Security Gate #228, run 38575337019: SUCCESS. Backend/web/mobile PASS; PostgreSQL autenticación 62/62 PASS y RLS+HTTP 25/25 PASS; web npm audit 0. Staging smoke omitido.
- PR #2 permanece en borrador; Neon main y validación no modificados, última lectura 0/57 RLS; Railway sin deploy.

## Implementación R39
- Commit 9629d6b0b38ef6552d723d25e6813794a6bea56e.
- Nueva ruta POST /owner-beta/memory/chat dentro de owner_memory.py, experimental y desactivada por defecto. Exige JWT válido, sesión JTI activa, contexto HMAC de PostgreSQL, RLS y los tres flags de memoria R38.
- Además exige DOMI_OWNER_CHAT_ENABLED=1, DOMI_OWNER_CHAT_EXTERNAL_MEMORY_ALLOWED=1, consentimiento por solicitud share_private_memories_with_provider=true, proveedor real existente OpenAIProvider.is_available() y límite por usuario de 10/min.
- Consulta como máximo seis memorias privadas del dueño a través de RLS; limita cada una a 350 caracteres y no transmite user_id, household_id ni consentimiento al proveedor. Todos los recuerdos se tratan como datos NO CONFIABLES, sin autoridad para ordenar acciones. El proveedor devuelve exclusivamente JSON {reply}, sin acciones.
- Ocho pruebas HTTP adversariales nuevas dentro de test_domi_r31_real_schema_rls.py, aumentando 25→33 casos: consentimiento, flags, proveedor no disponible, continuidad de memoria al conversar, aislamiento, JWT/JTI, rechazo de acciones, producción cerrada. La IA está simulada por monkeypatch y nunca usa red ni cobros en CI.
- Nuevo CI R39 todavía sin certificación cuando se registra; no afirmar 33/33 PASS.
- No habilita la conversación habitual /assistant/chat ni la UI owner real; es una ruta experimental acotada y exige opt-in explícito en cada solicitud.

## Riesgos y limitaciones
- Aunque sea una prueba, el consentimiento privado de almacenamiento no habilita automáticamente envío a terceros. Debe existir autorización informada y controles sobre procesamiento/retención del proveedor antes de ofrecerlo comercialmente.
- No se ejecutaron migraciones en Neon real; 57 tablas aún no poseen RLS según última inspección. No utilizar datos personales en esta ruta.
- La ruta depende del adapter OpenAIProvider existente y de su configuración; no certifica generación natural con un modelo real. La validez del output tampoco garantiza la verdad de la respuesta del modelo.
- Falta probar retención de recuerdos relevantes, corrección/supresión/revocación, eventos auditables, una UI usable y continuidad física PC→teléfono.
- Sin despliegue Railway, sin merge PR, sin modificación Neon main.

## Cápsula de rehidratación
DOMI_R39_CONSENTED_MEMORY_CHAT_20261014 | CI #228 PASS 62/62 auth, 25/25 RLS+HTTP, web audit 0 | commit 9629d6b0 añade chat memoria privado opt-in y 33 pruebas definidas, nuevo CI pendiente | Neon real RLS 0/57 | Railway sin deploy | Owner Beta personal NO ABIERTA.

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde DOMI_R39_CONSENTED_MEMORY_CHAT_20261014, repo majofreasenjo-jpg/Vantdomus PR #2 branch domi-neon-staging-pg-startup-gate-20261010, commit 9629d6b0b38ef6552d723d25e6813794a6bea56e. Primero verificar nuevo Security Gate: backend/web/mobile PASS, PostgreSQL auth 62/62, RLS+HTTP 33/33 PASS y web audit cero; arreglar fallos sin reducir test ni privacidad. Luego diseñar UI real de Owner Beta y aplicar RLS/migraciones en rama aislada Neon solo tras revisión y autorización de cambios, manteniendo autorización explícita para memoria procesada externamente. No desplegar Railway ni tocar Neon main ni merge PR sin autorización. Mantener bitácora/cápsula/reinicio append-only.
