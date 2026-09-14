# CP1c-FUNC-MIN-3.0 — Plan y arquitectura del AI Orchestrator seguro de Domi

**Estado:** DISEÑO / ARQUITECTURA (design-only). **NO implementa proveedor externo. NO activa OpenAI/Gemini/LLM. NO toca `.env`. NO deploy. NO rediseña módulos.**
**Base:** commit `ec24767` (CP1c-FUNC-MIN-2.2 cerrado).
**Frase de control:** *Domi no necesita una IA suelta; necesita un orquestador seguro que piense, proponga y pida permiso antes de actuar.*

---

## 1. Estado actual (real, verificado en el código a `ec24767`)

### 1.1 Qué hace hoy Domi SIN IA externa
En el demo **no hay `OPENAI_API_KEY`**, así que Domi responde 100% por **reglas** (`app/assistant/domi_rules.py::answer_domi`): solo lee y resume datos reales del hogar. Es honesto (no inventa) y **read-only**. Cobertura de intenciones: integrantes, persona específica, compras/carro, medicamentos, actividades de hoy, avisos del Mural, presupuesto, documentos, perfiles/estado, resumen, ayuda, saludo. Ejemplo de guardrail ya presente: en medicamentos responde *"las dosis requieren confirmación humana, yo solo aviso"*.

### 1.2 Flujos que YA existen
- **`POST /assistant/chat`** (`routes/assistant.py`) — pide rol `member`; arma mensajes (system + P&L + contexto local) y:
  1. intenta `run_agentic_chat` (OpenAI) si hay key;
  2. si falla o no hay key → cae a `answer_domi` (reglas). Devuelve `provider: "openai" | "domi_rules"`.
- **`GET /assistant/recommendations`** + **`POST /assistant/apply`** — recomendaciones por reglas (`planner.py`), aplicar una.
- **`POST /assistant/plan`** — sugerencias de tareas por palabras clave (sin IA).
- **Bandeja Inteligente (MIN-2)** — `smart_inbox/analyze|candidates|confirm|reject`: **propone → humano confirma/rechaza → persiste con auditoría**. **Este es el patrón de oro a generalizar.**

### 1.3 Herramientas/endpoints reales que Domi PODRÍA usar (ya existen en backend)
Rutas vivas: `persons`, `households`, `household_shopping`, `daily_activities`, `family_board`, `unit_functions`, `unit_function_responsibles`, `vantguide_library` (evidencia + memoria + consent), `finance`, `health`, `alerts`, `notifications`, `tasks`, `logbook`, `audit`, `smart_inbox`, `vision`. (Legacy enterprise: `ceo`, `gerencia`, `forensics`, `coupling`, `organizations`, `scores` — **fuera de scope familiar**.)

### 1.4 "Cerebro IA" ya esbozado (esqueleto del orquestador)
`app/assistant/` ya tiene: `context.py` (arma mensajes + inyecta contexto), `prompts.py` (system prompt), `tools.py` (8 tools con ejecución real), `service.py` (loop agéntico OpenAI), `domi_rules.py` (fallback reglas), `schemas.py`.

**8 tools ya definidas en `tools.py`** (todas escriben a DB + `assistant_action_log` + `audit_log`):
`create_operational_task`, `register_financial_expense`, `generate_claim_report`, `generate_formal_letter`, `create_family_function` (UnitFunction: estudio/medicación/hogar…), `log_function_evidence` (evidencia + / −), `update_person_memory` (memoria estructurada), `create_caregiver_alert`.

### 1.5 Datos que existen (DB / memoria / evidencia / documentos)
- **DB SQLite** multi-tenant: `persons`, `households` (con `meta.module_visibility`), `household_shopping_items`, `daily_activities`, `family_board_posts`, `unit_functions` (+ `function_events`), `expenses`, `alerts`, `notifications`, `task_items`.
- **Memoria** estructurada de largo plazo (VantGuide): tipos `preference / routine_pattern / health_context / negative_learning / improvement…`, con **`consent_scope`** (`visible_to`, `shareable_with_doctor`). **La memoria vive en VantDomus, no en el modelo.**
- **Evidencia** (positiva y negativa) por función.
- **Documentos** ya clasificados vía Bandeja Inteligente.
- **Auditoría:** `assistant_action_log` (tool_name, arguments, result, status) + `audit_log` genérico.
- **RBAC:** `ROLE_RANK = viewer<member<admin<owner`; `require_household_role`; visibilidad por módulo en `meta.module_visibility`.

### 1.6 ⚠️ Brechas críticas del estado actual (lo que MIN-3 debe corregir)
1. **`run_agentic_chat` ejecuta tools DIRECTAMENTE** (loop OpenAI con `tool_choice: auto`) — **sin gate de confirmación humana**. Hoy `register_financial_expense`, `create_family_function` (puede ser medicación) y `create_caregiver_alert` se dispararían solos. **Esto es el "chatbot suelto".**
2. **Contexto sin minimización:** `context.py` inyecta P&L (dashboard CEO) + features completas al prompt — datos de más, sin redacción de PII.
3. **Proveedor acoplado:** OpenAI hardcodeado en `service.py` (sin adapter limpio, sin modo mock determinista).
4. **Tools legacy fuera de scope familiar** mezcladas (claims/cartas/PUMA) — deben quedar deshabilitadas para Domi hogar.

