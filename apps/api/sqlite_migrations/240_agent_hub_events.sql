CREATE TABLE IF NOT EXISTS agent_hub_events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  organization_id TEXT,
  gateway_id TEXT,
  provider_type TEXT NOT NULL,
  external_event_id TEXT,
  event_type TEXT NOT NULL,
  summary TEXT,
  payload TEXT,
  actions TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_hub_events_household_created
ON agent_hub_events(household_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_hub_events_gateway_external
ON agent_hub_events(gateway_id, external_event_id);
