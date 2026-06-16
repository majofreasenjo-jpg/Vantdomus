# VantGuide — Arquitectura del núcleo transversal

> **Estado**: propuesta arquitectónica aceptada — guía la implementación del Sprint VG.
> **Audiencia**: ingeniería, producto, co-arquitectos.
> **Versión del documento**: 1.0
> **Última actualización**: junio 2026.

---

## 1. Por qué este documento existe

VantDomus se construyó originalmente con un módulo `SchoolPlanner`, otro de medicación (`/health/adherence/...`), otro de tareas (`/tasks`), otro de inbox/coupling. Cada módulo tenía su propio modelo, su propio scheduler implícito, su propia UI, su propio formato de evidencia.

Esa arquitectura **escala mal** y **comunica peor**: hablar de "un SchoolPlanner que también hace medicamentos" obliga a explicar lo que el producto NO es, antes de explicar lo que sí.

La corrección de rumbo de junio 2026 es:

> **VantDomus es una guía inteligente de funciones para cada integrante de una unidad.**
> En modo familia, esa unidad es el hogar. En modo B2B, esa unidad puede ser una faena, una oficina técnica, una clínica, una residencia, una cuadrilla o cualquier unidad operativa.

El nombre del producto del lado del usuario familia es **Guía Familiar** (y de manera más general, **VantGuide**). El nombre técnico interno es **UnitFunction**.

El `SchoolPlanner` deja de ser un módulo de primera clase y pasa a ser un **adapter de ingesta** que normaliza circulares y avisos académicos hacia el núcleo común.

Este documento define el núcleo común. Cualquier feature familia o B2B que se construya de aquí en adelante debe entrar por este modelo.

---

## 2. Naming explicado de una vez

| Concepto | Nombre familia (UI) | Nombre técnico (código) | Nombre genérico (producto) |
|---|---|---|---|
| El producto en sí | Guía Familiar | — | VantGuide |
| La entidad principal | Función / Rutina / Cosa que toca | `unit_function` / `UnitFunction` | UnitFunction |
| El historial | Tu biblioteca familiar | `evidence_items` | Function Evidence Library |
| La memoria | Lo que la guía recuerda de ti | `memory_items` | Adaptive Memory |
| El perfil | Cómo te gusta que te acompañen | `person_support_profile` | Person Support Profile |
| El scheduler | (invisible) | `unit_function_scheduler` | UnitFunction Scheduler |
| Las recompensas | Estímulos / Logros | `reward_rules` + `reward_events` | Reward Engine |

**Regla**: el código siempre usa el nombre técnico (`unit_function`). La UI familia usa el nombre cálido (`Función`, `Tu rutina`, `La biblioteca de tu hogar`). La UI B2B usa el nombre operacional (`Protocolo operativo`, `Checklist`, `Tarea técnica`). El **mismo backend** sirve a las tres vistas.

---

## 3. El modelo conceptual en una sola página

```
                       ┌─────────────────────────────────┐
                       │            UnitFunction          │
                       │  (study, medication, hygiene,   │
                       │   home_chore, work_task, etc.)  │
                       └────────┬───────────────────┬────┘
                                │                   │
                ┌───────────────┘                   └────────────────┐
                │                                                    │
        ┌───────▼────────┐                                   ┌───────▼────────┐
        │ FunctionEvent  │ scheduled / reminded /            │ EvidenceItem   │ checkin /
        │   (timeline)   │ completed / missed / escalated /  │ (qué pasó      │ photo /
        │                │ rewarded / failed / improved /    │  realmente)    │ voice /
        │                │ caregiver_reviewed                │                │ document /
        └───────┬────────┘                                   │                │ ai_summary
                │                                            └───────┬────────┘
                │                                                    │
                └─────────────────────┬──────────────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │  ProgressSnapshot     │  cumplimiento por categoría,
                          │  (lo agregado)        │  tendencia, observaciones IA
                          └───────────┬───────────┘
                                      │
                          ┌───────────▼───────────┐
                          │      MemoryItem       │  preferencias, patrones,
                          │  (lo que aprendimos)  │  rutinas, aprendizajes
                          └───────────────────────┘                  negativos

  ┌─────────────────────────┐                ┌─────────────────────────┐
  │  PersonSupportProfile   │ adapta toda    │     RewardRule          │ define cuándo
  │  (cómo acompañar a X)   │ la guía a la   │     (qué se reconoce)   │ y cómo se
  │                         │ persona        │                         │ reconoce
  └─────────────────────────┘                └─────────────────────────┘
```

