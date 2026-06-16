CREATE TABLE IF NOT EXISTS webhook_ingest_log (
  id TEXT PRIMARY KEY,
  gateway_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  organization_id TEXT,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(gateway_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_ingest_gateway_created ON webhook_ingest_log(gateway_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_ingest_org_created ON webhook_ingest_log(organization_id, created_at);
