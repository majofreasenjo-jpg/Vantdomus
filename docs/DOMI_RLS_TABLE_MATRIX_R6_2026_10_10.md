# DOMI — R6, matriz PostgreSQL de las 57 tablas (REVISIÓN DE DISEÑO)
Fecha: 2026-10-10. Fuente: catálogo vivo de la rama de validación Neon `br-broad-poetry-aksbxhbf`.
Estado: **DISEÑADO / NO APLICADO**. No atribuir certificación de políticas a esta matriz.

## Evidencia
- 57 tablas ordinarias en `public`; 57 claves primarias, 11 restricciones UNIQUE; **0 claves foráneas declaradas** en PostgreSQL.
- RLS habilitado: **0/57**. Rol propietario `neondb_owner` tiene `BYPASSRLS` y no sirve como login API.
- La rama de validación tenía cero usuarios/hogares/memorias en la consulta de este ciclo.
- CLASE es un candidato de diseño, NO una autorización concedida. No se han escrito políticas.

## Contrato de seguridad sin excepciones
1. Un login runtime sin propiedad de tablas, sin BYPASSRLS, CREATEDB ni CREATEROLE; separar rol migrador y runtime.
2. Contexto de usuario verificado por la API, enlazado transaccionalmente; evitar que datos del request escriban arbitrariamente claims SQL.
3. Toda lectura o escritura sensible debe exigir autorización positiva sobre hogar y organización, y `WITH CHECK` en INSERT/UPDATE.
4. Cuentas y recuperación de credenciales necesitan un carril de autenticación previo a sesión con privilegios mínimos y funciones especializadas; no dar acceso directo a contraseñas/tokens.
5. Relaciones indirectas (eventos/responsables/versiones) deben cruzar a su registro padre comprobando permisos; sin FK, verificar también integridad referencial.
6. Servicio y scheduler deben usar acceso separado, sin extender permisos generales a la API.
7. Probar cero-contexto, hogares ajenos, organizaciones ajenas, inserción con ID falsificado, UPDATE que cambia tenant, DELETE, revocación y aislamiento concurrente, con **datos sintéticos**.
8. El gate de arranque comprueba estructura/cobertura; **no sustituye** pruebas del contenido de las políticas.
9. No ejecutar migraciones ni habilitar RLS en `main` ni producción sin aprobación independiente.

## Distribución por clase
- `household_membership`: 1 tabla(s)
- `household_root`: 1 tabla(s)
- `household_scope`: 11 tabla(s)
- `identity_private`: 6 tabla(s)
- `organization_membership`: 1 tabla(s)
- `organization_root`: 1 tabla(s)
- `parent_linked`: 3 tabla(s)
- `service_only`: 2 tabla(s)
- `tenant_pair`: 31 tabla(s)

