CREATE TABLE IF NOT EXISTS user_mfa_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_codes_user
ON user_mfa_recovery_codes(user_id);
