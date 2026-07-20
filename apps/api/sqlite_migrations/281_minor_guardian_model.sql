-- CP1d-FAMILY-PILOT-1b.1 — Modelo de menores, tutela y consentimiento.
-- Migración ADITIVA y FAIL-CLOSED: toda ficha preexistente queda
-- 'unclassified' (no puede recibir cuenta) y con privacidad 'restricted'
-- hasta clasificación explícita del owner. Sin operaciones destructivas.

-- A. Banda funcional (NO jurídica) de la ficha. Default fail-closed.
ALTER TABLE persons ADD COLUMN age_band TEXT NOT NULL DEFAULT 'unclassified'
  CHECK (age_band IN ('unclassified','child','supervised_minor','supervised_teen','adult'));

-- B. Perfil de privacidad de la ficha. Default fail-closed.
ALTER TABLE persons ADD COLUMN minor_privacy_profile TEXT NOT NULL DEFAULT 'restricted'
  CHECK (minor_privacy_profile IN ('restricted','supervised','standard'));

-- C. Relaciones de tutela (guardián adulto -> menor), revocables.
CREATE TABLE IF NOT EXISTS guardian_relationships (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  minor_person_id TEXT NOT NULL,
  guardian_person_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('full','view','recovery')),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  CHECK (minor_person_id <> guardian_person_id)
);
CREATE INDEX IF NOT EXISTS idx_guardian_rel_minor
  ON guardian_relationships(household_id, minor_person_id);
CREATE INDEX IF NOT EXISTS idx_guardian_rel_guardian
  ON guardian_relationships(household_id, guardian_person_id);
-- Una sola relación ACTIVA idéntica (parcial: ignora revocadas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardian_rel_active
  ON guardian_relationships(household_id, minor_person_id, guardian_person_id, scope)
  WHERE revoked_at IS NULL;

-- D. Consentimientos del guardián (sin campos de texto libre: cero PII).
CREATE TABLE IF NOT EXISTS guardian_consents (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  minor_person_id TEXT NOT NULL,
  guardian_person_id TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('account_creation','module_access','data_entry')),
  policy_version TEXT NOT NULL,
  granted_by_user_id TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);
-- Un solo consentimiento ACTIVO por relación+tipo+versión de política.
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardian_consent_active
  ON guardian_consents(relationship_id, consent_type, policy_version)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guardian_consent_minor
  ON guardian_consents(household_id, minor_person_id);
