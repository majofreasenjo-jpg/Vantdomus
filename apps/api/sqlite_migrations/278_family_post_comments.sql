-- U2-UX B2: comentarios por aviso del Mural (mata el "lo hablamos por WhatsApp").
-- Hilo simple por post; autor por usuario y/o persona; reacción emoji opcional.
CREATE TABLE IF NOT EXISTS family_post_comments (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  author_user_id TEXT,
  author_person_id TEXT,
  body TEXT NOT NULL,
  reaction TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_family_post_comments_post
  ON family_post_comments(post_id, created_at);