Cada flecha es una relación 1:N. Cada entidad respeta `household_id` o `organization_id` para tenancy. Cada entidad respeta `visible_to_roles` para permisos.

---

## 4. La entidad central: `UnitFunction`

Una **UnitFunction** representa cualquier cosa que una persona o rol debe cumplir dentro de su unidad. No importa si es estudiar para una prueba, tomar Losartán a las 08:00, llamar a la madre el domingo, cumplir un protocolo de seguridad minero, pagar la cuenta de luz, o tomar una pausa sensorial.

### 4.1 Campos del modelo

```text
unit_function {
  id                       UUID PK
  household_id             FK households (NULL si organization)
  organization_id          FK organizations (NULL si household familia)
  person_id                FK persons        # a quién le toca
  responsible_person_id    FK persons NULL   # quién supervisa (padre, cuidador, jefe)
  category                 enum function_category
  title                    text              # "Tomar Losartán 50mg"
  description              text NULL         # contexto adicional
  source_type              enum source_type  # de dónde vino
  source_document_id       FK logbook_entries NULL  # circular, receta, etc.
  due_at                   timestamp NULL    # cuándo vence (puntual)
  schedule                 json NULL         # cron-like: {times:["08:00","20:00"], days:[1,2,3,4,5,6,7], tz:"America/Santiago"}
  recurrence               text NULL         # "daily" / "weekly:mon,wed" / "once"
  status                   enum status       # open / in_progress / done / cancelled / superseded
  priority                 enum priority     # low / medium / high / urgent
  supervision_level        enum             # autonomous / reminder_only / supervised / co_executed
  support_mode             enum NULL        # tap / voice / photo / caregiver_confirm / passive
  evidence_required        boolean          # ¿hay que registrar evidencia?
  reward_rule_id           FK reward_rules NULL
  alert_rule_id            FK alert_rules NULL
  created_by               FK users         # quién la creó (usuario o IA)
  created_by_ai            boolean          # tool-call del asistente?
  metadata                 json             # extensible por categoría
  audit_trail              json             # cambios consecutivos
  created_at, updated_at   timestamp
}
```

### 4.2 Categorías (enum `function_category`)

```text
study                  preparar prueba, hacer tarea, repasar, leer
medication             tomar pastilla, aplicar inyección, control de glicemia
health_routine         control médico, glicemia, presión, kinesiología
hygiene                bañarse, cepillarse, cambio de ropa
nutrition              comer, hidratarse, mealplan
sleep                  rutina de sueño, hora de dormir, despertarse
home_chore             hacer la cama, limpiar, lavar ropa
appointment            asistir a médico, reunión apoderados, hora con dentista
document_deadline      vence licencia, vence receta, renovar carnet
finance                pagar cuenta, registrar gasto, revisar presupuesto
social_connection      llamar a familiar, visitar abuela, mensaje a amigo
calm_regulation        pausa sensorial, respiración, música de calma
exercise               caminar, gimnasio, fisioterapia
caregiver_task         tarea para el cuidador (no para el cuidado)
work_task              tarea laboral genérica (B2B)
operational_protocol   protocolo de seguridad, checklist HSE (B2B)
safety_check           verificación de seguridad (B2B)
```

### 4.3 Fuentes de ingesta (enum `source_type`)

