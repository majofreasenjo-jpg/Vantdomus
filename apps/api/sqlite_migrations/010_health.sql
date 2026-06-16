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
