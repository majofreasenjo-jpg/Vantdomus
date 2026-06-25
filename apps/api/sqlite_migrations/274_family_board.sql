-- U1-LOCAL: Avisos del Hogar (Family Board) — muro familiar.
-- Sirve para que la familia comparta avisos, mensajes, alertas, recordatorios.
-- Visibilidad por roles/personas; pinned y resolved para gestión rápida.
CREATE TABLE IF NOT EXISTS family_board_posts (
  id                     TEXT PRIMARY KEY,
  household_id           TEXT NOT NULL,
  organization_id        TEXT,
  author_user_id         TEXT,
  author_person_id       TEXT,
  post_type              TEXT NOT NULL DEFAULT 'notice', -- notice|alert|reminder|message|emergency_note|logistics|shopping|health|school|finance|document
  title                  TEXT NOT NULL,
  body                   TEXT,
  priority               TEXT NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
  pinned                 INTEGER NOT NULL DEFAULT 0,
  visible_to_roles       TEXT,    -- JSON array, NULL = familia
  visible_to_person_ids  TEXT,    -- JSON array opcional
  expires_at             TEXT,
  resolved_at            TEXT,
  resolved_by_user_id    TEXT,
  archived_at            TEXT,
  metadata               TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fbp_hh_status ON family_board_posts(household_id, resolved_at, archived_at);
CREATE INDEX IF NOT EXISTS idx_fbp_pinned ON family_board_posts(household_id, pinned);
