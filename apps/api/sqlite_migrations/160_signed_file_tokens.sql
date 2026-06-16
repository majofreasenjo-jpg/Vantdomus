CREATE TABLE IF NOT EXISTS signed_file_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  household_id TEXT NOT NULL,
  organization_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_signed_file_tokens_hash
ON signed_file_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_signed_file_tokens_resource
ON signed_file_tokens(resource_type, resource_id);