```text
school_notice          circular del colegio
university_assignment  entrega universitaria
prescription           receta médica escaneada
doctor_instruction     indicación verbal/escrita del médico
caregiver_instruction  instrucción del cuidador
family_rule            regla doméstica ("baño antes de la cama")
manual_entry           entrada manual desde la app
uploaded_document      documento subido sin clasificación
voice_note             nota de voz dictada
photo                  foto que dispara función
calendar_event         evento sincronizado de Google/Outlook
email_inbound          mail forwardeado a inbox-<user>@vantdomus.com
whatsapp_inbound       mensaje WA reenviado al bot
ai_suggestion          la IA propone una función
b2b_protocol           protocolo cargado desde un manual operacional
operational_event      sensor / lectura que dispara una función
```

### 4.4 Por qué `category` y `source_type` son separados

Porque la misma fuente puede generar funciones de distinta categoría. Una **circular escolar** (`source_type=school_notice`) puede crear funciones de:

- `study` ("Diego: repasar fracciones lunes")
- `appointment` ("Camila: reunión apoderados jueves 19h")
- `finance` ("Pagar cuota actividades extra")

Y la misma categoría puede venir de muchas fuentes. Una función `medication` puede venir de `prescription` (receta escaneada), `doctor_instruction` (dictada por la familia), o `manual_entry` (la abuela tipea su pastilla).

---

## 5. Lo que existe del lado de la persona: `PersonSupportProfile`

La guía no es uniforme. Adapta su tono, su frecuencia de recordatorio, su forma de verificar y su forma de premiar a la persona específica.

### 5.1 Disciplina de lenguaje (CRÍTICO)

**Este perfil NO es un diagnóstico clínico**. Llamamos al campo `attention_profile`, **no** `tdah_severity`. Llamamos `calm_tools`, **no** `anxiety_disorder`. Llamamos `memory_support_level`, **no** `early_dementia`.

La regla: este perfil describe **cómo acompañar mejor** a la persona, no qué condición tiene. El lenguaje habla de **preferencias**, **apoyo**, **herramientas**, **estilo de comunicación**. Nunca de patologías.

Esto es legal (no somos health provider regulado), ético (no diagnosticamos sin licencia) y product-friendly (la familia llena los campos sin sentir que está rotulando).

### 5.2 Campos

```text
person_support_profile {
  person_id              FK persons (PK)
  household_id           FK households
  age_group              enum: child | teen | adult | senior
  role_in_unit           text: "padre", "madre", "hijo", "abuela", "operario", "supervisor"
  communication_style    enum: short | step_by_step | warm | direct | playful | formal
  supervision_level      enum: autonomous | light_reminder | guided | accompanied
  motivation_style       enum: rewards | praise | progress_bar | quiet_completion | competitive | shared_goal
  reward_preferences     json: [{kind: "screen_time"}, {kind: "money", currency:"CLP"}, ...]
  sensory_preferences    json: {sound: "soft", light: "low", interaction: "single_step"}
  calm_tools             json: ["soft_music", "white_noise", "breathing_guide", "pomodoro"]
  study_style            enum: focused_blocks | short_bursts | visual | auditory | repetition
  health_notes           text NULL: observaciones de la familia
  caregiver_notes        text NULL: observaciones del cuidador
  accessibility_needs    json: {screen_reader: true, large_text: true, ...}
  memory_support_level   enum: none | light | structured | high
  attention_profile      enum: stable | variable | benefits_from_structure
  anxiety_support        enum: not_required | gentle | structured
  neurodiversity_support enum: not_declared | declared_general | structured
  loneliness_risk        enum: low | medium | high
  preferred_voice_profile text NULL  # futuro: si la familia eligió "voz_dulce"
  preferred_devices      json NULL   # futuro: ["watch", "phone", "tablet"]
  consent_version        text        # versión de TOS+privacy que la persona/familia aceptó
  updated_at             timestamp
}
```

### 5.3 Quién puede ver / editar

- La persona dueña del perfil puede ver todo.
- El **responsible_person** (padre/cuidador) puede ver todo si el dueño es menor de edad o tiene consentimiento explícito de delegación.
- Otros miembros del household ven solo `communication_style`, `motivation_style` y `accessibility_needs` (los campos no-sensibles que ayudan a interactuar).
- El asistente IA recibe solo los campos relevantes para el contexto de la consulta (no recibe `health_notes` para preparar una compra de supermercado).

