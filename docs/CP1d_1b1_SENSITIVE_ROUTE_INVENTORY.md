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

## Nota de alcance
El lockdown declarado cubre TODA la superficie que lee/escribe datos sensibles
identificada en el inventario. Los módulos health/finance/documents quedan
DENIED para todos los roles; las vías transversales y enterprise quedan
bloqueadas fail-closed. El entorno local/test conserva el comportamiento previo
(los gates y el middleware solo actúan bajo `APP_ENV=family-pilot`).
