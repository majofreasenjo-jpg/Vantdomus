-- =============================================================================
-- 270_vantguide_runtime_v1.sql
--
-- Sprint VG+1: Consolidación del núcleo VantGuide antes de avanzar a UI,
-- email forwarding o integraciones externas. Documento de decisiones:
-- docs/VANTGUIDE_ARCHITECTURE.md §18 (Consolidación VG+1).
--
-- Esta migración es **incremental sobre 260_vantguide_core.sql**. No edita
-- destructivamente las tablas anteriores; solo agrega columnas/tablas/índices
-- nuevos. SQLite acepta `ALTER TABLE ADD COLUMN` sin reescribir la tabla.
--
-- Aplica a:
--   * unit_functions      — version, AI confidence + confirmación humana,
--                           cross-link opcional a primary evidence
--   * function_events     — cross-link opcional a evidence + índice UNIQUE
--                           compuesto parcial para dedupe robusto
--   * evidence_items      — cross-link explícito a function_event
--   * NUEVO: unit_function_versions     — snapshot histórico de cada función
--   * NUEVO: unit_function_responsibles — múltiples responsables / cuidadores
--   * NUEVO: scheduler_runs             — métricas + lock fallback para SQLite
-- =============================================================================


-- -----------------------------------------------------------------------------
-- unit_functions: versionado + AI confidence + cross-link evidence
-- -----------------------------------------------------------------------------
ALTER TABLE unit_functions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- AI confidence — la IA puede crear sugerencias con distintos niveles de
-- certeza. Para medicamentos, aunque ai_confidence sea alta, NO se activa
-- el scheduler hasta que un humano confirme (ver scheduler.tick()).
ALTER TABLE unit_functions ADD COLUMN ai_confidence REAL;             -- 0.0 - 1.0
ALTER TABLE unit_functions ADD COLUMN ai_needs_confirmation INTEGER NOT NULL DEFAULT 0;  -- bool
ALTER TABLE unit_functions ADD COLUMN ai_extraction_source TEXT;      -- 'ocr_receta', 'voice_dictation', 'email_inbound', ...
ALTER TABLE unit_functions ADD COLUMN ai_explanation TEXT;            -- texto libre: por qué la IA cree esto

-- Confirmación humana — quién y cuándo dijo "sí, está bien, activá esto".
ALTER TABLE unit_functions ADD COLUMN confirmed_by_user_id TEXT;
ALTER TABLE unit_functions ADD COLUMN confirmed_at TEXT;              -- ISO 8601 UTC

-- Cross-link opcional: la evidencia "principal" que respalda el estado
-- actual de la función. Una función puede tener muchas evidencias, pero
-- una sola "principal" (la más reciente y autoritativa).
ALTER TABLE unit_functions ADD COLUMN primary_evidence_id TEXT;


-- -----------------------------------------------------------------------------
-- function_events ↔ evidence_items: cross-link bidireccional
--
-- Mantenemos las dos tablas separadas (decisión 1 de Codex), pero permitimos
-- relación opcional cruzada para que un evento `completed` o `missed` pueda
-- apuntar a una evidencia concreta sin mezclar semánticas.
-- -----------------------------------------------------------------------------
ALTER TABLE function_events ADD COLUMN primary_evidence_id TEXT;       -- FK opcional a evidence_items
-- evidence_items.function_event_id ya existe en migración 260. Mantenido.


-- -----------------------------------------------------------------------------
-- function_events: índice UNIQUE compuesto parcial
--
-- Decisión 3 de Codex: idempotencia en DB con compuesto, no dedupe en
-- memoria. SQLite soporta UNIQUE INDEX parcial con WHERE clause desde 3.8.0.
-- Postgres también. Esto reemplaza la dependencia exclusiva en `dedupe_key`
-- (que queda como fallback para eventos especiales como escalation_due_ai
-- generados manualmente por el assistant).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_function_event_dedupe_composite
  ON function_events (unit_function_id, scheduled_for, event_type)
  WHERE scheduled_for IS NOT NULL;


