ALTER TABLE agent_hub_events ADD COLUMN trace_id TEXT;
ALTER TABLE agent_hub_events ADD COLUMN alert_id TEXT;
ALTER TABLE agent_hub_events ADD COLUMN task_ids TEXT;
ALTER TABLE agent_hub_events ADD COLUMN audit_id TEXT;
ALTER TABLE agent_hub_events ADD COLUMN assistant_action_id TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_hub_events_trace
ON agent_hub_events(trace_id);
