-- 060_notification_targets.sql
CREATE TABLE IF NOT EXISTS notification_targets (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  kind TEXT NOT NULL,          -- email | whatsapp
  destination TEXT NOT NULL,   -- email address or E.164 phone (+56...)
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_targets_household ON notification_targets(household_id);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  alert_id TEXT,
  channel TEXT NOT NULL,        -- email | whatsapp | push
  destination TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL,         -- sent | failed | skipped
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_household ON notification_outbox(household_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_alert ON notification_outbox(alert_id);
