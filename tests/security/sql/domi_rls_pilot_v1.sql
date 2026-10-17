-- DOMI R8: synthetic proof of PostgreSQL RLS in a disposable GitHub Actions database.
-- NEVER execute against Neon, staging, or production.
-- Owner is the ephemeral CI postgres account, NOT the proposed Neon owner.
CREATE ROLE domi_pilot_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
CREATE ROLE domi_pilot_auth_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
CREATE SCHEMA domi_pilot;
REVOKE ALL ON SCHEMA domi_pilot FROM PUBLIC;
GRANT USAGE ON SCHEMA domi_pilot TO domi_pilot_app;
GRANT USAGE ON SCHEMA domi_pilot TO domi_pilot_auth_owner;

CREATE TABLE domi_pilot.users (
  id text PRIMARY KEY,
  is_active boolean NOT NULL,
  password_hash text NOT NULL
);
CREATE TABLE domi_pilot.organizations (
  id text PRIMARY KEY
);
CREATE TABLE domi_pilot.households (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES domi_pilot.organizations(id)
);
CREATE TABLE domi_pilot.household_memberships (
  user_id text NOT NULL REFERENCES domi_pilot.users(id),
  household_id text NOT NULL REFERENCES domi_pilot.households(id),
  role text NOT NULL,
  PRIMARY KEY (user_id, household_id)
);
CREATE TABLE domi_pilot.auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES domi_pilot.users(id),
  token_jti text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE domi_pilot.task_items (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES domi_pilot.households(id),
  organization_id text NOT NULL REFERENCES domi_pilot.organizations(id),
  title text NOT NULL
);

INSERT INTO domi_pilot.users VALUES ('u-a', true, 'synthetic_a'), ('u-b', true, 'synthetic_b'), ('u-disabled', false, 'synthetic_c');
INSERT INTO domi_pilot.organizations VALUES ('o-a'), ('o-b');
INSERT INTO domi_pilot.households VALUES ('h-a','o-a'), ('h-b','o-b');
INSERT INTO domi_pilot.household_memberships VALUES
  ('u-a','h-a','owner'),('u-b','h-b','owner');
INSERT INTO domi_pilot.auth_sessions VALUES
  ('s-a','u-a','jti-a',clock_timestamp() + interval '1 day',NULL),
  ('s-b','u-b','jti-b',clock_timestamp() + interval '1 day',NULL),
  ('s-rev','u-a','jti-rev',clock_timestamp() + interval '1 day',NULL),
  ('s-exp','u-a','jti-expired',clock_timestamp() - interval '1 day',NULL),
  ('s-disabled','u-disabled','jti-disabled',clock_timestamp() + interval '1 day',NULL);
INSERT INTO domi_pilot.task_items VALUES
  ('t-a','h-a','o-a','Tarea A sintética'),
  ('t-b','h-b','o-b','Tarea B sintética');

-- Private tables deny runtime direct access. Even an accidental grant is
-- subject to RLS deny-by-default because they have no permissive policies.
ALTER TABLE domi_pilot.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.users FORCE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.auth_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.households FORCE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.household_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.household_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.task_items FORCE ROW LEVEL SECURITY;

-- Only the non-login authentication function owner may read required private
-- metadata, without BYPASSRLS. The runtime app has NO direct table grants.
CREATE POLICY auth_user_lookup ON domi_pilot.users FOR SELECT TO domi_pilot_auth_owner
  USING (current_user = 'domi_pilot_auth_owner');
CREATE POLICY auth_session_lookup ON domi_pilot.auth_sessions FOR SELECT TO domi_pilot_auth_owner
  USING (current_user = 'domi_pilot_auth_owner');
CREATE POLICY auth_household_lookup ON domi_pilot.households FOR SELECT TO domi_pilot_auth_owner
  USING (current_user = 'domi_pilot_auth_owner');
CREATE POLICY auth_membership_lookup ON domi_pilot.household_memberships FOR SELECT TO domi_pilot_auth_owner
  USING (current_user = 'domi_pilot_auth_owner');
