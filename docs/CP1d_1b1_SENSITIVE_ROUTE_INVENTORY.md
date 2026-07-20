# CP1d-FAMILY-PILOT-1b.1-R1 — Inventario de rutas sensibles y su lockdown

Inventario completo (punto 6F del gate) de todas las rutas que leen o escriben
tablas sensibles, con el mecanismo que las cierra en `APP_ENV=family-pilot`.
Cada fila tiene un test que confirma el cierre.

## Módulos con gate por ruta (`require_module_visible`, DENIED en family-pilot)

| Ruta | Tabla/dato sensible | Gate | Test |
|---|---|---|---|
| `POST /finance/expenses` | `expenses` (escritura) | `require_module_visible(finance)` | `test_r1_finance_post_denied_in_family_pilot` |
| `GET /finance/expenses` | `expenses` (lectura) | `require_module_visible(finance)` | `test_49_50_51...` |
| `POST /health/adherence/set` | `adherence_plans`, `events domain=health` | `require_module_visible(health)` | `test_49_50_51...` |
| `GET /health/adherence/get` | `adherence_plans` | `require_module_visible(health)` | `test_49_50_51...` |
| `POST /health/checkin` | `medication_state`, `events domain=health` | `require_module_visible(health)` | `test_49_50_51...` |
| `GET /persons/{id}/health-timeline` | `events domain=health` | `require_module_visible(health)` | `test_49_50_51...` |
| `POST /smart_inbox/analyze` | `document_route_candidates` | `require_module_visible(documents)` | `test_49_50_51...` |
| `GET /smart_inbox/candidates` | `document_route_candidates` | `require_module_visible(documents)` | `test_49_50_51...` |
| `POST /smart_inbox/candidates/{id}/confirm` | `document_route_candidates` | `require_module_visible(documents)` | (regresión) |
| `POST /smart_inbox/candidates/{id}/reject` | `document_route_candidates` | `require_module_visible(documents)` | (regresión) |

## Rutas transversales con bloqueo dirigido

| Ruta | Motivo | Mecanismo | Test |
|---|---|---|---|
| `GET /alerts` | puede incluir alertas de salud (`alert:health:*`) sin clasificación inequívoca | `family_pilot_deny` (bloqueo completo, fail-closed) | `test_r1_alerts_blocked_in_family_pilot` |
| `family_board` post_type `health`/`finance`/`document` | avisos sensibles | `_deny_sensitive_type` en crear/patch; filtro en listado; `_deny_existing_sensitive_post` en patch/resolve/archive/comments | `test_r1_family_board_sensitive_types_blocked_in_family_pilot` |

## Superficie enterprise/no-familiar bloqueada por prefijo (middleware `family_pilot_surface_lockdown`)

Estos routers no forman parte de la experiencia familiar y varios exponen
tablas sensibles por vías sin gate de módulo. Se bloquea el prefijo COMPLETO
con 403 fail-closed en family-pilot.

| Prefijo | Datos sensibles que tocaría |
|---|---|
| `/ceo` | expenses (dashboards ejecutivos) |
| `/gerencia` | agregados de gestión |
| `/forensics` | evidencia documental, archivos privados |
| `/logbook` | adjuntos privados, `signed_file_tokens` |
| `/vision` | archivos privados, batches de documentos |
| `/scores` | scoring interno |
| `/unit_functions` | funciones de unidad (B2B) |
| `/coupling` | webhooks/gateways (B2B) |
| `/organizations` | administración multi-tenant |
| `/audio` | STT/TTS (fuera de alcance) |
| `/library/evidence`, `/library/memory` | evidencia/memoria del asistente |
| `GET /households/{id}/export` | **vuelca `expenses` + `adherence_plans`** |

Tests del middleware: `test_r1_enterprise_surface_blocked_in_family_pilot`,
`test_r1_household_export_blocked_in_family_pilot`,
`test_r1_family_surface_still_reachable_in_family_pilot` (no sobre-bloquea).

## Rutas añadidas en R2 (hallazgos de la re-auditoría)

| Ruta | Riesgo | Mecanismo en family-pilot | Test |
|---|---|---|---|
| `POST /households` | creaba household+organization+membership **owner** sin política de banda (un menor podía volverse owner de otro hogar) | 403 (el hogar del piloto se crea solo por bootstrap 1b.3) | `test_r2_create_household_blocked_in_family_pilot` |
| `GET /households` | `backfill_user_households` autoprovisiona una **organización empresarial + membership owner** por cada usuario al listar | variante `_family_safe_backfill` sin crear organizaciones | `test_r2_get_households_does_not_autoprovision_org_in_family_pilot` |
| `GET /households/{id}/members` | filtraba **email + sesiones + last_seen** de todos a rol viewer/menor | minimización: owner/admin vista admin; titular su propio email; resto solo display_name+rol+presencia | `test_r2_members_minimization_hides_email_and_sessions` |
| `GET /persons/{id}/support_profile` | `health_notes`, `caregiver_notes`, neurodiversidad, ansiedad, accesibilidad; **sin scoping por hogar** (fuga entre hogares) y bug `linked_user_id` (500 a no-admins) | 403 en family-pilot; scoping `person_id + household_id`; self por `persons.user_id` | `test_r2_support_profile_denied_in_family_pilot`, `test_r2_support_profile_cross_household_isolation`, `test_r2_support_profile_self_resolves_by_user_id` |
| `PUT /persons/{id}/support_profile` | ídem + no validaba que `person_id` perteneciera al `household_id` | 403 en family-pilot; validación de pertenencia | (mismos tests) |
| Family Board `post_type=school` | escuela/estudio real es NOT_IMPLEMENTED hasta su gate | añadido a `FAMILY_PILOT_DENIED_BOARD_TYPES` | `test_r2_family_board_school_blocked_in_family_pilot` |

## Nota de alcance
El lockdown declarado cubre TODA la superficie que lee/escribe datos sensibles
identificada en el inventario. Los módulos health/finance/documents quedan
DENIED para todos los roles; las vías transversales y enterprise quedan
bloqueadas fail-closed. El entorno local/test conserva el comportamiento previo
(los gates y el middleware solo actúan bajo `APP_ENV=family-pilot`).
