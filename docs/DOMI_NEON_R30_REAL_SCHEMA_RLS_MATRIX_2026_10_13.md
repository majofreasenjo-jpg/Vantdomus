# DOMI R30 — Inventario comprobado de 57 tablas Neon y estrategia RLS

Fecha 2026-10-13. Fuente: consultas de solo lectura en proyecto Neon `solitary-dawn-70172559`, rama aislada `br-broad-poetry-aksbxhbf`. NO aplicar sobre `main`.

## Preflight real (no es aprobación RLS)
- 57 tablas base en `public`.
- 0/57 `relrowsecurity=true`, 0/57 `relforcerowsecurity=true`, cero policies.
- Ninguna FOREIGN KEY declarada en `public` según `information_schema` (se confirmó con enumeración general).
- Las columnas de fechas son TEXT y los indicadores `users.is_active`, `user_mfa.is_enabled` son INTEGER. Las pruebas CI sintéticas usan timestamptz/boolean y **no son migraciones aplicables**.
- Tablas pertenecen a `neondb_owner`; no existe actualmente rol de aplicación restringido comprobado. Usar dueño de tablas o `BYPASSRLS` como runtime invalidaría una certificación.
- Los estimados `reltuples=-1` indican estadísticas no inicializadas; **NO** demuestran cero registros.

## Familias por modelo de autoridad
**A. Identidad, credenciales y tokens — acceso exclusivamente por funciones SECURITY DEFINER estrechas.** `users`, `auth_sessions`, `auth_login_attempts`, `user_mfa`, `user_mfa_recovery_codes`, `email_verification_tokens`, `password_reset_tokens`. Prohibido conceder SELECT general de contraseñas, hashes o TOTP.

**B. Membresía y estructuras de autoridad.** `organizations`, `organization_memberships`, `households`, `household_memberships`, `persons`, `household_invitations`, `guardian_relationships`, `guardian_consents`. Requiere sujeto verificado por JWT/JTI y sesión no revocada; no confiar en GUC de usuario libremente definible. Invitaciones y consentimiento deben tener protecciones adicionales frente a autopromoción, menores y cambio de hogar.

**C. Hogar/organización con `household_id` directo.** `adherence_plans`, `agent_hub_events`, `alerts`, `assistant_action_log`, `assistant_proposals`, `assistant_recommendations`, `audit_log`, `coupling_gateways`, `daily_activities`, `device_tokens`, `document_route_candidates`, `events`, `evidence_items`, `expenses`, `family_board_posts`, `family_documents`, `family_music_links`, `family_post_comments`, `family_reminders`, `features_daily`, `function_events`, `household_shopping_items`, `logbook_entries`, `medication_state`, `memory_items`, `notification_outbox`, `notification_targets`, `person_support_profile`, `progress_snapshots`, `reward_events`, `reward_rules`, `security_events`, `signed_file_tokens`, `state_snapshot`, `task_items`, `unit_functions`, `web_push_subscriptions`, `webhook_ingest_log`. Las políticas requieren pertenencia activa y, cuando exista, coincidencia correcta con `organization_id`. Columnas personales/visibilidad/consentimiento pueden exigir restricciones **más fuertes** que pertenencia al hogar.

**D. Relaciones indirectas o sistemas sin hogar directo.** `event_actors` (via `events.event_id`), `unit_function_responsibles` y `unit_function_versions` (via `unit_functions.unit_function_id`), `scheduler_runs` (sistema sin acceso cliente), además de `organization_memberships` y `organizations` que siguen política de membresía organizacional. No conceder permisos por simple identificación de persona, evento o función.

## Puertas de aceptación obligatorias antes de datos reales
1. Una migración versionada y reversible habilita RLS + FORCE RLS para **las 57 tablas**, y se valida contra la lista de tablas real, sin exclusiones silenciosas.
2. Roles `domi_app_runtime`, `domi_auth_lookup`, `domi_auth_session_issuer` de permisos mínimos, sin `BYPASSRLS`, SIN herencia del dueño y sin credenciales en cliente.
3. Seudofunciones de identidad con `SECURITY DEFINER` y `search_path` fijo se revisan y verifican, siempre ligadas a JWT validado y JTI autenticado; se prohíbe confiar en claims de cliente arbitrarios.
4. Prueba sintética de dos organizaciones/tres hogares con ataques SELECT/INSERT/UPDATE/DELETE, cambio de hogar, actualización de `organization_id`, enlaces indirectos, revocación y caducidad.
5. En `memory_items`, casos de consentimiento, `visibility_scope`, `deleted_at`, expiración, menores y propietario; la membresía al hogar sola NO basta.
6. La lectura de 0 tablas sin RLS no certifica nada sin comprobar GRANT/REVOKE, roles efectivos y operaciones reales por SQL.
7. Ensayar reversible rollback, observabilidad, pérdida de conectividad y funcionamiento de registro/MFA/reset/logout antes de activar acceso Owner Beta.
8. Confirmación personal de computadora/teléfono y memoria en dos sesiones autenticadas. No reportar piloto ni producto terminado a partir de fixtures.

## Barrera operativa
En R30 solo se hizo **inspección read-only**. Neon `main` y validación no se mutaron; Railway no desplegado; PR continúa draft. Evitar migración universal de 57 tablas antes de revisión de amenazas y rutas realmente usadas. La certificación es un resultado de seguridad, no una métrica de cantidad de policies.

## Próximo trabajo técnico
Crear la primera migración reversible por dominios `users/auth_sessions/households/household_memberships/persons/memory_items`, con fixture adaptado al esquema auténtico y pruebas negativas. A continuación incorporar restantes familias hasta 57, sin abrir ninguna tabla al runtime sin política. Mantener acceso personal real inhabilitado hasta cierre integral.
