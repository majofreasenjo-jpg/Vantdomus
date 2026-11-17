-- DOMI R105 / MICR-02A+02M: explicit consent for functional affect only.
-- Separate from memory_items: never infer affect, valence or consent from free text.
-- No backfill, no automatic conversion. The linked source is authoritative.
-- Corrections update memory_items.updated_at and invalidate the linked snapshot.
CREATE TABLE IF NOT EXISTS domi_affective_memory_links (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  memory_updated_at TEXT NOT NULL,
  context_key TEXT NOT NULL,
  visibility_scope TEXT NOT NULL CHECK (
    visibility_scope IN ('private_self', 'household_shared')
  ),
  valence REAL NOT NULL CHECK (valence >= -1.0 AND valence <= 1.0),
  activation REAL NOT NULL CHECK (activation >= 0.0 AND activation <= 1.0),
  relevance REAL NOT NULL CHECK (relevance >= 0.0 AND relevance <= 1.0),
  ratified_by_user_id TEXT NOT NULL,
  ratified_at TEXT NOT NULL,
  revoked_at TEXT,
  expires_at TEXT,
  CHECK (length(context_key) >= 1 AND length(context_key) <= 80)
);
CREATE INDEX IF NOT EXISTS idx_domi_affect_subject
  ON domi_affective_memory_links(household_id, person_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_domi_affect_memory
  ON domi_affective_memory_links(household_id, memory_id, revoked_at);
-- A source record cannot silently accumulate multiple active affective overlays.
CREATE UNIQUE INDEX IF NOT EXISTS uq_domi_affect_active_memory
  ON domi_affective_memory_links(household_id, memory_id)
  WHERE revoked_at IS NULL;
