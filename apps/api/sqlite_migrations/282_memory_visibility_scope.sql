-- OPS-2 M1 — Privacidad de memoria: scope de visibilidad canónico (6 valores).
-- Antes la visibilidad vivía en consent_scope (JSON visible_to). Ahora es una
-- columna explícita y autoritativa; la recuperación para IA la respeta y filtra
-- por el usuario que pregunta (self / tutela / hogar / owner).
ALTER TABLE memory_items ADD COLUMN visibility_scope TEXT NOT NULL
  DEFAULT 'household_shared'
  CHECK (visibility_scope IN (
    'private_self',
    'guardian_supervised',
    'household_shared',
    'owner_operational',
    'temporary_session',
    'document_derived'
  ));

-- Backfill seguro de las filas existentes (OPS-2.A): las que NO eran visibles
-- para el hogar (consent_scope sin "household") pasan a privadas; el resto queda
-- household_shared (comportamiento previo). Sin JSON1: heurística por substring.
UPDATE memory_items
   SET visibility_scope = 'private_self'
 WHERE (consent_scope IS NULL OR consent_scope NOT LIKE '%household%');

-- Soft-delete: una memoria "olvidada" deja de entrar al contexto de IA pero
-- conserva trazabilidad (canon: olvidar + trazabilidad).
ALTER TABLE memory_items ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_mi_scope ON memory_items(household_id, visibility_scope);
