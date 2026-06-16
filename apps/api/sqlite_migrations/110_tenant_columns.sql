ALTER TABLE persons ADD COLUMN organization_id TEXT;
ALTER TABLE events ADD COLUMN organization_id TEXT;
ALTER TABLE alerts ADD COLUMN organization_id TEXT;
ALTER TABLE task_items ADD COLUMN organization_id TEXT;
ALTER TABLE expenses ADD COLUMN organization_id TEXT;
ALTER TABLE features_daily ADD COLUMN organization_id TEXT;
ALTER TABLE state_snapshot ADD COLUMN organization_id TEXT;
ALTER TABLE logbook_entries ADD COLUMN organization_id TEXT;
ALTER TABLE audit_log ADD COLUMN organization_id TEXT;
ALTER TABLE assistant_action_log ADD COLUMN organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_persons_org ON persons(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_org_created ON events(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_org_created ON alerts(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_org_created ON task_items(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_exp_org_date ON expenses(organization_id, expense_at);
CREATE INDEX IF NOT EXISTS idx_logbook_org_created ON logbook_entries(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_log(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_action_org_created ON assistant_action_log(organization_id, created_at);

UPDATE persons SET organization_id = (SELECT organization_id FROM households WHERE households.id = persons.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE events SET organization_id = (SELECT organization_id FROM households WHERE households.id = events.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE alerts SET organization_id = (SELECT organization_id FROM households WHERE households.id = alerts.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE task_items SET organization_id = (SELECT organization_id FROM households WHERE households.id = task_items.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE expenses SET organization_id = (SELECT organization_id FROM households WHERE households.id = expenses.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE features_daily SET organization_id = (SELECT organization_id FROM households WHERE households.id = features_daily.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE state_snapshot SET organization_id = (SELECT organization_id FROM households WHERE households.id = state_snapshot.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE logbook_entries SET organization_id = (SELECT organization_id FROM households WHERE households.id = logbook_entries.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE audit_log SET organization_id = (SELECT organization_id FROM households WHERE households.id = audit_log.household_id)
WHERE organization_id IS NULL OR organization_id = '';

UPDATE assistant_action_log SET organization_id = (SELECT organization_id FROM households WHERE households.id = assistant_action_log.household_id)
WHERE organization_id IS NULL OR organization_id = '';
