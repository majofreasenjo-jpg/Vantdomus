-- OPS-2 M7.A — Recordatorios programables + acuse in-app.
--
-- Antes /recordatorios solo AGREGABA "lo de hoy" derivado de otros datos (sin
-- forma de crear "recuérdame X a tal hora" ni de marcar como visto). Esta tabla
-- da recordatorios reales con estado y entrega PULL (sin cron always-on): al
-- consultarse, los vencidos pasan a 'delivered' de forma idempotente (una sola
-- vez). El push real (Web Push/VAPID) es M7.B y depende de provisión de llaves.
--
-- Estados: pending -> delivered -> dismissed ; pending/delivered -> cancelled.
-- Privacidad: visibility_scope replica el criterio de M1 (self / tutela / hogar).
CREATE TABLE IF NOT EXISTS family_reminders (
  id                  TEXT PRIMARY KEY,
  household_id        TEXT NOT NULL,
  organization_id     TEXT,
  person_id           TEXT,            -- integrante destinatario (NULL = todo el hogar)
  created_by_user_id  TEXT,            -- quién lo creó
  title               TEXT NOT NULL,
  body                TEXT,
  remind_at           TEXT NOT NULL,   -- ISO-8601 UTC en que vence
  channel             TEXT NOT NULL DEFAULT 'in_app',  -- in_app (hoy) | push (M7.B)
  visibility_scope    TEXT NOT NULL DEFAULT 'household_shared'
                      CHECK (visibility_scope IN ('private_self','guardian_supervised','household_shared')),
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending|delivered|dismissed|cancelled
  dedupe_key          TEXT,            -- opcional: evita duplicar el mismo recordatorio
  created_at          TEXT NOT NULL,
  delivered_at        TEXT,
  dismissed_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_fr_due ON family_reminders(household_id, status, remind_at);
CREATE INDEX IF NOT EXISTS idx_fr_person ON family_reminders(person_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fr_dedupe ON family_reminders(household_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
