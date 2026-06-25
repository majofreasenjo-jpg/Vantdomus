-- U1-LOCAL: Actividades del Día — cada integrante publica "Hoy tengo...".
-- Visibilidad family|caregivers|private. Vinculación opcional a UnitFunction.
CREATE TABLE IF NOT EXISTS daily_activities (
  id                       TEXT PRIMARY KEY,
  household_id             TEXT NOT NULL,
  organization_id          TEXT,
  person_id                TEXT NOT NULL,
  created_by_user_id       TEXT,
  title                    TEXT NOT NULL,
  description              TEXT,
  activity_type            TEXT NOT NULL DEFAULT 'other', -- school|work|health|errand|sport|social|home|travel|other
  starts_at                TEXT,
  ends_at                  TEXT,
  location_label           TEXT,
  visibility               TEXT NOT NULL DEFAULT 'family', -- family|caregivers|private
  status                   TEXT NOT NULL DEFAULT 'planned', -- planned|in_progress|done|cancelled
  linked_unit_function_id  TEXT,
  metadata                 TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_da_hh_date ON daily_activities(household_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_da_person ON daily_activities(person_id);