---

## 2. Arquitectura propuesta (server-side, en capas)

```
                 ┌─────────────────────────────────────────────────────────┐
   Usuario ──▶   │  AI ORCHESTRATOR (server-side, FastAPI)                  │
                 │                                                          │
                 │  1. Intent/Router ──▶ 2. Consent/Permission Gate         │
                 │        │                     │                           │
                 │        ▼                     ▼                           │
                 │  3. Context Builder    (rol + módulo + consent + PII)    │
                 │     (minimizado)                                         │
                 │        │                                                 │
                 │        ▼                                                 │
                 │  4. Provider Adapter  ──(mock | real, gated)──▶ modelo   │
                 │        │  (el modelo SOLO propone; nunca ejecuta)        │
                 │        ▼                                                 │
                 │  5. Action Proposal (structured)                        │
                 │        │                                                 │
                 │        ▼                                                 │
                 │  6. Human Confirmation Gate ◀── UI (Confirmar/Rechazar) │
                 │        │ (sensibles = obligatorio)                       │
                 │        ▼                                                 │
                 │  7. Tool Registry ──▶ Tool Execution (permiso-checkeada) │
                 │        │                                                 │
                 │        ▼                                                 │
                 │  8. Audit Log + 9. Evidence + 10. Memory Writeback       │
                 │        │  (todo sin secretos, scoped por household)      │
                 │        ▼                                                 │
                 │  ──▶ Respuesta de Domi (cálida, honesta)                 │
                 └─────────────────────────────────────────────────────────┘
```

Componentes:
- **AI Orchestrator** — único punto de entrada; el modelo nunca toca la DB.
- **Provider adapter desacoplado** — interfaz `propose(messages, tools) -> Proposal`; implementaciones `MockProvider` (determinista, default) y `OpenAIProvider` (gated por key + flag, NO en MIN-3.0).
- **Tool registry** — catálogo declarativo: nombre, input/output schema, permisos, si requiere confirmación, qué evidencia/memoria escribe.
- **Permission/consent gate** — valida rol (RBAC), visibilidad de módulo y `consent_scope` ANTES de construir contexto y ANTES de ejecutar.
- **Retrieval de contexto permitido** — trae solo lo que el rol/consent permite; minimiza y redacta PII.
- **Action proposal** — salida estructurada (no texto libre) que la UI puede mostrar y el usuario confirmar.
- **Human confirmation** — generaliza el patrón Bandeja Inteligente; **obligatorio** en categorías sensibles.
- **Audit log** — `assistant_action_log` + `audit_log`, sin secretos.
- **Memory writeback** — memoria estructurada con consent, en VantDomus (no en el modelo).

---

## 3. Flujo base

```
Usuario
  → Domi (UI /assistant/chat)
    → Intent/Router (¿charla informativa o acción?)
      → Context Builder (minimizado, scoped por rol+consent, PII redactada)
        → IA si corresponde (adapter mock/real) — el modelo SOLO PROPONE
          → Propuesta estructurada (tool + args + por qué + sensibilidad)
            → Confirmación humana (obligatoria si sensible)
              → Tool execution (permiso-checkeada, scoped por household/person)
                → Audit + evidencia + memoria (sin secretos)
                  → Respuesta de Domi (explica qué hizo o qué propone)
```

Regla dura: **ninguna acción de escritura ocurre sin pasar por (6) Confirmación humana cuando es sensible.** Consultas de solo-lectura pueden responder directo (como hoy `answer_domi`).

---

## 4. Herramientas que Domi PUEDE tener en MIN-3 (todas *propose-first*)

| Tool | Lectura/Escritura | ¿Confirmación? | Reusa (ya existe) |
|---|---|---|---|
| `read_household_summary` | lectura | no | `domi_rules` / features |
| `read_shopping` | lectura | no | `household_shopping` |
| `propose_shopping_item` | escritura | **sí** | patrón Bandeja + `household_shopping` |
| `read_classified_documents` | lectura | no | `smart_inbox` |
| `propose_study_task` | escritura | **sí** | `create_family_function(category=study)` |
| `explain_receipt_or_circular` | lectura | no | parser boleta MIN-2.1 |
| `prepare_simple_study_plan` | lectura (borrador) | no (crear tareas = sí) | `planner` |
| `suggest_calm_support` | lectura | no (**sin diagnóstico**) | copy Domi |
| `request_health_or_finance_confirmation` | escritura | **sí, obligatoria** | `create_family_function` / `expenses` con gate |

Nota: las 4 tools legacy actuales (`generate_claim_report`, `generate_formal_letter`, `register_financial_expense` genérico USD, `create_operational_task` enterprise) **quedan deshabilitadas** para Domi hogar en MIN-3.

