-- CP1c-FUNC-MIN-3.1 — Proposal Store del AI Orchestrator seguro de Domi.
--
-- Domi NO ejecuta acciones directamente. Cuando una intención implica una
-- acción con side-effects, el orquestador crea una PROPUESTA aquí (status
-- 'pending'). Un humano la confirma o la rechaza. Solo al confirmar se ejecuta
-- la acción real (y queda status 'executed'). Es el mismo espíritu que
-- document_route_candidates (Bandeja Inteligente), generalizado al asistente.
--
-- Estados: pending -> confirmed -> executed | failed ; pending -> rejected ;
--          pending -> expired.
CREATE TABLE IF NOT EXISTS assistant_proposals (
  id                     TEXT PRIMARY KEY,
  household_id           TEXT NOT NULL,
  organization_id        TEXT,
  person_id              TEXT,            -- integrante relacionado (opcional)
  user_id                TEXT,            -- quién inició la conversación
  tool_name              TEXT NOT NULL,   -- contrato en registry.py
  category               TEXT,            -- shopping|study|family|health|finance|calm|...
  title                  TEXT,
  summary                TEXT,            -- explicación humana de qué propone
  sensitive              INTEGER NOT NULL DEFAULT 0,
  requires_confirmation  INTEGER NOT NULL DEFAULT 1,
  proposed_payload       TEXT,            -- JSON con los args propuestos (editable por el usuario)
  provider               TEXT,            -- mock|openai (qué generó la propuesta)
  status                 TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|rejected|expired|executed|failed
  created_at             TEXT NOT NULL,
  expires_at             TEXT,
  decided_by_user_id     TEXT,            -- quién confirmó/rechazó
  decided_at             TEXT,
  result_resource_type   TEXT,            -- qué se creó al ejecutar (shopping_item|unit_function|family_post)
  result_resource_id     TEXT,
  error                  TEXT             -- mensaje si status='failed' (sin secretos)
);
CREATE INDEX IF NOT EXISTS idx_ap_household_status ON assistant_proposals(household_id, status);
CREATE INDEX IF NOT EXISTS idx_ap_person ON assistant_proposals(person_id);
CREATE INDEX IF NOT EXISTS idx_ap_user ON assistant_proposals(user_id);
