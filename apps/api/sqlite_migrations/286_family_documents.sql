-- OPS-2 M9 — Registro de documentos familiares con trazabilidad.
--
-- Separa EVIDENCIA (el documento) de MEMORIA (lo que Domi aprende de él). Cada
-- documento guarda su trazabilidad canónica: archivo · versión · fecha · autor ·
-- origen · páginas · vigencia · permisos · reemplazo · eliminación + hash y
-- estado de antivirus. Un documento NO 'clean' (o 'infected') NO alimenta a la
-- IA (cuarentena). El texto de un documento es DATA no confiable (anti-inyección).
--
-- Versionado: subir una versión nueva crea otra fila con supersedes=<id previo>
-- y version+1; la anterior se marca eliminada (deja de servir) con trazabilidad.
CREATE TABLE IF NOT EXISTS family_documents (
  id                  TEXT PRIMARY KEY,
  household_id        TEXT NOT NULL,
  organization_id     TEXT,
  person_id           TEXT,             -- integrante sujeto/dueño (opcional)
  uploaded_by_user_id TEXT,             -- autor de la subida
  filename            TEXT NOT NULL,
  mime                TEXT,
  size_bytes          INTEGER NOT NULL DEFAULT 0,
  sha256              TEXT NOT NULL,     -- huella del contenido (dedupe + integridad)
  version             INTEGER NOT NULL DEFAULT 1,
  supersedes          TEXT,             -- id de la versión anterior
  source              TEXT NOT NULL DEFAULT 'upload',  -- upload|scan|import
  page_count          INTEGER,
  visibility_scope    TEXT NOT NULL DEFAULT 'household_shared'
                      CHECK (visibility_scope IN ('private_self','guardian_supervised','household_shared')),
  scan_status         TEXT NOT NULL DEFAULT 'pending',  -- pending|clean|infected|skipped|error
  scan_engine         TEXT,             -- nombre/versión del antivirus (o 'none')
  scanned_at          TEXT,
  valid_until         TEXT,             -- vigencia (ISO); vencido = no sirve a IA
  created_at          TEXT NOT NULL,
  deleted_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_fd_household ON family_documents(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fd_person ON family_documents(person_id);
CREATE INDEX IF NOT EXISTS idx_fd_sha ON family_documents(household_id, sha256);
CREATE INDEX IF NOT EXISTS idx_fd_supersedes ON family_documents(supersedes);
