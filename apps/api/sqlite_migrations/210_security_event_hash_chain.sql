ALTER TABLE security_events ADD COLUMN previous_hash TEXT;
ALTER TABLE security_events ADD COLUMN event_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_security_events_hash_chain
ON security_events(household_id, created_at, id);
