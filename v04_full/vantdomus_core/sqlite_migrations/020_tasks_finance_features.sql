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
