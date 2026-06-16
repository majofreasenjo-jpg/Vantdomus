CREATE TABLE IF NOT EXISTS coupling_gateways (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    provider_type TEXT NOT NULL, -- 'sap', 'oracle', 'aconex', 'sftp_script'
    status TEXT NOT NULL, -- 'active', 'paused', 'error'
    auth_token TEXT,
    last_sync_at TEXT,
    created_at TEXT NOT NULL,
    meta TEXT
);
