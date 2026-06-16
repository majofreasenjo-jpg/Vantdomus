ALTER TABLE auth_sessions ADD COLUMN last_seen_at TEXT;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_last_seen
ON auth_sessions(user_id, last_seen_at);
