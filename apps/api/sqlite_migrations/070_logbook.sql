CREATE TABLE IF NOT EXISTS logbook_entries (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entry_type TEXT NOT NULL, /* 'hito', 'comentario', 'accidente', 'implementacion' */
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
