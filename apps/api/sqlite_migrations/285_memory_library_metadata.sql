-- OPS-2 M8 — Biblioteca de Domi (6 capas) + inferencias confirmables.
--
-- Amplía memory_items con los metadatos que el canon pide por memoria:
-- source · sensitivity · confidence · verified_at · supersedes · inference_status.
-- Con visibility_scope (M1) + memory_type + estas columnas, cada memoria se
-- clasifica en una de las 6 capas:
--   1 personal · 2 familiar · 3 documental · 4 operativa · 5 inferencia · 6 temporal.
--
-- INFERENCIAS: una hipótesis de Domi NO es un hecho. Se guarda con
-- inference_status='pending' y NO entra al contexto de IA hasta que un humano la
-- confirma ('confirmed' → verified_at). 'dismissed' la descarta (queda por
-- trazabilidad). Las memorias existentes son hechos (inference_status NULL).
ALTER TABLE memory_items ADD COLUMN source TEXT;               -- family|document|inference|system
ALTER TABLE memory_items ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'normal'
  CHECK (sensitivity IN ('low','normal','high'));
ALTER TABLE memory_items ADD COLUMN confidence REAL;           -- 0..1 (sobre todo para inferencias)
ALTER TABLE memory_items ADD COLUMN verified_at TEXT;          -- cuándo un humano la confirmó
ALTER TABLE memory_items ADD COLUMN supersedes TEXT;           -- id de la memoria que reemplaza
ALTER TABLE memory_items ADD COLUMN inference_status TEXT;     -- NULL=hecho; pending|confirmed|dismissed

-- Backfill: las memorias previas quedan como hechos de origen 'family' salvo las
-- derivadas de documentos (por scope).
UPDATE memory_items SET source = 'document'
 WHERE source IS NULL AND visibility_scope = 'document_derived';
UPDATE memory_items SET source = 'family' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_mi_inference ON memory_items(household_id, inference_status);
CREATE INDEX IF NOT EXISTS idx_mi_supersedes ON memory_items(supersedes);
