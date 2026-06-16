CREATE TABLE IF NOT EXISTS assistant_recommendations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open|applied|dismissed
  kind TEXT NOT NULL,                 -- health|tasks|finance|stability|custom
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  impact INTEGER NOT NULL DEFAULT 0,  -- 0..100
  payload TEXT NOT NULL DEFAULT '{}'  -- JSON
);

CREATE INDEX IF NOT EXISTS idx_asst_household_created
ON assistant_recommendations(household_id, created_at);
