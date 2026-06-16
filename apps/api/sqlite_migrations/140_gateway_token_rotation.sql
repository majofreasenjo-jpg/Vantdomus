ALTER TABLE coupling_gateways ADD COLUMN token_expires_at TEXT;
ALTER TABLE coupling_gateways ADD COLUMN token_rotated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_coupling_gateways_token_expiry ON coupling_gateways(token_expires_at);
