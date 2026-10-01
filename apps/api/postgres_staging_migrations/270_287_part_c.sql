
-- ===== SOURCE 270_vantguide_runtime_v1.sql =====
-- =============================================================================
-- 270_vantguide_runtime_v1.sql
--
-- Sprint VG+1: Consolidación del núcleo VantGuide antes de avanzar a UI,
-- email forwarding o integraciones externas. Documento de decisiones:
-- docs/VANTGUIDE_ARCHITECTURE.md §18 (Consolidación VG+1).
--
-- Esta migración es **incremental sobre 260_vantguide_core.sql**. No edita
-- destructivamente las tablas anteriores; solo agrega columnas/tablas/índices
-- nuevos. SQLite acepta `ALTER TABLE ADD COLUMN` sin reescribir la tabla.
--
-- Aplica a:
--   * unit_functions      — version, AI confidence + confirmación humana,
--                           cross-link opcional a primary evidence
--   * function_events     — cross-link opcional a evidence + índice UNIQUE
--                           compuesto parcial para dedupe robusto
--   * evidence_items      — cross-link explícito a function_event
--   * NUEVO: unit_function_versions     — snapshot histórico de cada función
--   * NUEVO: unit_function_responsibles — múltiples responsables / cuidadores
--   * NUEVO: scheduler_runs             — métricas + lock fallback para SQLite
-- =============================================================================


-- -----------------------------------------------------------------------------
-- unit_functions: versionado + AI confidence + cross-link evidence
-- -----------------------------------------------------------------------------
ALTER TABLE unit_functions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- AI confidence — la IA puede crear sugerencias con distintos niveles de
-- certeza. Para medicamentos, aunque ai_confidence sea alta, NO se activa
-- el scheduler hasta que un humano confirme (ver scheduler.tick()).
ALTER TABLE unit_functions ADD COLUMN ai_confidence REAL;             -- 0.0 - 1.0
ALTER TABLE unit_functions ADD COLUMN ai_needs_confirmation INTEGER NOT NULL DEFAULT 0;  -- bool
ALTER TABLE unit_functions ADD COLUMN ai_extraction_source TEXT;      -- 'ocr_receta', 'voice_dictation', 'email_inbound', ...
ALTER TABLE unit_functions ADD COLUMN ai_explanation TEXT;            -- texto libre: por qué la IA cree esto

-- Confirmación humana — quién y cuándo dijo "sí, está bien, activá esto".
ALTER TABLE unit_functions ADD COLUMN confirmed_by_user_id TEXT;
ALTER TABLE unit_functions ADD COLUMN confirmed_at TEXT;              -- ISO 8601 UTC

-- Cross-link opcional: la evidencia "principal" que respalda el estado
-- actual de la función. Una función puede tener muchas evidencias, pero
-- una sola "principal" (la más reciente y autoritativa).
ALTER TABLE unit_functions ADD COLUMN primary_evidence_id TEXT;


-- -----------------------------------------------------------------------------
-- function_events ↔ evidence_items: cross-link bidireccional
--
-- Mantenemos las dos tablas separadas (decisión 1 de Codex), pero permitimos
-- relación opcional cruzada para que un evento `completed` o `missed` pueda
-- apuntar a una evidencia concreta sin mezclar semánticas.
-- -----------------------------------------------------------------------------
ALTER TABLE function_events ADD COLUMN primary_evidence_id TEXT;       -- FK opcional a evidence_items
-- evidence_items.function_event_id ya existe en migración 260. Mantenido.


-- -----------------------------------------------------------------------------
-- function_events: índice UNIQUE compuesto parcial
--
-- Decisión 3 de Codex: idempotencia en DB con compuesto, no dedupe en
-- memoria. SQLite soporta UNIQUE INDEX parcial con WHERE clause desde 3.8.0.
-- Postgres también. Esto reemplaza la dependencia exclusiva en `dedupe_key`
-- (que queda como fallback para eventos especiales como escalation_due_ai
-- generados manualmente por el assistant).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_function_event_dedupe_composite
  ON function_events (unit_function_id, scheduled_for, event_type)
  WHERE scheduled_for IS NOT NULL;