---

## 6. La biblioteca: `EvidenceItem` + `FunctionEvent`

La biblioteca **separa dos cosas que la gente confunde**:

- **FunctionEvent** registra qué **pasó con la función misma** (fue programada, fue recordada, fue completada, fue saltada).
- **EvidenceItem** registra **prueba concreta** de lo que pasó (foto, voz, documento, confirmación del cuidador, resumen IA).

Una función puede tener muchos FunctionEvents (uno por cada recordatorio, cada check-in, cada vez que fue postergada) y muchos EvidenceItems (la foto del cuaderno terminado, la voz diciendo "tomé la pastilla", el resumen que la IA generó tras la sesión de estudio).

### 6.1 `function_events`

```text
function_event {
  id                  UUID PK
  unit_function_id    FK unit_functions
  household_id        FK households
  organization_id     FK organizations NULL
  event_type          enum: scheduled | reminded | completed | missed |
                            postponed | escalated | rewarded | failed |
                            improved | caregiver_reviewed | superseded
  scheduled_for       timestamp NULL
  actual_at           timestamp
  payload             json
  triggered_by        enum: scheduler | user | caregiver | ai | sensor | external
  dedupe_key          text UNIQUE (function_id, scheduled_for, event_type)
  created_at          timestamp
}
```

El `dedupe_key` es crítico: si el scheduler corre dos veces, no inserta dos `reminder_due` para la misma función a la misma hora.

### 6.2 `evidence_items`

```text
evidence_item {
  id                  UUID PK
  unit_function_id    FK unit_functions NULL  # NULL si es evidencia no asociada
  function_event_id   FK function_events NULL
  person_id           FK persons NULL
  household_id        FK households
  organization_id     FK organizations NULL
  evidence_type       enum (ver abajo)
  text_content        text NULL
  attachment_url      text NULL
  attachment_name     text NULL
  metadata            json
  confidence          real NULL        # si la evidencia vino de OCR/IA, qué tan confiable
  visible_to_roles    json: ["self", "responsible", "household", "doctor_link"]
  created_by          FK users
  created_at          timestamp
}
```

### 6.3 Tipos de evidencia

```text
checkin_confirmed         "marqué que sí"
checkin_missed            "marqué que no"
voice_confirmation        "lo dijo en voz"
photo_evidence            foto del cuaderno / del pastillero
caregiver_confirmation    el cuidador confirmó
document_uploaded         subió la circular / la receta
assignment_completed      tarea entregada al colegio
quiz_completed            "rendí la prueba"
medication_taken          se confirmó dosis
medication_missed         se confirmó dosis omitida
appointment_attended      asistí a la cita
appointment_missed        falté a la cita
calm_session_completed    terminó la pausa de calma
study_session_completed   terminó la sesión de estudio
reward_granted            se otorgó el premio
alert_triggered           se disparó una alerta
ai_summary                resumen generado por la IA
manual_note               nota libre del usuario
negative_outcome          "esto no funcionó" (importante para el aprendizaje)
improvement_detected      la IA notó una mejora
```

### 6.4 La evidencia negativa importa tanto como la positiva

Un patrón aparecido en otros productos: solo registran lo que se hizo, no lo que no se hizo. Esto sesga el aprendizaje del sistema.

VantGuide registra explícitamente `negative_outcome`. Ejemplo:

> "Diego intentó estudiar de noche y no pudo concentrarse — registramos `negative_outcome`. La memoria graba `routine_pattern: study late = low success`. Cuando la familia/IA propone la próxima sesión, se respeta ese aprendizaje y se sugiere la tarde."

---

## 7. La memoria: `MemoryItem` y por qué vive en VantDomus

### 7.1 Principio inviolable

**La memoria NO vive en el modelo de IA**. La memoria vive en VantDomus. El modelo de IA es un consumidor de memoria que recibe contexto curado por el backend en cada llamada.

¿Por qué importa esto?

