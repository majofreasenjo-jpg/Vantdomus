
-- ===== SOURCE 000_init.sql =====
-- Users / Auth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Households / Memberships / Persons
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS household_memberships (
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  relation TEXT,
  created_at TEXT NOT NULL
);

-- Events / Actors
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_actors (
  event_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  role TEXT,
  PRIMARY KEY (event_id, person_id, role)
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  event_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  dedupe_key TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_alerts_dedupe
ON alerts(dedupe_key) WHERE dedupe_key IS NOT NULL;


-- ===== SOURCE 010_health.sql =====
-- Medication state + plans
CREATE TABLE IF NOT EXISTS medication_state (
  household_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  med_name TEXT NOT NULL,
  consecutive_missed INTEGER NOT NULL DEFAULT 0,
  last_status TEXT,
  last_checkin_at TEXT,
  PRIMARY KEY (household_id, person_id, med_name)
);

CREATE TABLE IF NOT EXISTS adherence_plans (
  household_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  med_name TEXT NOT NULL,
  reminder_times TEXT NOT NULL DEFAULT '[]',
  verification_mode TEXT NOT NULL DEFAULT 'none',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (household_id, person_id, med_name)
);


-- ===== SOURCE 020_tasks_finance_features.sql =====
-- TASKS
CREATE TABLE IF NOT EXISTS task_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  due_at TEXT,
  assigned_person_id TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_household_created ON task_items(household_id, created_at);

-- FINANCE
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL DEFAULT 'general',
  merchant TEXT,
  expense_at TEXT,
  notes TEXT,
  person_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exp_household_date ON expenses(household_id, expense_at);

-- FEATURES / SCORES
CREATE TABLE IF NOT EXISTS features_daily (
  household_id TEXT NOT NULL,
  feature_date TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'home',
  health_score INTEGER NOT NULL DEFAULT 0,
  task_score INTEGER NOT NULL DEFAULT 0,
  finance_score INTEGER NOT NULL DEFAULT 0,
  hsi INTEGER NOT NULL DEFAULT 0,
  missed_7d INTEGER NOT NULL DEFAULT 0,
  tasks_done_7d INTEGER NOT NULL DEFAULT 0,
  tasks_overdue INTEGER NOT NULL DEFAULT 0,
  spend_30d_total REAL NOT NULL DEFAULT 0,
  spend_30d_pharmacy REAL NOT NULL DEFAULT 0,
  alerts_open INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (household_id, feature_date)
);

CREATE TABLE IF NOT EXISTS state_snapshot (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  state_json TEXT NOT NULL
);


-- ===== SOURCE 040_planning_assistant.sql =====
CREATE TABLE IF NOT EXISTS assistant_recommendations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open|applied|dismissed
  kind TEXT NOT NULL,                 -- health|tasks|finance|stability|custom
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  impact INTEGER NOT NULL DEFAULT 0,  -- 0..100
  payload TEXT NOT NULL DEFAULT '{}'  -- JSON
);

CREATE INDEX IF NOT EXISTS idx_asst_household_created
ON assistant_recommendations(household_id, created_at);


-- ===== SOURCE 050_notifications.sql =====
-- 050_notifications.sql
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  platform TEXT NOT NULL,         -- ios/android/web
  token TEXT NOT NULL,            -- expo push token or other
  device_name TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_household ON device_tokens(household_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_tokens_platform_token ON device_tokens(platform, token);


-- ===== SOURCE 060_notification_targets.sql =====
-- 060_notification_targets.sql
CREATE TABLE IF NOT EXISTS notification_targets (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  kind TEXT NOT NULL,          -- email | whatsapp
  destination TEXT NOT NULL,   -- email address or E.164 phone (+56...)
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_targets_household ON notification_targets(household_id);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  alert_id TEXT,
  channel TEXT NOT NULL,        -- email | whatsapp | push
  destination TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL,         -- sent | failed | skipped
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_household ON notification_outbox(household_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_alert ON notification_outbox(alert_id);


-- ===== SOURCE 070_logbook.sql =====
CREATE TABLE IF NOT EXISTS logbook_entries (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entry_type TEXT NOT NULL, /* 'hito', 'comentario', 'accidente', 'implementacion' */
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);


-- ===== SOURCE 075_logbook_v2.sql =====
ALTER TABLE logbook_entries ADD COLUMN event_date TEXT;
ALTER TABLE logbook_entries ADD COLUMN attachment_url TEXT;
ALTER TABLE logbook_entries ADD COLUMN attachment_name TEXT;


-- ===== SOURCE 080_coupling.sql =====
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


-- ===== SOURCE 090_security_audit.sql =====
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  household_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_household_created ON audit_log(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log(user_id, created_at);

CREATE TABLE IF NOT EXISTS assistant_action_log (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT,
  tool_name TEXT NOT NULL,
  arguments TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assistant_action_household_created ON assistant_action_log(household_id, created_at);


-- ===== SOURCE 100_organizations.sql =====
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE households ADD COLUMN organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_households_organization ON households(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);


-- ===== SOURCE 110_tenant_columns.sql =====
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