GRANT SELECT (id,is_active) ON domi_pilot.users TO domi_pilot_auth_owner;
GRANT SELECT (user_id,token_jti,expires_at,revoked_at) ON domi_pilot.auth_sessions TO domi_pilot_auth_owner;
GRANT SELECT (id,organization_id) ON domi_pilot.households TO domi_pilot_auth_owner;
GRANT SELECT (user_id,household_id) ON domi_pilot.household_memberships TO domi_pilot_auth_owner;


-- SECURITY DEFINER is constrained to a fixed search_path, fully-qualified
-- tables and single-purpose boolean/text returns. Do not expose auth hashes.
CREATE FUNCTION domi_pilot.activate_session(p_user_id text, p_jti text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  -- A failed activation MUST clear a previous identity in the same transaction.
  PERFORM pg_catalog.set_config('domi_pilot.uid', '', true);
  PERFORM pg_catalog.set_config('domi_pilot.jti', '', true);
  IF p_user_id IS NULL OR p_jti IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM domi_pilot.auth_sessions s
    JOIN domi_pilot.users u ON u.id = s.user_id
    WHERE s.user_id=p_user_id AND s.token_jti=p_jti
      AND u.is_active AND s.revoked_at IS NULL
      AND s.expires_at > pg_catalog.clock_timestamp()
  ) THEN
    PERFORM pg_catalog.set_config('domi_pilot.uid', p_user_id, true);
    PERFORM pg_catalog.set_config('domi_pilot.jti', p_jti, true);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE FUNCTION domi_pilot.verified_subject()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT s.user_id
  FROM domi_pilot.auth_sessions s
  JOIN domi_pilot.users u ON u.id = s.user_id
  WHERE s.user_id = NULLIF(pg_catalog.current_setting('domi_pilot.uid',true),'')
    AND s.token_jti = NULLIF(pg_catalog.current_setting('domi_pilot.jti',true),'')
    AND u.is_active AND s.revoked_at IS NULL
    AND s.expires_at > pg_catalog.clock_timestamp()
  LIMIT 1;
$$;

CREATE FUNCTION domi_pilot.has_household_access(p_household_id text, p_organization_id text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM domi_pilot.households h
    JOIN domi_pilot.household_memberships hm ON hm.household_id=h.id
    WHERE h.id=p_household_id AND h.organization_id=p_organization_id
      AND hm.user_id=domi_pilot.verified_subject()
  );
$$;

ALTER FUNCTION domi_pilot.activate_session(text,text) OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_pilot.verified_subject() OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_pilot.has_household_access(text,text) OWNER TO domi_pilot_auth_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA domi_pilot FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_pilot.activate_session(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_pilot.verified_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_pilot.has_household_access(text,text) FROM PUBLIC;

-- Only the app's protected data table is accessible directly.
GRANT EXECUTE ON FUNCTION domi_pilot.activate_session(text,text) TO domi_pilot_app;
GRANT EXECUTE ON FUNCTION domi_pilot.has_household_access(text,text) TO domi_pilot_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON domi_pilot.task_items TO domi_pilot_app;

CREATE POLICY task_scope ON domi_pilot.task_items
FOR ALL TO domi_pilot_app
USING (domi_pilot.has_household_access(household_id,organization_id))
WITH CHECK (domi_pilot.has_household_access(household_id,organization_id));


-- CI-only compatibility alias for the real API's PostgreSQL session contract.
-- This does not create or modify anything in Neon or production.
CREATE SCHEMA domi_auth;
REVOKE ALL ON SCHEMA domi_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA domi_auth TO domi_pilot_app;
GRANT USAGE ON SCHEMA domi_auth TO domi_pilot_auth_owner;
CREATE FUNCTION domi_auth.activate_session(p_user_id text, p_jti text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT domi_pilot.activate_session(p_user_id,p_jti);
$$;
ALTER FUNCTION domi_auth.activate_session(text,text) OWNER TO domi_pilot_auth_owner;
REVOKE ALL ON FUNCTION domi_auth.activate_session(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_auth.activate_session(text,text) TO domi_pilot_app;