---

## 5. Qué queda PROHIBIDO en MIN-3

- Confirmar medicamentos automáticamente.
- Diagnosticar salud / dar indicaciones médicas.
- Mover dinero / comprar / pagar.
- Leer URLs reales (se mantiene demo controlada + anti-SSRF de MIN-2).
- Usar datos sin consentimiento (`consent_scope`).
- Guardar memoria sin criterio (solo vía `update_person_memory` con confirmación de escritura).
- Exponer datos sensibles en prompts o logs.
- Ejecutar tools directamente desde el modelo (el modelo solo propone).

---

## 6. Modelo de seguridad

- **Categorías sensibles:** salud, medicación, finanzas, seguridad, datos de menores. → **gating humano obligatorio.**
- **Minimización de contexto:** solo se inyecta lo necesario para la intención; nada de P&L/CEO en Domi hogar.
- **Redacción/filtrado de PII** en lo que va al prompt y a los logs (nombres completos, RUT, direcciones, montos exactos → reducidos/enmascarados cuando no son necesarios).
- **Límites por rol** (RBAC `viewer<member<admin<owner`) y **scoping por `household_id`/`person_id`** en cada tool.
- **Visibilidad por módulo** (`meta.module_visibility`) respetada.
- **Logs sin secretos** (ya se cumple; se mantiene) — nunca imprimir la API key ni valores sensibles.
- **Auditoría de cada acción** (`assistant_action_log` + `audit_log`).

---

## 7. Contrato de herramientas (plantilla declarativa)

Cada tool en el registry se declara con:
```
name:                str                # ej. propose_study_task
input_schema:        JSONSchema         # args validados (pydantic)
output_schema:       JSONSchema         # resultado estructurado
required_role:       viewer|member|admin|owner
required_modules:    [str]              # módulos que deben estar visibles
sensitive:           bool               # true → confirmación obligatoria
requires_confirmation: bool
writes_evidence:     bool               # y de qué tipo
writes_memory:       bool               # y con qué consent_scope
side_effects:        [str]              # tablas que toca
```
El **modelo solo ve** `name` + `description` + `input_schema` (para proponer). La ejecución la hace el orquestador tras el gate.

---

## 8. Estrategia de IA (adapter listo, proveedor apagado)

1. **Adapter desacoplado** con interfaz única `Provider.propose(...)`.
2. **`MockProvider` determinista por default** — mapea intención→propuesta sin red (extiende `domi_rules`), permite construir y testear todo el flujo **sin proveedor externo**.
3. **`OpenAIProvider` (u otro) detrás de flag + key** — **NO se activa en MIN-3.0**; se enciende solo con autorización explícita (MIN-3.2+), con contrato de datos y minimización.
4. **El modelo nunca ejecuta**: se fuerza `propose-only`; el orquestador valida permisos y exige confirmación humana antes de tocar la DB. (Se **retira** el `tool_choice: auto` con ejecución directa del `run_agentic_chat` actual.)

---

## 9. Archivos probablemente tocados en MIN-3.1 (implementación posterior, no ahora)

- **Backend:** `app/assistant/orchestrator.py` (nuevo), `app/assistant/providers/{base,mock,openai}.py` (nuevo), `app/assistant/registry.py` (nuevo), refactor `service.py` (propose-only), `tools.py` (marcar sensibles + desactivar legacy), `context.py` (minimización + PII), `routes/assistant.py` (endpoints `propose`/`confirm`/`reject`).
- **Frontend:** panel de Domi que muestra **Propuesta → Confirmar/Rechazar** (reusa UX de `DomiDocPanel`), `lib/api.ts` (nuevos endpoints).
- **Tipos:** `schemas.py` (Proposal, ToolContract), TS equivalentes.
- **Tests:** flujo propose→confirm, gate de sensibles, RBAC/consent, minimización de contexto, mock determinista, "el modelo no ejecuta directo".
- **Documentación:** este doc + actualización de PROJECT_RULES / SECURITY_BASELINE.

---

## 10. Criterios de aceptación para pasar de MIN-3.0 a MIN-3.1

1. Arquitectura y contratos aprobados por ChatGPT (este doc).
2. Definido el set exacto de tools de MIN-3.1 y cuáles son sensibles.
3. Confirmado que **MockProvider** es el default y **no se activa proveedor externo**.
4. Confirmado el gate de confirmación humana como obligatorio en salud/finanzas/medicación/seguridad.
5. Confirmada la minimización de contexto y la política de PII/logs.
6. Plan de tests aceptado.
7. Sin ampliar scope a voz, ni fetch real de URLs, ni deploy, ni rediseño de módulos.

---

### Resumen ejecutivo (1 línea)
El orquestador ya existe pero hoy **ejecuta sin permiso**; MIN-3 lo convierte en **propose-first con confirmación humana, permisos, consent, minimización y auditoría**, con proveedor **mock por default** y el externo apagado hasta autorización.
