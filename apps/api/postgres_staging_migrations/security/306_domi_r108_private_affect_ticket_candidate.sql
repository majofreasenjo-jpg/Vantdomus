-- DOMI R108: OFFLINE/DISPOSABLE ONLY consent-ticket candidate.
-- NOT AUTHORIZED for Neon, deployment, family-live, or production.
-- A ticket inserted by a separate, trusted human-consent authority is
-- consumed ONCE by the verified signed R33 subject. This script does NOT
-- implement or authorize the issuer. Runtime can never mint a ticket.
-- PRIVATE schema: public retains exactly 57 R31/R33 FORCE-RLS tables.
-- Security ceiling: signed login + issued ticket != proof of human consent
-- unless a separately audited, human-controlled issuer exists.
DO $guard$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='public' AND c.relkind='r'
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n<>57 THEN RAISE EXCEPTION 'R108_BASE_SCHEMA_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='domi_affect')
    THEN RAISE EXCEPTION 'R108_COLLISION'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='domi_app_runtime'
    AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper
    AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb
  ) THEN RAISE EXCEPTION 'R108_RUNTIME_ROLE_UNSAFE'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='domi_r31' AND p.proname='subject_id'
    AND p.prosecdef
  ) THEN RAISE EXCEPTION 'R108_SIGNED_SUBJECT_MISSING'; END IF;
END $guard$;

CREATE ROLE domi_affect_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
  NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE SCHEMA domi_affect AUTHORIZATION domi_affect_owner;
REVOKE ALL ON SCHEMA domi_affect FROM PUBLIC;
GRANT USAGE ON SCHEMA domi_affect TO domi_app_runtime;

-- A voucher can be issued ONLY by a separately accredited authority.
-- The app runtime has no access to this table, including metadata.
CREATE TABLE domi_affect.approved_tickets (
  id uuid PRIMARY KEY,
  household_id text NOT NULL,
  person_id text NOT NULL,
  memory_id text NOT NULL,
  memory_updated_at text NOT NULL,
  memory_content_sha256 bytea NOT NULL CHECK (octet_length(memory_content_sha256)=32),
  ratified_by_user_id text NOT NULL,
  context_key text NOT NULL CHECK(context_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  valence double precision NOT NULL CHECK (valence BETWEEN -1 AND 1),
  activation double precision NOT NULL CHECK (activation BETWEEN 0 AND 1),
  relevance double precision NOT NULL CHECK (relevance BETWEEN 0 AND 1),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at>issued_at)
);
ALTER TABLE domi_affect.approved_tickets OWNER TO domi_affect_owner;
ALTER TABLE domi_affect.approved_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_affect.approved_tickets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON domi_affect.approved_tickets FROM PUBLIC,domi_app_runtime;
CREATE POLICY domi_r108_owner_only_tickets ON domi_affect.approved_tickets
  FOR ALL TO domi_affect_owner USING (true) WITH CHECK (true);

CREATE TABLE domi_affect.memory_links (
  id uuid PRIMARY KEY,
  receipt_id uuid NOT NULL UNIQUE,
  household_id text NOT NULL,
  person_id text NOT NULL,
  memory_id text NOT NULL,
  memory_updated_at text NOT NULL,
  memory_content_sha256 bytea NOT NULL CHECK(octet_length(memory_content_sha256)=32),
  context_key text NOT NULL,
  valence double precision NOT NULL,
  activation double precision NOT NULL,
  relevance double precision NOT NULL,
  ratified_by_user_id text NOT NULL,
  ratified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz
);
ALTER TABLE domi_affect.memory_links OWNER TO domi_affect_owner;
ALTER TABLE domi_affect.memory_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_affect.memory_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON domi_affect.memory_links FROM PUBLIC,domi_app_runtime;
CREATE POLICY domi_r108_owner_only_links ON domi_affect.memory_links
  FOR ALL TO domi_affect_owner USING (true) WITH CHECK (true);

-- Only source metadata and content-verification bytes. The owner is not
-- permitted to read all household memory. RLS checks the signed subject.
GRANT EXECUTE ON FUNCTION domi_r31.subject_id() TO domi_affect_owner;
GRANT EXECUTE ON FUNCTION domi_r31.household_ok(text,text) TO domi_affect_owner;
GRANT SELECT(id,household_id,organization_id,user_id)
  ON public.persons TO domi_affect_owner;
