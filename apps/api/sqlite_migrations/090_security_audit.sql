CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  household_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_household_created ON audit_log(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log(user_id, created_at);

CREATE TABLE IF NOT EXISTS assistant_action_log (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT,
  tool_name TEXT NOT NULL,
  arguments TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assistant_action_household_created ON assistant_action_log(household_id, created_at);
