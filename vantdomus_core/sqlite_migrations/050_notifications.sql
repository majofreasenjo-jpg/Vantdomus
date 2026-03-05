-- 050_notifications.sql
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  platform TEXT NOT NULL,         -- ios/android/web
  token TEXT NOT NULL,            -- expo push token or other
  device_name TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_household ON device_tokens(household_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_tokens_platform_token ON device_tokens(platform, token);
