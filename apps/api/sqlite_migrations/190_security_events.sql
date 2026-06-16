CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  household_id TEXT,
  organization_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_household_created
ON security_events(household_id, created_at);

CREATE INDEX IF NOT EXISTS idx_security_events_type_created
ON security_events(event_type, created_at);
