-- =============================================================================
-- 260_vantguide_core.sql
--
-- VantGuide — núcleo transversal de funciones, eventos, evidencia, memoria,
-- perfil adaptativo y recompensas. Reemplaza conceptualmente al SchoolPlanner
-- aislado y al scheduler-de-medicación-que-nunca-existió.
--
-- Documento de diseño: docs/VANTGUIDE_ARCHITECTURE.md
--
-- Reglas de compatibilidad:
--   * NO borrar `task_items` ni `adherence_plans`.
--   * NO cambiar columnas existentes; solo agregar tablas y FKs opcionales.
--   * `unit_functions` puede dual-write contra `task_items` desde código.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TABLA: unit_functions
-- Entidad central. Cualquier "cosa que toca cumplir" — estudio, medicación,
-- rutina hogar, protocolo B2B, etc. Reemplaza conceptualmente el patrón de
-- módulos separados (SchoolPlanner / Medication / Tasks) por una sola entidad.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unit_functions (
  id                       TEXT PRIMARY KEY,
  household_id             TEXT,                    -- NULL si la unidad es B2B (organization)
  organization_id          TEXT,                    -- NULL si household familia
  person_id                TEXT NOT NULL,           -- a quién le toca
  responsible_person_id    TEXT,                    -- quién supervisa (padre, cuidador, jefe)
  category                 TEXT NOT NULL,           -- function_category enum
  title                    TEXT NOT NULL,
  description              TEXT,
  source_type              TEXT NOT NULL DEFAULT 'manual_entry',
  source_document_id       TEXT,                    -- FK opcional a logbook_entries u otro
  due_at                   TEXT,                    -- ISO 8601 UTC
  schedule                 TEXT NOT NULL DEFAULT '{}',  -- JSON: cron-like, ver doc
  recurrence               TEXT,                    -- daily / weekly:mon,wed / once / cron:...
  status                   TEXT NOT NULL DEFAULT 'open',  -- open|in_progress|done|cancelled|superseded
  priority                 TEXT NOT NULL DEFAULT 'medium', -- low|medium|high|urgent
  supervision_level        TEXT NOT NULL DEFAULT 'reminder_only', -- autonomous|reminder_only|supervised|co_executed
  support_mode             TEXT,                    -- tap|voice|photo|caregiver_confirm|passive
  evidence_required        INTEGER NOT NULL DEFAULT 0,  -- bool 0/1
  reward_rule_id           TEXT,                    -- FK opcional
  alert_rule_id            TEXT,                    -- FK opcional (futuro)
  legacy_task_id           TEXT,                    -- FK a task_items si se hizo dual-write
  legacy_adherence_plan_id INTEGER,                 -- FK a adherence_plans si proviene de plan
  created_by_user_id       TEXT NOT NULL,
  created_by_ai            INTEGER NOT NULL DEFAULT 0,  -- bool: tool-call del asistente?
  metadata                 TEXT NOT NULL DEFAULT '{}',  -- JSON extensible
  audit_trail              TEXT NOT NULL DEFAULT '[]',  -- JSON array de cambios
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uf_household       ON unit_functions(household_id);
CREATE INDEX IF NOT EXISTS idx_uf_organization    ON unit_functions(organization_id);
CREATE INDEX IF NOT EXISTS idx_uf_person          ON unit_functions(person_id);
CREATE INDEX IF NOT EXISTS idx_uf_status_due      ON unit_functions(status, due_at);
CREATE INDEX IF NOT EXISTS idx_uf_category        ON unit_functions(category);
CREATE INDEX IF NOT EXISTS idx_uf_source          ON unit_functions(source_type, source_document_id);
CREATE INDEX IF NOT EXISTS idx_uf_legacy_task     ON unit_functions(legacy_task_id);


-- -----------------------------------------------------------------------------
-- TABLA: function_events
-- Timeline de cada función. El scheduler común inserta `reminder_due` y
-- `missed`. La UI registra `completed`/`postponed`. La IA registra
-- `improved`/`escalated`/`rewarded`. El dispatcher consume `*_due`.
--
-- IDEMPOTENCIA: `dedupe_key` es UNIQUE para evitar duplicar recordatorios
-- cuando el scheduler corre dos veces.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS function_events (
  id                  TEXT PRIMARY KEY,
  unit_function_id    TEXT NOT NULL,
  household_id        TEXT,
  organization_id     TEXT,
  event_type          TEXT NOT NULL,    -- scheduled|reminded|reminder_due|checkin_due|completed|missed|postponed|escalated|escalation_due|rewarded|reward_due|failed|improved|caregiver_reviewed|superseded|summary_due
  scheduled_for       TEXT,             -- ISO 8601 UTC para eventos *_due / scheduled
  actual_at           TEXT NOT NULL,
  payload             TEXT NOT NULL DEFAULT '{}',
  triggered_by        TEXT NOT NULL DEFAULT 'system', -- scheduler|user|caregiver|ai|sensor|external|system
  triggered_by_user_id TEXT,            -- NULL si triggered_by=scheduler/ai/sensor
  dedupe_key          TEXT NOT NULL UNIQUE,  -- function_id|scheduled_for|event_type
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fe_unit_function   ON function_events(unit_function_id, actual_at DESC);
CREATE INDEX IF NOT EXISTS idx_fe_household       ON function_events(household_id, actual_at DESC);
CREATE INDEX IF NOT EXISTS idx_fe_event_type      ON function_events(event_type, scheduled_for);


-- -----------------------------------------------------------------------------
-- TABLA: evidence_items
-- Biblioteca de Evidencia. Toda prueba concreta de qué pasó realmente:
-- fotos del cuaderno, voz "tomé la pastilla", documentos subidos, confirmación
-- del cuidador, resúmenes generados por IA, notas manuales.
--
-- LA EVIDENCIA NEGATIVA IMPORTA TANTO COMO LA POSITIVA. Tipos como
-- `negative_outcome`, `medication_missed`, `appointment_missed` son
-- ciudadanos de primera clase. El sistema aprende de lo que NO funcionó.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_items (
  id                       TEXT PRIMARY KEY,
  unit_function_id         TEXT,         -- NULL si la evidencia no está asociada a una función
  function_event_id        TEXT,         -- NULL si no aplica
  person_id                TEXT,         -- a quién pertenece la evidencia
  household_id             TEXT,
  organization_id          TEXT,
  evidence_type            TEXT NOT NULL, -- checkin_confirmed|checkin_missed|voice_confirmation|photo_evidence|caregiver_confirmation|document_uploaded|assignment_completed|quiz_completed|medication_taken|medication_missed|appointment_attended|appointment_missed|calm_session_completed|study_session_completed|reward_granted|alert_triggered|ai_summary|manual_note|negative_outcome|improvement_detected
  text_content             TEXT,         -- nota libre / descripción
  attachment_url           TEXT,         -- ruta a archivo en private_uploads
  attachment_name          TEXT,
  attachment_mime          TEXT,
  metadata                 TEXT NOT NULL DEFAULT '{}',
  confidence               REAL,         -- 0.0-1.0 si vino de OCR/IA
  visible_to_roles         TEXT NOT NULL DEFAULT '["self","responsible","household"]',  -- JSON array
  created_by_user_id       TEXT NOT NULL,
  created_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ev_unit_function   ON evidence_items(unit_function_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ev_person          ON evidence_items(person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ev_household       ON evidence_items(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ev_type            ON evidence_items(evidence_type);


-- -----------------------------------------------------------------------------
-- TABLA: memory_items
-- Memoria estructurada de largo plazo. CRÍTICO: vive en VantDomus, NO en el
-- modelo de IA. El backend filtra qué memoria se adjunta al prompt según
-- rol y consentimiento.
--
-- La memoria negativa (negative_learning) y las mejoras (improvement) son
-- explícitamente parte del esquema. El sistema aprende qué NO funcionó.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memory_items (
  id                       TEXT PRIMARY KEY,
  person_id                TEXT,         -- NULL si la memoria es de toda la familia/unidad
  household_id             TEXT,
  organization_id          TEXT,
  memory_type              TEXT NOT NULL, -- preference|family_story|routine_pattern|health_context|study_pattern|motivation_pattern|calm_strategy|risk_pattern|social_connection|negative_learning|improvement|caregiver_note|operational_context
  content                  TEXT NOT NULL,
  importance               REAL NOT NULL DEFAULT 0.5,  -- 0.0-1.0 — peso al recuperar
  source_event_id          TEXT,         -- FK opcional a function_events
  source_evidence_id       TEXT,         -- FK opcional a evidence_items
  consent_scope            TEXT NOT NULL DEFAULT '{"visible_to":["self","household"],"shareable_with_doctor":false}',  -- JSON
  embedding                TEXT,         -- JSON array de floats — futuro vector index
  expires_at               TEXT,         -- ISO 8601, opcional
  created_by_user_id       TEXT NOT NULL,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mi_person          ON memory_items(person_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_mi_household       ON memory_items(household_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_mi_type            ON memory_items(memory_type);


-- -----------------------------------------------------------------------------
-- TABLA: progress_snapshots
-- Snapshots agregados de evolución por persona+categoría+periodo. Se
-- generan periódicamente (semanal/mensual) por job o on-demand. Permiten
-- mostrar tendencias sin recalcular sobre toda la timeline.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id                       TEXT PRIMARY KEY,
  person_id                TEXT,
  household_id             TEXT,
  organization_id          TEXT,
  category                 TEXT,                  -- function_category o NULL para global
  period_kind              TEXT NOT NULL,         -- day|week|month|quarter
  period_start             TEXT NOT NULL,         -- ISO 8601 UTC
  period_end               TEXT NOT NULL,
  compliance_rate          REAL,                  -- 0.0-1.0
  total_functions          INTEGER NOT NULL DEFAULT 0,
  total_completed          INTEGER NOT NULL DEFAULT 0,
  total_missed             INTEGER NOT NULL DEFAULT 0,
  trend                    TEXT,                  -- improving|stable|declining
  ai_observations          TEXT,                  -- resumen IA del periodo
  strategy_changes         TEXT NOT NULL DEFAULT '[]',  -- JSON array
  recommendations          TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ps_person_period   ON progress_snapshots(person_id, period_kind, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_ps_household       ON progress_snapshots(household_id, period_end DESC);


-- -----------------------------------------------------------------------------
-- TABLA: person_support_profile
-- Perfil de apoyo de una persona — NO es diagnóstico clínico. Describe
-- preferencias de comunicación, estilo de motivación, herramientas de calma.
--
-- DISCIPLINA DE LENGUAJE: ningún campo se llama por una patología (ej. no
-- existe `anxiety_disorder_severity`). Se usa `anxiety_support`, `calm_tools`,
-- `attention_profile`. La app NO diagnostica.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS person_support_profile (
  person_id                TEXT PRIMARY KEY,
  household_id             TEXT,
  organization_id          TEXT,
  age_group                TEXT,                  -- child|teen|adult|senior
  role_in_unit             TEXT,                  -- libre: "padre", "madre", "hijo", "abuela", "operario"
  communication_style      TEXT NOT NULL DEFAULT 'warm', -- short|step_by_step|warm|direct|playful|formal
  supervision_level        TEXT NOT NULL DEFAULT 'light_reminder', -- autonomous|light_reminder|guided|accompanied
  motivation_style         TEXT NOT NULL DEFAULT 'progress_bar',  -- rewards|praise|progress_bar|quiet_completion|competitive|shared_goal
  reward_preferences       TEXT NOT NULL DEFAULT '[]',   -- JSON array
  sensory_preferences      TEXT NOT NULL DEFAULT '{}',   -- JSON: {sound:"soft", light:"low", interaction:"single_step"}
  calm_tools               TEXT NOT NULL DEFAULT '[]',   -- JSON: ["soft_music","breathing_guide","pomodoro"]
  study_style              TEXT,                  -- focused_blocks|short_bursts|visual|auditory|repetition
  health_notes             TEXT,                  -- visible solo a self+responsible+doctor_link
  caregiver_notes          TEXT,                  -- visible solo a responsible+caregiver
  accessibility_needs      TEXT NOT NULL DEFAULT '{}',   -- JSON: {screen_reader:true, large_text:true}
  memory_support_level     TEXT,                  -- none|light|structured|high
  attention_profile        TEXT,                  -- stable|variable|benefits_from_structure
  anxiety_support          TEXT,                  -- not_required|gentle|structured
  neurodiversity_support   TEXT NOT NULL DEFAULT 'not_declared', -- not_declared|declared_general|structured
  loneliness_risk          TEXT NOT NULL DEFAULT 'low',          -- low|medium|high
  preferred_voice_profile  TEXT,                  -- futuro: avatar de voz
  preferred_devices        TEXT NOT NULL DEFAULT '[]',   -- JSON array
  consent_version          TEXT,                  -- versión de TOS+privacy aceptada
  updated_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_psp_household      ON person_support_profile(household_id);


-- -----------------------------------------------------------------------------
-- TABLA: reward_rules
-- Reglas declarativas de qué se reconoce y cómo. Aplican a cualquier
-- categoría de función. NO solo académico — también hogar, salud, rutinas,
-- protocolos B2B.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_rules (
  id                       TEXT PRIMARY KEY,
  household_id             TEXT,
  organization_id          TEXT,
  person_id                TEXT,                  -- NULL = aplica a todas las personas
  function_category        TEXT,                  -- NULL = aplica a todas las categorías
  points                   INTEGER NOT NULL DEFAULT 0,
  reward_type              TEXT NOT NULL DEFAULT 'praise',  -- praise|screen_time|money|activity|symbolic
  monetary_value           REAL,
  currency                 TEXT,
  requires_approval        INTEGER NOT NULL DEFAULT 1,  -- bool: ¿padre/cuidador aprueba?
  recurrence               TEXT NOT NULL DEFAULT 'per_event', -- per_event|daily_cap|weekly_cap|monthly_cap
  max_per_period           INTEGER,
  description              TEXT NOT NULL,
  active                   INTEGER NOT NULL DEFAULT 1,  -- bool
  created_by_user_id       TEXT NOT NULL,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rr_household       ON reward_rules(household_id, active);
CREATE INDEX IF NOT EXISTS idx_rr_person          ON reward_rules(person_id, active);
CREATE INDEX IF NOT EXISTS idx_rr_category        ON reward_rules(function_category, active);


-- -----------------------------------------------------------------------------
-- TABLA: reward_events
-- Cada vez que una RewardRule se cumple, se crea un reward_event. dedupe_key
-- evita duplicar la misma recompensa por el mismo evento.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_events (
  id                       TEXT PRIMARY KEY,
  reward_rule_id           TEXT NOT NULL,
  person_id                TEXT NOT NULL,
  household_id             TEXT,
  organization_id          TEXT,
  source_function_id       TEXT,                  -- FK a unit_function que generó el evento
  source_event_id          TEXT,                  -- FK a function_events
  points                   INTEGER NOT NULL DEFAULT 0,
  reward_type              TEXT NOT NULL,
  monetary_value           REAL,
  currency                 TEXT,
  status                   TEXT NOT NULL DEFAULT 'granted',  -- pending_approval|granted|denied|redeemed
  approved_by_user_id      TEXT,
  approved_at              TEXT,
  redeemed_at              TEXT,
  dedupe_key               TEXT NOT NULL UNIQUE,  -- rule_id|event_id
  created_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_re_person          ON reward_events(person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_household       ON reward_events(household_id, status);


-- -----------------------------------------------------------------------------
-- VISTA conceptual (no creada como VIEW SQL ahora, queda como nota):
--
-- v_active_unit_functions:
--   SELECT * FROM unit_functions
--   WHERE status IN ('open', 'in_progress')
--     AND (due_at IS NULL OR due_at >= datetime('now', '-1 day'));
--
-- v_person_compliance_30d:
--   agregado de function_events por person+category en los últimos 30 días.
--
-- v_household_care_summary:
--   agregado para el "Resumen de Cuidado" futuro (VantHealthLink).
--
-- Las vistas se materializan en el endpoint correspondiente, no en SQL.
-- =============================================================================