- **Permisos**: el backend filtra qué memoria es accesible a qué rol. El modelo no decide.
- **Consentimiento**: cada `memory_item` tiene `consent_scope`. Si el usuario revoca, el backend deja de adjuntarla al prompt.
- **Auditoría**: cada acceso a memoria queda registrado. Si el modelo accede, queda el log.
- **Portabilidad**: si cambiamos de proveedor de LLM, la memoria sobrevive. No hay vendor lock-in.
- **Privacidad**: el modelo no acumula memoria entre sesiones de distintos usuarios. Cada sesión arranca limpia.

### 7.2 Schema

```text
memory_item {
  id                  UUID PK
  person_id           FK persons NULL
  household_id        FK households NULL
  organization_id     FK organizations NULL
  memory_type         enum (ver abajo)
  content             text                  # la memoria en palabras
  importance          real (0.0 - 1.0)      # cuánto pesa cuando se recupera
  source_event_id     FK function_events NULL
  source_evidence_id  FK evidence_items NULL
  consent_scope       json: {visible_to:["self","household"], shareable_with_doctor:false}
  embedding           vector NULL            # futuro: vector index para retrieval semántico
  expires_at          timestamp NULL
  created_at, updated_at timestamp
}
```

### 7.3 Tipos de memoria

```text
preference            "a Diego le funciona estudiar con música de Lofi"
family_story          "el cumpleaños del papá es el 14 de marzo"
routine_pattern       "Elena toma Losartán mejor en el desayuno que en el almuerzo"
health_context        "Elena tuvo bypass en 2021, control de presión es importante"
study_pattern         "bloques de 20 min con descansos cortos funcionan mejor"
motivation_pattern    "elogio público en familia funciona mejor que premio material"
calm_strategy         "ruido blanco baja la ansiedad antes de dormir"
risk_pattern          "Pedro tiende a saltarse el desayuno cuando viaja por trabajo"
social_connection     "los domingos sin llamadas familiares = bajón anímico para Elena"
negative_learning     "estudiar de noche NO funcionó"
improvement           "después de cambiar horario de medicación, adherencia subió de 60% a 92%"
caregiver_note        "el cuidador anotó: la abuela se confunde con dosis dobles"
operational_context   "en faena, el turno noche tiene mayor riesgo de incumplimiento"
```

### 7.4 Cómo entra al prompt del modelo

Cuando un usuario consulta al asistente, el backend hace una rutina así:

1. Identifica `household_id`, `person_id`, `role`, `permissions` del usuario que consulta.
2. Identifica el contexto de la consulta (por palabras, por endpoint, por screen).
3. Consulta `memory_items` filtrados por: `consent_scope.visible_to ⊇ role`, ordenados por `importance * recency_decay`, top-K.
4. Inyecta esas memorias al prompt del modelo bajo una sección clara `## Memoria relevante de la familia`.
5. El modelo responde.
6. Si el modelo decidió ejecutar un tool, el backend ejecuta el tool y registra `assistant_action_log`.
7. Si la respuesta o la acción contienen aprendizaje nuevo (la familia dijo "ah, eso no funciona", la IA detectó una mejora sostenida), el backend crea o actualiza un `memory_item` correspondiente.

Esto es deliberadamente conservador: la memoria nunca llega al modelo sin filtrar y nunca se actualiza sin pasar por backend.

---

## 8. El scheduler común

### 8.1 Diseño (sin runtime por ahora)

El scheduler corre periódicamente (cron / APScheduler / Celery beat — la implementación se elige después). Su trabajo es **producir `function_events` programados** para que el resto del sistema reaccione.

Pseudo-código del loop:

