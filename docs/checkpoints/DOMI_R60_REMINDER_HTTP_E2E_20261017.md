# DOMI R60 — HTTP E2E de recordatorios, permisos y campos obligatorios
Fecha: 2026-10-17. Registro append-only. PR #2 draft sin merge.

## Evidencia de inicio
Security Gate #289, run 39002288134, SUCCESS: backend/web/mobile/postgres-rls-pilot/postgres-real-auth-candidate; staging-smoke SKIPPED. Certifica R59 en pruebas automatizadas, NO un staging desplegado.

## Código nuevo R60
- tests/security/test_domi_r60_reminder_http_e2e.py commit f3e0ea6208e4c3f8395d9af710a633b83e45c16e: pruebas TestClient de registro ficticio, hogar real en SQLite temporal, /assistant/chat con proveedor simulado, creación pendiente, confirmación, GET de recordatorio, repetición idempotente, rechazo, tenant A/B, fecha ISO con zona, fecha pasada, edición de fecha, campos ajenos y ausencia de fecha. Ninguna llamada externa.
- apps/api/app/assistant/gateway.py commit ae88db228841aa1d5d6ed60a83eff8efb562a1f1: denegar propuestas cuyo payload no incluya los campos input_schema.required; evita guardar propuestas estructuralmente incompletas. Mantener verificación de tipos y claves.
- .github/workflows/security-gate.yml commit 38978518b3fb4e30843c7a1adaf80465ab34ffb5: CI backend exige el test R60 antes de la suite general. No debilita protección.
- CI de R60 no observado aún. NO declarar PASS hasta verificar ejecución y logs. Si falla, corregir el fixture o la implementación con evidencia antes de dar cierre.

## Puntos pendientes
1. Evaluar efecto de required-fields en otros contratos y posibles regresiones de tests.
2. Cerrar temporalidad relativa solo con zona horaria explícita y fecha base del usuario, sin inferir 'mañana' automáticamente.
3. Probar flujo HTTP en PostgreSQL real desechable; este E2E usa SQLite sintético.
4. Claude Haiku sigue solo en sombra sintética: no se conecta al chat family-live.
5. Neon validación aún no tiene RLS aplicado según último chequeo, Render backend suspendido por billing; sin gastos ni despliegues; pruebas PC-móvil y memoria siguen pendientes.

## Roadmap cualitativo
- Interfaz familiar existente: base reutilizable sin certificar E2E de beta.
- Claude: manual Playground positivo + adaptador experimental offline, sin proveedor familiar activo.
- Recordatorios: propuesta y ejecución R59, test HTTP R60 incorporado sin certificación.
- Seguridad SQL: pruebas desechables; migración Neon sin ejecutar.
- Beta personal: aún bloqueada por backend, aislamiento, persistencia y prueba física.

## Cápsula de rehidratación
DOMI_STATUS=R60_HTTP_REMINDER_E2E_COMMITTED_CI_UNVERIFIED
R59_LAST_CERTIFIED_GATE=289_SUCCESS
R60_TEST_COMMIT=f3e0ea6208e4c3f8395d9af710a633b83e45c16e
R60_GATEWAY_COMMIT=ae88db228841aa1d5d6ed60a83eff8efb562a1f1
R60_CI_COMMIT=38978518b3fb4e30843c7a1adaf80465ab34ffb5
NEON_WRITES=NONE
RENDER_REACTIVATION=NONE
CLAUDE_API_CALLS=NONE_THIS_TURN
PR_2=DRAFT
OWNER_BETA=BLOCKED

## Exact Prompt Restart
Retoma DOMI/VANTDOMUS R60 desde repo majofreasenjo-jpg/Vantdomus PR #2 draft, rama domi-neon-staging-pg-startup-gate-20261010. Primero comprobar Security Gate del commit 38978518b3fb4e30843c7a1adaf80465ab34ffb5 y logs, en especial tests/security/test_domi_r60_reminder_http_e2e.py. Resolver fallos reales manteniendo aislamiento de hogares, confirmaciones, idempotencia, timezone y required-fields validation de gateway. Luego ampliar pruebas PostgreSQL sintéticas e integración funcional de recordatorio sin conectar aún Claude al chat familiar. No tocar Neon, Render, Railway, producción, ni gastar créditos. Mantener bitácora append-only y siguiente cápsula/reinicio exacto.