GRANT SELECT(id,household_id,organization_id,person_id,content,
  created_by_user_id,updated_at,deleted_at,expires_at,
  visibility_scope,source,sensitivity,inference_status,verified_at,
  consent_scope) ON public.memory_items TO domi_affect_owner;
CREATE POLICY domi_r108_person_self ON public.persons
  FOR SELECT TO domi_affect_owner USING (
    user_id=domi_r31.subject_id()
    AND domi_r31.household_ok(household_id,organization_id)
  );
CREATE POLICY domi_r108_memory_self ON public.memory_items
  FOR SELECT TO domi_affect_owner USING (
    created_by_user_id=domi_r31.subject_id()
    AND visibility_scope='private_self'
    AND source='family'
    AND sensitivity IN ('normal','low')
    AND inference_status='confirmed' AND verified_at IS NOT NULL
    AND deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at::timestamptz > pg_catalog.clock_timestamp())
    AND COALESCE((consent_scope::jsonb -> 'visible_to') ? 'self', false)
    AND domi_r31.household_ok(household_id,organization_id)
    AND EXISTS(
      SELECT 1 FROM public.persons p
      WHERE p.id=person_id AND p.user_id=domi_r31.subject_id()
        AND p.household_id=memory_items.household_id
        AND p.organization_id IS NOT DISTINCT FROM memory_items.organization_id
    )
  );

-- No arbitrary mutation: only a verified ticket is redeemable, one time.
-- Redeeming NEVER creates a consent record from a client-supplied boolean.
CREATE FUNCTION domi_affect.redeem_ticket(p_ticket uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $redeem$
DECLARE v_uid text;
DECLARE t domi_affect.approved_tickets%ROWTYPE;
DECLARE v_new uuid;
BEGIN
  v_uid=domi_r31.subject_id();
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO t FROM domi_affect.approved_tickets
  WHERE id=p_ticket AND ratified_by_user_id=v_uid
    AND used_at IS NULL AND revoked_at IS NULL
    AND issued_at<=pg_catalog.clock_timestamp()
    AND expires_at>pg_catalog.clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memory_items m
    JOIN public.persons p ON p.id=m.person_id
    WHERE m.id=t.memory_id AND m.person_id=t.person_id
      AND m.household_id=t.household_id
      AND p.household_id=t.household_id AND p.user_id=v_uid
      AND p.organization_id IS NOT DISTINCT FROM m.organization_id
      AND m.created_by_user_id=v_uid
      AND m.visibility_scope='private_self'
      AND m.source='family'
      AND m.sensitivity IN ('normal','low')
      AND m.inference_status='confirmed' AND m.verified_at IS NOT NULL
      AND m.deleted_at IS NULL
      AND (m.expires_at IS NULL OR m.expires_at::timestamptz>pg_catalog.clock_timestamp())
      AND m.updated_at=t.memory_updated_at
      AND public.digest(pg_catalog.convert_to(m.content,'UTF8'),'sha256')=t.memory_content_sha256
      AND m.consent_scope::jsonb='{"visible_to":["self"]}'::jsonb
      AND domi_r31.household_ok(m.household_id,m.organization_id)
  ) THEN RETURN NULL; END IF;

  v_new=pg_catalog.gen_random_uuid();
  INSERT INTO domi_affect.memory_links
    (id,receipt_id,household_id,person_id,memory_id,memory_updated_at,
     memory_content_sha256,context_key,valence,activation,relevance,
     ratified_by_user_id)
  VALUES
    (v_new,t.id,t.household_id,t.person_id,t.memory_id,t.memory_updated_at,
     t.memory_content_sha256,t.context_key,t.valence,t.activation,
     t.relevance,v_uid);
  UPDATE domi_affect.approved_tickets
  SET used_at=pg_catalog.clock_timestamp()
  WHERE id=t.id AND used_at IS NULL;
  RETURN v_new;
END;
$redeem$;
ALTER FUNCTION domi_affect.redeem_ticket(uuid) OWNER TO domi_affect_owner;
REVOKE ALL ON FUNCTION domi_affect.redeem_ticket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_affect.redeem_ticket(uuid) TO domi_app_runtime;

-- No INSERT/UPDATE/DELETE/SELECT on either private table for application.
-- There is intentionally NO ticket issuer in R108: cannot certify production.