```python
def schedule_pending_functions():
    now = datetime.now(timezone.utc)
    for f in iter_active_unit_functions():
        tz = f.schedule.get("tz") or household_default_tz(f.household_id)
        local_now = now.astimezone(zoneinfo.ZoneInfo(tz))
        scheduled_times = expand_schedule(f.schedule, local_now)

        for t in scheduled_times:
            dedupe = f"{f.id}|{t.isoformat()}|reminder_due"
            insert_function_event_if_new(
                unit_function_id=f.id,
                event_type="reminder_due",
                scheduled_for=t,
                dedupe_key=dedupe,
            )

        # Verificar si pasó el due_at y aún no hay completed/missed
        if needs_missed_marker(f, local_now):
            dedupe = f"{f.id}|{f.due_at}|missed"
            insert_function_event_if_new(
                unit_function_id=f.id,
                event_type="missed",
                scheduled_for=f.due_at,
                dedupe_key=dedupe,
            )

        # Escalation: si 2 missed consecutivos, generar escalation_due
        if consecutive_missed_count(f) >= f.alert_rule.threshold:
            insert_function_event_if_new(... event_type="escalation_due" ...)
```

### 8.2 Eventos que el scheduler emite

```text
reminder_due        toca recordarle (se traduce a push/email/whatsapp)
checkin_due         pedir confirmación
missed              pasó el due_at, no hubo evidencia
escalation_due      hay que avisar al cuidador/responsable
reward_due          se ganó una recompensa
summary_due         es momento del resumen periódico (semanal, mensual)
```

### 8.3 Dispatcher

El dispatcher consume `function_events.event_type=*_due` y los traduce en notificaciones via `notifications.py` (push Expo, email SMTP, WhatsApp Twilio). Esto **ya existe en plumbing** — solo falta atarlo al evento.

### 8.4 Idempotencia es regla

El `dedupe_key` está como UNIQUE en `function_events`. Si el scheduler corre dos veces (porque se reinició el proceso), el segundo INSERT falla y no se duplica el recordatorio.

---

## 9. Recompensas

### 9.1 `reward_rules`

```text
reward_rule {
  id                  UUID PK
  household_id        FK households NULL
  organization_id     FK organizations NULL
  person_id           FK persons NULL       # NULL = aplica a todos
  function_category   enum function_category NULL  # NULL = aplica a todas
  points              int                   # puntos por cumplir
  reward_type         enum: praise | screen_time | money | activity | symbolic
  monetary_value      real NULL             # si reward_type=money
  currency            text NULL             # CLP, USD, ...
  requires_approval   boolean               # ¿el padre/cuidador tiene que aprobar?
  recurrence          enum: per_event | daily_cap | weekly_cap | monthly_cap
  max_per_period      int NULL
  description         text                  # "Estudiar 20 min = +5 pts. 5 sesiones = 30 min de pantalla"
  active              boolean
  created_at, updated_at timestamp
}
```

### 9.2 `reward_events`

Cada vez que se cumple una regla, se crea un `reward_event` con `dedupe_key` para no duplicar. La UI familia/B2B lo muestra como "ganaste X".

### 9.3 Disciplina con el ranking

**No** vamos a hacer ranking competitivo entre personas del household por defecto. Sería injusto comparar el cumplimiento de un niño con TDA con el de un adulto neurotípico.

Lo que sí mostramos:

- **Progreso personal**: "Diego subió de 30% a 70% de cumplimiento de estudio en 4 semanas."
- **Metas familiares compartidas**: "La familia completó 80% de rutinas esta semana."
- **Logros simbólicos**: insignias por categoría, no por persona.

Ranking entre personas solo se activa si la familia lo configura explícitamente, y solo dentro de personas del mismo `age_group`.

---

## 10. Canales y dispositivos: `DeviceBridge`

VantGuide debe estar preparado para recibir entradas y enviar salidas desde múltiples canales. No vamos a implementar todos ahora, pero el modelo no debe quedar encerrado en una sola pantalla.

### 10.1 `channel_type`

```text
web         panel web
mobile      app móvil
tablet      app móvil en tablet (UI puede ser distinta)
voice       comando por voz (futuro: Alexa, Google Assistant)
wearable    smartwatch
email       email forwardeado a inbox-<usuario>@vantdomus.com
whatsapp    WhatsApp Business API
calendar    Google Calendar / Outlook / Apple
sensor      sensor IoT (futuro: pillbox con sensor, sensor de movimiento del abuelo)
manual      entrada manual (importación CSV, etc.)
```

