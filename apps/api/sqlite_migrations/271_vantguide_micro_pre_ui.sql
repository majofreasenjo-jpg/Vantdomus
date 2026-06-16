-- =============================================================================
-- 271_vantguide_micro_pre_ui.sql
--
-- Micro-ajustes pre Sprint VG+2 (UI) basados en la evaluación de Codex
-- post VG+1. Cambios pequeños, no destructivos, todos opcionales.
--
-- Doc: docs/VANTGUIDE_ARCHITECTURE.md §18.8 (Micro-ajustes pre-UI)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- escalation_delay_minutes opcional por responsable.
--
-- Codex 5.3: la semántica ordinal está bien, pero conviene permitir que cada
-- responsable tenga un override de cuánto esperar antes de escalar al
-- siguiente nivel. Cuando es NULL, el dispatcher usa
-- household.meta.default_escalation_step_minutes (o 15 por default).
-- -----------------------------------------------------------------------------
ALTER TABLE unit_function_responsibles
  ADD COLUMN escalation_delay_minutes INTEGER;


-- -----------------------------------------------------------------------------
-- VISTA conceptual (sin VIEW SQL, doc):
--
-- v_responsibles_escalation_with_default:
--   SELECT r.*,
--          COALESCE(
--              r.escalation_delay_minutes,
--              (SELECT json_extract(h.meta, '$.default_escalation_step_minutes')
--                 FROM households h WHERE h.id = uf.household_id),
--              15  -- fallback global
--          ) AS effective_delay_minutes
--   FROM unit_function_responsibles r
--   JOIN unit_functions uf ON uf.id = r.unit_function_id;
--
-- El dispatcher (cuando se atte runtime) usa effective_delay_minutes para
-- decidir cuánto esperar antes de pasar al escalation_order siguiente.
-- =============================================================================
