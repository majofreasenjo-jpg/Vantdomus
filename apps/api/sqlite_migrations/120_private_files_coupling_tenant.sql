ALTER TABLE logbook_entries ADD COLUMN attachment_path TEXT;
ALTER TABLE coupling_gateways ADD COLUMN organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_coupling_gateways_org ON coupling_gateways(organization_id);

UPDATE coupling_gateways
SET organization_id = (SELECT organization_id FROM households WHERE households.id = coupling_gateways.household_id)
WHERE organization_id IS NULL OR organization_id = '';