-- -----------------------------------------------------------------------------
-- TABLA NUEVA: unit_function_versions
--
-- Snapshot histórico completo de cada UnitFunction. Cuando un PATCH cambia
-- una función, ANTES del UPDATE se inserta una fila acá con el estado
-- previo. Esto habilita la Biblioteca de Evolución:
--   "Antes Elena tenía Losartán 8:00/20:00. Cambiamos a 8:00 y la adherencia
--    mejoró 32% en 4 semanas."
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unit_function_versions (
  id                       TEXT PRIMARY KEY,
  unit_function_id         TEXT NOT NULL,
  version                  INTEGER NOT NULL,
  snapshot_json            TEXT NOT NULL,        -- estado completo previo
  changed_by_user_id       TEXT,                 -- NULL si lo cambió la IA
  changed_by_ai            INTEGER NOT NULL DEFAULT 0,  -- bool
  change_reason            TEXT,                 -- 'horario_optimo', 'pedido_familia', 'no_funcionaba', ...
  change_source            TEXT,                 -- 'manual', 'assistant_tool', 'scheduler', 'caregiver_review'
  created_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ufv_function    ON unit_function_versions(unit_function_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_ufv_created     ON unit_function_versions(created_at DESC);


-- -----------------------------------------------------------------------------
-- TABLA NUEVA: unit_function_responsibles
--
-- Decisión 8 de Codex: preparar múltiples responsables/cuidadores. Por
-- compatibilidad backward, `unit_functions.responsible_person_id` se
-- mantiene como "responsable primario". Esta tabla agrega:
--   * orden de escalation
--   * permisos de confirm/edit
--   * rol explícito
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unit_function_responsibles (
  id                       TEXT PRIMARY KEY,
  unit_function_id         TEXT NOT NULL,
  person_id                TEXT NOT NULL,
  responsibility_role      TEXT NOT NULL,    -- primary_caregiver | secondary_caregiver | parent | guardian | doctor_viewer | supervisor | reviewer | escalation_contact
  escalation_order         INTEGER NOT NULL DEFAULT 1,
  notify                   INTEGER NOT NULL DEFAULT 1,    -- bool
  can_confirm              INTEGER NOT NULL DEFAULT 0,    -- bool: puede aprobar funciones IA
  can_edit                 INTEGER NOT NULL DEFAULT 0,    -- bool: puede modificar la función
  created_at               TEXT NOT NULL,
  UNIQUE(unit_function_id, person_id, responsibility_role)
);

CREATE INDEX IF NOT EXISTS idx_ufr_function     ON unit_function_responsibles(unit_function_id, escalation_order);
CREATE INDEX IF NOT EXISTS idx_ufr_person       ON unit_function_responsibles(person_id);


-- -----------------------------------------------------------------------------
-- TABLA NUEVA: scheduler_runs
--
-- Métricas + lock fallback de cada ejecución del scheduler. En Postgres
-- usamos `pg_try_advisory_lock(...)` para impedir dos ticks simultáneos.
-- En SQLite no hay advisory locks, así que esta tabla actúa como lock
-- explícito: la columna `lease_until` representa "esta tick aún está
-- corriendo, no arrancar otra hasta que pase ese timestamp".
--
-- Logs/métricas:
--   * scanned        funciones examinadas
--   * events_created reminders/missed/etc. emitidos
--   * duplicates_skipped     eventos que el dedupe rechazó
--   * missed_emitted, escalations_emitted
--   * errors         errores no fatales durante el tick
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduler_runs (
  id                       TEXT PRIMARY KEY,
  started_at               TEXT NOT NULL,
  finished_at              TEXT,                  -- NULL mientras corre
  lease_until              TEXT,                  -- NULL cuando termina; timestamp ISO mientras corre
  host                     TEXT,                  -- hostname / container id que ejecuta
  status                   TEXT NOT NULL DEFAULT 'running',  -- running | done | error | skipped_locked
  functions_scanned        INTEGER NOT NULL DEFAULT 0,
  reminder_due_emitted     INTEGER NOT NULL DEFAULT 0,
  missed_emitted           INTEGER NOT NULL DEFAULT 0,
  escalations_emitted      INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped       INTEGER NOT NULL DEFAULT 0,
  errors                   INTEGER NOT NULL DEFAULT 0,
  error_detail             TEXT,
  metrics_json             TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sched_runs_started ON scheduler_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sched_runs_status  ON scheduler_runs(status, started_at DESC);


-- -----------------------------------------------------------------------------
-- VISTAS conceptuales (no creadas como VIEW; documentación):
--
-- v_unit_functions_pending_ai_confirmation:
--   SELECT * FROM unit_functions
--   WHERE created_by_ai=1
--     AND ai_needs_confirmation=1
--     AND confirmed_at IS NULL
--     AND status IN ('open','in_progress');
--   El scheduler debe SALTAR estas funciones cuando emite reminder_due.
--
-- v_function_evolution:
--   JOIN unit_function_versions sobre la misma unit_function_id para
--   mostrar el historial de cambios y permitir narrar la evolución
--   ("antes Elena tenía X, cambiamos a Y, mejoró Z%").
--
-- v_responsible_escalation_chain:
--   SELECT * FROM unit_function_responsibles
--   WHERE notify=1
--   ORDER BY unit_function_id, escalation_order ASC;
--   El dispatcher usa esto para escalar en orden cuando se emite
--   escalation_due.
-- =============================================================================
