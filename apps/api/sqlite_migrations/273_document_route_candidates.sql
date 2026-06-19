-- VG+2.2 Bandeja Inteligente v1: candidatos de enrutamiento de documentos.
--
-- Cuando se sube/pega un documento, se extrae texto (si se puede), se clasifica
-- por reglas y se crea un DocumentRouteCandidate con la ruta propuesta. NO crea
-- acciones sensibles hasta que un humano confirme. Al confirmar/rechazar se
-- registra quién y cuándo, y el rechazo puede dejar aprendizaje (negative_learning).
CREATE TABLE IF NOT EXISTS document_route_candidates (
  id                     TEXT PRIMARY KEY,
  household_id           TEXT NOT NULL,
  organization_id        TEXT,
  source_document_id     TEXT,            -- nombre/ref del archivo subido (o 'pasted_text')
  person_id              TEXT,            -- integrante relacionado (opcional)
  route_type             TEXT NOT NULL,   -- prescription_to_medication | receipt_to_finance | ...
  suggested_category     TEXT,
  title                  TEXT,
  summary                TEXT,
  extracted_text_preview TEXT,
  confidence             REAL,
  requires_confirmation  INTEGER NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'pending',  -- pending|accepted|rejected|superseded
  proposed_payload       TEXT,            -- JSON con los campos propuestos (editable por el usuario)
  created_by_ai          INTEGER NOT NULL DEFAULT 0,
  created_by_user_id      TEXT,
  created_at             TEXT NOT NULL,
  confirmed_by_user_id    TEXT,
  confirmed_at           TEXT,
  result_resource_type    TEXT,           -- qué se creó al confirmar (unit_function|expense|evidence|memory)
  result_resource_id      TEXT
);
CREATE INDEX IF NOT EXISTS idx_drc_household_status ON document_route_candidates(household_id, status);
CREATE INDEX IF NOT EXISTS idx_drc_person ON document_route_candidates(person_id);
