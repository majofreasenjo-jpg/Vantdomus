CREATE TABLE IF NOT EXISTS household_invitations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  organization_id TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  invited_by_user_id TEXT,
  accepted_by_user_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_household_invitations_household_created
ON household_invitations(household_id, created_at);

CREATE INDEX IF NOT EXISTS idx_household_invitations_email
ON household_invitations(email);