## Inventario tabla a tabla
| Tabla | Claves de contexto presentes | Clase provisional |
|---|---|---|
| `adherence_plans` | `household_id,person_id` | `household_scope` |
| `agent_hub_events` | `id,household_id,organization_id,gateway_id` | `tenant_pair` |
| `alerts` | `id,household_id,event_id,organization_id` | `tenant_pair` |
| `assistant_action_log` | `id,household_id,user_id,organization_id` | `tenant_pair` |
| `assistant_proposals` | `id,household_id,organization_id,person_id,user_id` | `tenant_pair` |
| `assistant_recommendations` | `id,household_id` | `household_scope` |
| `audit_log` | `id,household_id,user_id,organization_id` | `tenant_pair` |
| `auth_login_attempts` | `id,email` | `service_only` |
| `auth_sessions` | `id,user_id` | `identity_private` |
| `coupling_gateways` | `id,household_id,organization_id` | `tenant_pair` |
| `daily_activities` | `id,household_id,organization_id,person_id` | `tenant_pair` |
| `device_tokens` | `id,user_id,household_id` | `household_scope` |
| `document_route_candidates` | `id,household_id,organization_id,person_id` | `tenant_pair` |
| `email_verification_tokens` | `id,user_id` | `identity_private` |
| `event_actors` | `event_id,person_id` | `parent_linked` |
| `events` | `id,household_id,organization_id` | `tenant_pair` |
| `evidence_items` | `id,unit_function_id,person_id,household_id,organization_id` | `tenant_pair` |
| `expenses` | `id,household_id,person_id,organization_id` | `tenant_pair` |
| `family_board_posts` | `id,household_id,organization_id` | `tenant_pair` |
| `family_documents` | `id,household_id,organization_id,person_id` | `tenant_pair` |
| `family_music_links` | `id,household_id,person_id` | `household_scope` |
| `family_post_comments` | `id,household_id` | `household_scope` |
| `family_reminders` | `id,household_id,organization_id,person_id` | `tenant_pair` |
| `features_daily` | `household_id,organization_id` | `tenant_pair` |
| `function_events` | `id,unit_function_id,household_id,organization_id` | `tenant_pair` |
| `guardian_consents` | `id,household_id` | `household_scope` |
| `guardian_relationships` | `id,household_id` | `household_scope` |
| `household_invitations` | `id,household_id,organization_id,email,person_id` | `tenant_pair` |
| `household_memberships` | `household_id,user_id` | `household_membership` |
| `household_shopping_items` | `id,household_id,organization_id` | `tenant_pair` |
| `households` | `id,organization_id` | `household_root` |
| `logbook_entries` | `id,household_id,user_id,organization_id` | `tenant_pair` |
| `medication_state` | `household_id,person_id` | `household_scope` |
| `memory_items` | `id,person_id,household_id,organization_id` | `tenant_pair` |
| `notification_outbox` | `id,household_id` | `household_scope` |
| `notification_targets` | `id,household_id` | `household_scope` |
| `organization_memberships` | `organization_id,user_id` | `organization_membership` |
| `organizations` | `id` | `organization_root` |
| `password_reset_tokens` | `id,user_id` | `identity_private` |
| `person_support_profile` | `person_id,household_id,organization_id` | `tenant_pair` |
| `persons` | `id,household_id,organization_id,user_id` | `tenant_pair` |
| `progress_snapshots` | `id,person_id,household_id,organization_id` | `tenant_pair` |
| `reward_events` | `id,reward_rule_id,person_id,household_id,organization_id` | `tenant_pair` |
| `reward_rules` | `id,household_id,organization_id,person_id` | `tenant_pair` |
| `scheduler_runs` | `id` | `service_only` |
| `security_events` | `id,household_id,organization_id,user_id` | `tenant_pair` |
| `signed_file_tokens` | `id,household_id,organization_id` | `tenant_pair` |
| `state_snapshot` | `id,household_id,organization_id` | `tenant_pair` |
| `task_items` | `id,household_id,organization_id` | `tenant_pair` |
| `unit_function_responsibles` | `id,unit_function_id,person_id` | `parent_linked` |
| `unit_function_versions` | `id,unit_function_id` | `parent_linked` |
| `unit_functions` | `id,household_id,organization_id,person_id,reward_rule_id` | `tenant_pair` |
| `user_mfa` | `user_id` | `identity_private` |
| `user_mfa_recovery_codes` | `id,user_id` | `identity_private` |
| `users` | `id,email` | `identity_private` |
| `web_push_subscriptions` | `id,household_id,person_id,user_id` | `household_scope` |
| `webhook_ingest_log` | `id,gateway_id,household_id,organization_id,event_id` | `tenant_pair` |

## Decisiones por resolver antes de generar SQL ejecutable
- `tenant_pair`: obligar equivalencia entre `households.organization_id` y campo `organization_id`; rechazar null y cruces.
- `household_scope`: membresía de hogar verificada y referencia positiva al hogar.
- `user_scope`, `identity_private`: usuario autenticado, pero permitir bootstrap solo mediante funciones seguras especializadas.
- `organization_root` y `organization_membership`: evitar escalamiento de miembros y auto-asignación de roles.
- `household_root` y `household_membership`: evitar apropiación de hogar o invitaciones cruzadas.
- `parent_linked`: depender de autorización y existencia del padre, con integridad referencial explícita.
- `service_only`: no exponer directamente al login runtime; accesos mediante un servicio especializado o funciones limitadas.

## Próximo experimento RLS
Probar primero en la rama aislada Neon con dos organizaciones y dos hogares sintéticos. Probar el contrato de login sin privilegios, rutas de autenticación previas a token, `WITH CHECK` y revocación. Repetir por clase y finalmente las 57 tablas; no declarar PASS antes de observar SQL real.

## SQL de diagnóstico read-only
```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       COUNT(p.policyname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname
WHERE n.nspname='public' AND c.relkind='r'
GROUP BY c.relname,c.relrowsecurity,c.relforcerowsecurity
ORDER BY c.relname;
```
