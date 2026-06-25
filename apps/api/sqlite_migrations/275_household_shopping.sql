-- U1-LOCAL: Compras del Hogar — lista familiar de productos por comprar.
-- Estados needed|in_cart|purchased|unavailable|cancelled.
-- NO incluye checkout, ni APIs externas, ni precios reales — solo organización.
CREATE TABLE IF NOT EXISTS household_shopping_items (
  id                       TEXT PRIMARY KEY,
  household_id             TEXT NOT NULL,
  organization_id          TEXT,
  requested_by_user_id     TEXT,
  requested_by_person_id   TEXT,
  assigned_to_person_id    TEXT,
  item_name                TEXT NOT NULL,
  quantity                 REAL,
  unit                     TEXT,
  category                 TEXT NOT NULL DEFAULT 'other', -- grocery|pharmacy|cleaning|personal_care|pet|baby|hardware|school|other
  priority                 TEXT NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
  store_type               TEXT NOT NULL DEFAULT 'other',  -- supermarket|pharmacy|convenience|hardware|online|other
  preferred_store          TEXT,
  estimated_price          REAL,
  currency                 TEXT NOT NULL DEFAULT 'CLP',
  external_url             TEXT,
  status                   TEXT NOT NULL DEFAULT 'needed', -- needed|in_cart|purchased|unavailable|cancelled
  purchased_at             TEXT,
  purchased_by_user_id     TEXT,
  notes                    TEXT,
  metadata                 TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hsi_hh_status ON household_shopping_items(household_id, status);
CREATE INDEX IF NOT EXISTS idx_hsi_assigned ON household_shopping_items(assigned_to_person_id);