-- -----------------------------------------------------------------------------
-- TABLA NUEVA: unit_function_versions
--
-- Snapshot histórico completo de cada UnitFunction. Cuando un PATCH cambia
-- una función, ANTES del UPDATE se inserta una fila acá con el estado
-- previo. Esto habilita la Biblioteca de Evolución:
--   "Antes Elena tenía Losartán 8:00/20:00. Cambiamos a 8:00 y la adherencia
--    mejoró 32% en 4 semanas."
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unit_function_versions (
  id                       TEXT PRIMARY KEY,
  unit_function_id         TEXT NOT NULL,
  version                  INTEGER NOT NULL,
  snapshot_json            TEXT NOT NULL,        -- estado completo previo
  changed_by_user_id       TEXT,                 -- NULL si lo cambió la IA
  changed_by_ai            INTEGER NOT NULL DEFAULT 0,  -- bool
  change_reason            TEXT,                 -- 'horario_optimo', 'pedido_familia', 'no_funcionaba', ...
  change_source            TEXT,                 -- 'manual', 'assistant_tool', 'scheduler', 'caregiver_review'
  created_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ufv_function    ON unit_function_versions(unit_function_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_ufv_created     ON unit_function_versions(created_at DESC);


-- -----------------------------------------------------------------------------
-- TABLA NUEVA: unit_function_responsibles
--
-- Decisión 8 de Codex: preparar múltiples responsables/cuidadores. Por
-- compatibilidad backward, `unit_functions.responsible_person_id` se
-- mantiene como "responsable primario". Esta tabla agrega:
--   * orden de escalation
--   * permisos de confirm/edit
--   * rol explícito
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unit_function_responsibles (
  id                       TEXT PRIMARY KEY,
  unit_function_id         TEXT NOT NULL,
  person_id                TEXT NOT NULL,
  responsibility_role      TEXT NOT NULL,    -- primary_caregiver | secondary_caregiver | parent | guardian | doctor_viewer | supervisor | reviewer | escalation_contact
  escalation_order         INTEGER NOT NULL DEFAULT 1,
  notify                   INTEGER NOT NULL DEFAULT 1,    -- bool
  can_confirm              INTEGER NOT NULL DEFAULT 0,    -- bool: puede aprobar funciones IA
  can_edit                 INTEGER NOT NULL DEFAULT 0,    -- bool: puede modificar la función
  created_at               TEXT NOT NULL,
  UNIQUE(unit_function_id, person_id, responsibility_role)
);

CREATE INDEX IF NOT EXISTS idx_ufr_function     ON unit_function_responsibles(unit_function_id, escalation_order);
CREATE INDEX IF NOT EXISTS idx_ufr_person       ON unit_function_responsibles(person_id);


-- -----------------------------------------------------------------------------
-- TABLA NUEVA: scheduler_runs
--
-- Métricas + lock fallback de cada ejecución del scheduler. En Postgres
-- usamos `pg_try_advisory_lock(...)` para impedir dos ticks simultáneos.
-- En SQLite no hay advisory locks, así que esta tabla actúa como lock
-- explícito: la columna `lease_until` representa "esta tick aún está
-- corriendo, no arrancar otra hasta que pase ese timestamp".
--
-- Logs/métricas:
--   * scanned        funciones examinadas
--   * events_created reminders/missed/etc. emitidos
--   * duplicates_skipped     eventos que el dedupe rechazó
--   * missed_emitted, escalations_emitted
--   * errors         errores no fatales durante el tick
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduler_runs (
  id                       TEXT PRIMARY KEY,
  started_at               TEXT NOT NULL,
  finished_at              TEXT,                  -- NULL mientras corre
  lease_until              TEXT,                  -- NULL cuando termina; timestamp ISO mientras corre
  host                     TEXT,                  -- hostname / container id que ejecuta
  status                   TEXT NOT NULL DEFAULT 'running',  -- running | done | error | skipped_locked
  functions_scanned        INTEGER NOT NULL DEFAULT 0,
  reminder_due_emitted     INTEGER NOT NULL DEFAULT 0,
  missed_emitted           INTEGER NOT NULL DEFAULT 0,
  escalations_emitted      INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped       INTEGER NOT NULL DEFAULT 0,
  errors                   INTEGER NOT NULL DEFAULT 0,
  error_detail             TEXT,
  metrics_json             TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sched_runs_started ON scheduler_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sched_runs_status  ON scheduler_runs(status, started_at DESC);


-- -----------------------------------------------------------------------------
-- VISTAS conceptuales (no creadas como VIEW; documentación):
--
-- v_unit_functions_pending_ai_confirmation:
--   SELECT * FROM unit_functions
--   WHERE created_by_ai=1
--     AND ai_needs_confirmation=1
--     AND confirmed_at IS NULL
--     AND status IN ('open','in_progress');
--   El scheduler debe SALTAR estas funciones cuando emite reminder_due.
--
-- v_function_evolution:
--   JOIN unit_function_versions sobre la misma unit_function_id para
--   mostrar el historial de cambios y permitir narrar la evolución
--   ("antes Elena tenía X, cambiamos a Y, mejoró Z%").
--
-- v_responsible_escalation_chain:
--   SELECT * FROM unit_function_responsibles
--   WHERE notify=1
--   ORDER BY unit_function_id, escalation_order ASC;
--   El dispatcher usa esto para escalar en orden cuando se emite
--   escalation_due.
-- =============================================================================


-- ===== SOURCE 271_vantguide_micro_pre_ui.sql =====
-- =============================================================================
-- 271_vantguide_micro_pre_ui.sql
--
-- Micro-ajustes pre Sprint VG+2 (UI) basados en la evaluación de Codex
-- post VG+1. Cambios pequeños, no destructivos, todos opcionales.
--
-- Doc: docs/VANTGUIDE_ARCHITECTURE.md §18.8 (Micro-ajustes pre-UI)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- escalation_delay_minutes opcional por responsable.
--
-- Codex 5.3: la semántica ordinal está bien, pero conviene permitir que cada
-- responsable tenga un override de cuánto esperar antes de escalar al
-- siguiente nivel. Cuando es NULL, el dispatcher usa
-- household.meta.default_escalation_step_minutes (o 15 por default).
-- -----------------------------------------------------------------------------
ALTER TABLE unit_function_responsibles
  ADD COLUMN escalation_delay_minutes INTEGER;


-- -----------------------------------------------------------------------------
-- VISTA conceptual (sin VIEW SQL, doc):
--
-- v_responsibles_escalation_with_default:
--   SELECT r.*,
--          COALESCE(
--              r.escalation_delay_minutes,
--              (SELECT json_extract(h.meta, '$.default_escalation_step_minutes')
--                 FROM households h WHERE h.id = uf.household_id),
--              15  -- fallback global
--          ) AS effective_delay_minutes
--   FROM unit_function_responsibles r
--   JOIN unit_functions uf ON uf.id = r.unit_function_id;
--
-- El dispatcher (cuando se atte runtime) usa effective_delay_minutes para
-- decidir cuánto esperar antes de pasar al escalation_order siguiente.
-- =============================================================================


-- ===== SOURCE 272_persons_user_link.sql =====
-- VG+2.6: vincular cada persona (integrante) con una cuenta de usuario.
--
-- Hasta ahora `persons` no tenía relación con `users`: el sistema sabía el rol
-- del usuario en el hogar (owner/admin/member/viewer) pero no QUÉ persona era.
-- Eso impedía resolver la visibilidad `self` ("cada uno ve lo suyo").
--
-- Con `user_id` poblado, la lógica de visibilidad puede resolver:
--   self        -> evidencia/memoria cuyo person_id == la persona del usuario
--   responsible -> donde el usuario es responsable de la función
--   household   -> compartido con todo el hogar
--
-- Nullable: las personas sin cuenta (ej. un menor sin login) quedan con NULL.
ALTER TABLE persons ADD COLUMN user_id TEXT;


-- ===== SOURCE 273_document_route_candidates.sql =====
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


-- ===== SOURCE 274_family_board.sql =====
-- U1-LOCAL: Avisos del Hogar (Family Board) — muro familiar.
-- Sirve para que la familia comparta avisos, mensajes, alertas, recordatorios.
-- Visibilidad por roles/personas; pinned y resolved para gestión rápida.
CREATE TABLE IF NOT EXISTS family_board_posts (
  id                     TEXT PRIMARY KEY,
  household_id           TEXT NOT NULL,
  organization_id        TEXT,
  author_user_id         TEXT,
  author_person_id       TEXT,
  post_type              TEXT NOT NULL DEFAULT 'notice', -- notice|alert|reminder|message|emergency_note|logistics|shopping|health|school|finance|document
  title                  TEXT NOT NULL,
  body                   TEXT,
  priority               TEXT NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
  pinned                 INTEGER NOT NULL DEFAULT 0,
  visible_to_roles       TEXT,    -- JSON array, NULL = familia
  visible_to_person_ids  TEXT,    -- JSON array opcional
  expires_at             TEXT,
  resolved_at            TEXT,
  resolved_by_user_id    TEXT,
  archived_at            TEXT,
  metadata               TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fbp_hh_status ON family_board_posts(household_id, resolved_at, archived_at);
CREATE INDEX IF NOT EXISTS idx_fbp_pinned ON family_board_posts(household_id, pinned);


-- ===== SOURCE 275_household_shopping.sql =====
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


-- ===== SOURCE 276_daily_activities.sql =====
-- U1-LOCAL: Actividades del Día — cada integrante publica "Hoy tengo...".
-- Visibilidad family|caregivers|private. Vinculación opcional a UnitFunction.
CREATE TABLE IF NOT EXISTS daily_activities (
  id                       TEXT PRIMARY KEY,
  household_id             TEXT NOT NULL,
  organization_id          TEXT,
  person_id                TEXT NOT NULL,
  created_by_user_id       TEXT,
  title                    TEXT NOT NULL,
  description              TEXT,
  activity_type            TEXT NOT NULL DEFAULT 'other', -- school|work|health|errand|sport|social|home|travel|other
  starts_at                TEXT,
  ends_at                  TEXT,
  location_label           TEXT,
  visibility               TEXT NOT NULL DEFAULT 'family', -- family|caregivers|private
  status                   TEXT NOT NULL DEFAULT 'planned', -- planned|in_progress|done|cancelled
  linked_unit_function_id  TEXT,
  metadata                 TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_da_hh_date ON daily_activities(household_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_da_person ON daily_activities(person_id);


-- ===== SOURCE 277_persons_avatar_status.sql =====
-- U3 I1/I2: identidad visual + estado del integrante.
--
-- avatar: identidad visual elegida por el integrante.
--   * "emoji:🐻"  → avatar ilustrado del set curado (frontend mapea el emoji)
--   * "data:image/...;base64,..." → foto subida (estilo WhatsApp)
--   * NULL → sin avatar (se usa color + inicial como hasta ahora)
--
-- status_*: "Estado del hogar" estilo WhatsApp, NATIVO y privado para la familia.
--   No es ubicación con tracking: es un check-in voluntario que el integrante
--   pone y borra cuando quiere (canon §15 Mural / §17 ubicación voluntaria).
ALTER TABLE persons ADD COLUMN avatar TEXT;
ALTER TABLE persons ADD COLUMN status_emoji TEXT;
ALTER TABLE persons ADD COLUMN status_text TEXT;
ALTER TABLE persons ADD COLUMN status_set_at TEXT;


-- ===== SOURCE 278_family_post_comments.sql =====
-- U2-UX B2: comentarios por aviso del Mural (mata el "lo hablamos por WhatsApp").
-- Hilo simple por post; autor por usuario y/o persona; reacción emoji opcional.
CREATE TABLE IF NOT EXISTS family_post_comments (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  author_user_id TEXT,
  author_person_id TEXT,
  body TEXT NOT NULL,
  reaction TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_family_post_comments_post
  ON family_post_comments(post_id, created_at);


-- ===== SOURCE 279_assistant_proposals.sql =====
-- CP1c-FUNC-MIN-3.1 — Proposal Store del AI Orchestrator seguro de Domi.
--
-- Domi NO ejecuta acciones directamente. Cuando una intención implica una
-- acción con side-effects, el orquestador crea una PROPUESTA aquí (status
-- 'pending'). Un humano la confirma o la rechaza. Solo al confirmar se ejecuta
-- la acción real (y queda status 'executed'). Es el mismo espíritu que
-- document_route_candidates (Bandeja Inteligente), generalizado al asistente.
--
-- Estados: pending -> confirmed -> executed | failed ; pending -> rejected ;
--          pending -> expired.
CREATE TABLE IF NOT EXISTS assistant_proposals (
  id                     TEXT PRIMARY KEY,
  household_id           TEXT NOT NULL,
  organization_id        TEXT,
  person_id              TEXT,            -- integrante relacionado (opcional)
  user_id                TEXT,            -- quién inició la conversación
  tool_name              TEXT NOT NULL,   -- contrato en registry.py
  category               TEXT,            -- shopping|study|family|health|finance|calm|...
  title                  TEXT,
  summary                TEXT,            -- explicación humana de qué propone
  sensitive              INTEGER NOT NULL DEFAULT 0,
  requires_confirmation  INTEGER NOT NULL DEFAULT 1,
  proposed_payload       TEXT,            -- JSON con los args propuestos (editable por el usuario)
  provider               TEXT,            -- mock|openai (qué generó la propuesta)
  status                 TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|rejected|expired|executed|failed
  created_at             TEXT NOT NULL,
  expires_at             TEXT,
  decided_by_user_id     TEXT,            -- quién confirmó/rechazó
  decided_at             TEXT,
  result_resource_type   TEXT,            -- qué se creó al ejecutar (shopping_item|unit_function|family_post)
  result_resource_id     TEXT,
  error                  TEXT             -- mensaje si status='failed' (sin secretos)
);
CREATE INDEX IF NOT EXISTS idx_ap_household_status ON assistant_proposals(household_id, status);
CREATE INDEX IF NOT EXISTS idx_ap_person ON assistant_proposals(person_id);
CREATE INDEX IF NOT EXISTS idx_ap_user ON assistant_proposals(user_id);


-- ===== SOURCE 280_invitation_person_link.sql =====
-- CP1d-FAMILY-PILOT-1a: vínculo opcional invitación → persona del hogar.
-- Al aceptar la invitación, si person_id apunta a una persona del hogar sin
-- user_id, se enlaza persons.user_id con el usuario recién incorporado.
ALTER TABLE household_invitations ADD COLUMN person_id TEXT;


-- ===== SOURCE 281_minor_guardian_model.sql =====
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


-- ===== SOURCE 282_memory_visibility_scope.sql =====
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


-- ===== SOURCE 283_family_reminders.sql =====
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


-- ===== SOURCE 284_web_push_subscriptions.sql =====
-- OPS-2 M7.B — Suscripciones Web Push (VAPID) por dispositivo/usuario.
--
-- Cada navegador que acepta notificaciones crea una suscripción (endpoint +
-- claves p256dh/auth). El backend cifra y envía a ese endpoint cuando un
-- recordatorio vence (disparado por un Cron Job → /assistant/reminders/tick).
-- Todo esto es OPCIONAL y fail-closed: sin llaves VAPID en el entorno, el push
-- está DESHABILITADO y los recordatorios siguen avisando dentro de la app (M7.A).
--
-- endpoint es único por suscripción; si el mismo navegador re-suscribe, se
-- actualiza (upsert por endpoint).
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id             TEXT PRIMARY KEY,
  household_id   TEXT NOT NULL,
  person_id      TEXT,             -- integrante dueño del dispositivo (para dirigir el push)
  user_id        TEXT,             -- cuenta que se suscribió
  endpoint       TEXT NOT NULL,
  p256dh         TEXT NOT NULL,
  auth           TEXT NOT NULL,
  ua             TEXT,             -- user-agent (diagnóstico; sin datos sensibles)
  created_at     TEXT NOT NULL,
  last_ok_at     TEXT,             -- último envío exitoso
  failing_since  TEXT              -- si el endpoint empieza a fallar (410/404 → se borra)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wps_endpoint ON web_push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_wps_household ON web_push_subscriptions(household_id);
CREATE INDEX IF NOT EXISTS idx_wps_person ON web_push_subscriptions(person_id);


-- ===== SOURCE 285_memory_library_metadata.sql =====
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


-- ===== SOURCE 286_family_documents.sql =====
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


-- ===== SOURCE 287_family_music_links.sql =====
-- OPS-2 M10 — MUSIC-0: biblioteca musical familiar por ENLACES.
--
-- Fase 0 del canon de música: la familia guarda enlaces de servicios musicales
-- (Spotify/YouTube/Amazon/Deezer/SoundCloud/Apple) etiquetados por momento, y se
-- abren con acción explícita del usuario. SIN OAuth, SIN tokens, SIN passwords;
-- nada de esto pasa por el modelo. El backend VALIDA que el enlace pertenezca a
-- un dominio musical permitido (allowlist anti-phishing).
-- MUSIC-1 (OAuth + control de reproducción) y MUSIC-2 (listas familiares +
-- restricciones de menores) son fases posteriores con infra del Owner.
CREATE TABLE IF NOT EXISTS family_music_links (
  id                TEXT PRIMARY KEY,
  household_id      TEXT NOT NULL,
  person_id         TEXT,             -- para quién es (opcional; NULL = de la familia)
  added_by_user_id  TEXT,
  title             TEXT NOT NULL,
  url               TEXT NOT NULL,
  service           TEXT NOT NULL,    -- spotify|youtube|amazon|deezer|soundcloud|apple
  mood              TEXT NOT NULL DEFAULT 'general'
                    CHECK (mood IN ('general','calma','energia','estudio','dormir','fiesta')),
  created_at        TEXT NOT NULL,
  deleted_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_fml_household ON family_music_links(household_id, mood);