### 10.2 Ingestion → UnitFunction

Cualquier canal entrante termina pasando por un **adapter** que convierte el input en uno (o varios) de:

- `UnitFunction` nueva
- `EvidenceItem` para una función existente
- `MemoryItem`
- `FunctionEvent`
- `Alert`

El `SchoolPlanner` de hoy es exactamente eso: un adapter de canal `web` + `uploaded_document` que clasifica como `study` + crea `UnitFunction(category=study)`. Cuando agreguemos email forwarding, será otro adapter del mismo motor.

---

## 11. Compatibilidad backward — qué pasa con lo existente

### 11.1 `task_items` (tareas) NO se borra

`task_items` sigue funcionando. La compatibilidad se mantiene así:

- Cuando se crea un `unit_function`, el backend **opcionalmente** dual-writes un `task_item` para que las pantallas viejas (kanban web, lista mobile) lo sigan mostrando.
- A medida que las pantallas se actualizan al modelo nuevo, dejan de leer `task_items` y empiezan a leer `unit_functions` directamente.
- Eventualmente `task_items` queda como vista (read-only) sobre `unit_functions`.

### 11.2 `adherence_plans` se mantiene

`adherence_plans` se mantiene como **plan de horarios de medicación** (porque tiene semántica fuerte: drogas, dosis). Pero **cada plan genera una `unit_function(category=medication)`** asociada vía FK opcional.

El scheduler común reemplaza al scheduler-de-medicación-que-nunca-existió. La medicación pasa a ser una categoría de función, no un módulo aparte.

### 11.3 `SchoolPlannerForm` y `/tasks/school_plan`

El endpoint `/tasks/school_plan` se mantiene pero su comportamiento se actualiza:

- ANTES: parseaba texto, generaba 5 `task_items` escalonadas.
- AHORA: parsea texto, llama al nuevo `unit_function_creator` con `category=study`, `source_type=school_notice`, genera 5 `unit_functions` (que internamente también producen `task_items` para retrocompat).
- El form web sigue siendo el mismo flujo visible, pero llama al adapter actualizado.

Eventualmente se renombra a `/functions/from_school_notice` o similar, dejando alias.

### 11.4 `assistant_action_log` se preserva

El log de acciones del asistente sigue intacto. Solo se agregan nuevos tipos de acción (`create_family_function`, `log_function_evidence`, etc.).

---

## 12. Tools nuevos del asistente

```text
_create_family_function(person_id, category, title, source_type, due_at, schedule)
_log_function_evidence(unit_function_id, evidence_type, text/file)
_update_person_memory(person_id, memory_type, content, importance)
_create_reward_event(reward_rule_id, person_id, points)
_create_caregiver_alert(unit_function_id, severity, message, target_role)
_request_caregiver_confirmation(unit_function_id, target_person_id)
_summarize_for_doctor(person_id, date_range)        # genera resumen autorizado
```

Cada tool **deja audit log** y respeta el `PersonSupportProfile` de la persona afectada (no tira recordatorios estilo "URGENTE" a alguien que pidió `communication_style=warm`).

---

## 13. Resumen de cuidado compartible (futuro VantHealthLink)

No se implementa ahora, pero se diseña el modelo compatible.

Un "Resumen de Cuidado" es una **vista derivada** sobre los datos existentes, con scope limitado:

- Medicamentos actuales (de `adherence_plans` activos + `unit_functions(category=medication)`)
- Adherencia agregada (de `progress_snapshots`)
- Citas (de `unit_functions(category=appointment)`)
- Documentos médicos autorizados (de `evidence_items` con scope `doctor_link`)
- Alertas relevantes
- Notas familiares marcadas para compartir
- Preguntas al médico

El acceso del médico es vía **link temporal con consentimiento granular y revocable**. Cada acceso queda auditado. No tiene acceso a finanzas, conversaciones privadas no relevantes ni evidencia marcada como interna.

---

## 14. Lo que NO está en este MVP

