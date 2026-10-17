# DOMI R38 — HTTP autenticado → PostgreSQL → memoria privada (2026-10-14)

## Evidencia inicial certificada
- Security Gate #226, run 38509739569 SUCCESS: backend/web/mobile PASS; piloto PostgreSQL autenticación 62/62 PASS, RLS 19/19 PASS, auditoría web cero.
- PR #2 sigue DRAFT. Neon proyecto solitary-dawn-70172559, rama aislada br-broad-poetry-aksbxhbf, no mutada; última lectura RLS 0/57. Railway sin desplegar.

## Implementación R38
- Commit 9673c486e1a198b40beaba2964249989dd60cfec.
- Nueva ruta `apps/api/app/routes/owner_memory.py`: GET y POST `/owner-beta/memory/private`, ambos sujetos a FastAPI `get_current_user` que verifica firma y expiración JWT, contexto PostgreSQL firmado y RLS. Requiere tres flags opt-in (`DOMI_ENABLE_OWNER_PG_MEMORY`, `DOMI_ENABLE_SIGNED_RLS_RUNTIME`, `DOMI_ENABLE_PG_AUTH_LOGIN`); no disponible en producción.
- El POST obtiene persona/hogar/organización desde PostgreSQL según el usuario autenticado, crea memoria `private_self`, consentimiento exclusivamente `self`, sensibilidad por defecto normal; limita longitud y niega campos extras. No expone SQL ni acepta house/org/consent del cliente.
- GET ofrece máximo 30 recuerdos propios con Cache-Control no-store; nuevas peticiones usan conexión diferente y revalidación de JWT/JTI contra RLS.
- Se agregan seis tests HTTP a la suite real de PostgreSQL aislado: sin bearer, sesión inválida, persistencia cross-request, aislamiento de dos hogares, veto a campos de autoridad, flags apagados y producción bloqueada. Total 25 tests declarados para el carril RLS.
- CI PostgreSQL incorpora `httpx==0.27.0` para TestClient. El nuevo Security Gate #227, run 38575181008, quedó QUEUED; NO declarar 25/25 PASS ni aceptación HTTP hasta leer logs.
- El endpoint no equivale todavía al asistente conversacional ni a persistencia de recuerdo inferido; sólo crea/lista recuerdos consentidos.

## Riesgos / prohibiciones
- No habilitar en Neon real o staging personal: 57 tablas aún sin RLS en rama auténtica, roles/secretos y migraciones no aplicados.
- Este endpoint se ha hecho adrede estrecho. Falta integrar con el motor de conversación del DOMI, memoria longitudinal, revocaciones, MFA completo, separación familiar/menores, resiliencia cross-device y prueba física PC–teléfono.
- No fusionar PR, no tocar Neon main ni desplegar Railway sin autorización.
- Si CI muestra fallos de schema, actor/rol o TestClient, corregirlos sin quitar pruebas, saltar RLS ni abrir acceso real.

## Cápsula de rehidratación
DOMI_R38_HTTP_PG_MEMORY_OWNER_20261014 | #226 PASS 62/62 auth + 19/19 RLS, audit web 0. Nuevo endpoint HTTP opt-in memoria privada y 25 pruebas RLS incluyendo seis HTTP; #227 QUEUED. Neon real RLS 0/57, Railway sin deploy, Owner Beta real NO DISPONIBLE.

## Exact Prompt Restart
Retoma DOMI en repo majofreasenjo-jpg/Vantdomus PR #2, branch domi-neon-staging-pg-startup-gate-20261010 desde DOMI_R38_HTTP_PG_MEMORY_OWNER_20261014, commit 9673c486e1a198b40beaba2964249989dd60cfec. Verifica GitHub Actions Security Gate #227 (38575181008): backend/web/mobile PASS, auth 62/62, RLS+HTTP 25/25, npm audit 0. Reparar cualquier fallo real sin atajos. Luego preparar migraciones seguras y validación separada Neon solo con aprobación, vinculando posteriormente el endpoint al núcleo conversacional y probando memoria entre sesiones/computador/teléfono. Nunca Neon main, PR merge, Railway deploy o datos personales antes de seguridad y autorización. Mantener bitácora append-only, cápsula y reinicio exacto.