Para evitar perderse en el camino, lo que **NO** vamos a construir en este sprint:

- Marketplace de voces / acompañantes humanos / red social
- Integración real con aseguradoras / médicos / wearables / HealthKit / Google Fit
- Licencias de música / sonidos comerciales
- Cambios masivos de UI
- Vector embeddings funcionales para memoria semántica (solo dejamos la columna)
- Implementación runtime del scheduler (lo diseñamos, no necesariamente lo cron-eamos hoy)

Todo eso entra **después**, sobre la arquitectura ya correcta. La extensibilidad es deliberada.

---

## 15. Definition of Done del Sprint VG

Decimos que VantGuide está vivo cuando:

1. Existen las tablas `unit_functions`, `function_events`, `evidence_items`, `memory_items`, `progress_snapshots`, `person_support_profile`, `reward_rules`, `reward_events` y la migración está aplicada en SQLite y diseñada para PG.
2. Existen los endpoints REST mínimos: `POST/GET/PATCH /unit_functions`, `POST /unit_functions/{id}/evidence`, `GET /persons/{id}/library`, `POST /memory_items`, `GET /persons/{id}/profile`.
3. El asistente tiene los tools nuevos en `apps/api/app/assistant/tools.py`.
4. `SchoolPlannerForm` y `/tasks/school_plan` siguen funcionando pero internamente crean `unit_functions(category=study)`.
5. `/demo/seed?mode=home` crea un escenario coherente con el nuevo modelo: Pedro/Camila/Diego/Elena con sus `person_support_profile`, sus `unit_functions` mixed (estudio Diego, medicación Elena, hogar familia), eventos previos en `function_events`, evidencia positiva y negativa en `evidence_items`, memorias relevantes en `memory_items`.
6. Hay tests Python que cubren: creación de función estudio desde input académico, creación de función medicación desde plan, registro de evidencia positiva y negativa, dedupe de eventos programados, filtrado de memoria por rol.
7. La UI familia (web y mobile) muestra el nombre "Guía Familiar" en lugar de "Tasks" donde antes era apropiado. Las pantallas viejas siguen funcionando vía retrocompat.

Cuando esos 7 puntos pasen, **VantDomus ya no tiene un SchoolPlanner aislado**. Tiene la base de VantGuide.

---

## 16. Roadmap inmediato

- **Sprint VG** (este): núcleo del modelo + adapter SchoolPlanner + assistant tools + tests + demo seed.
- **Sprint VG+1**: scheduler runtime (APScheduler in-process), email forwarding, voice ingestion para SchoolPlanner.
- **Sprint VG+2**: progress_snapshots automáticos, resumen de cuidado compartible, integración WhatsApp básica.
- **Sprint VG+3** y más adelante: vector embeddings para memoria semántica, integraciones HealthKit/Google Fit, marketplace de acompañantes humanos (validación de mercado pendiente), VantCalm como herramienta integrada.

---

## 17. Apéndice — Glosario rápido

- **UnitFunction**: cualquier función que una persona/rol debe cumplir (estudio, medicación, hogar, B2B).
- **FunctionEvent**: evento del ciclo de vida de una función (programado, recordado, completado, perdido).
- **EvidenceItem**: prueba concreta (foto, voz, confirmación, documento, resumen IA).
- **MemoryItem**: aprendizaje estructurado de largo plazo (preferencia, patrón, riesgo, mejora).
- **PersonSupportProfile**: cómo acompañar a una persona (no diagnóstico, sí preferencias).
- **RewardRule**: regla declarativa de qué se reconoce y cómo.
- **DeviceBridge** (concepto, no tabla): adapter que convierte input de cualquier canal en entidades VantGuide.
- **VantGuide**: el producto.
- **Guía Familiar**: el nombre visible en familia.
- **VantLibrary**: nombre visible para la biblioteca de evidencia.
- **VantHealthLink**: nombre futuro para el resumen de cuidado compartible.

---

> **Próximo paso de implementación**: VG-2 — migración SQL del núcleo (`apps/api/sqlite_migrations/260_vantguide_core.sql`).
