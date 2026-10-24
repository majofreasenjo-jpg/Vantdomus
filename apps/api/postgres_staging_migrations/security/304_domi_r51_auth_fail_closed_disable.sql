-- DOMI R51: fail-closed AUTH QUARANTINE for the R50 candidate.
-- OFFLINE/CI ONLY; must not be applied to Neon without separate approval.
-- Does not drop any data, policies, schemas or public-table RLS.
-- Existing sessions may remain connected but cannot execute exposed routines.
DO $guard$
DECLARE total integer; enforced integer;
BEGIN
 SELECT count(*)::integer,
        count(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity)::integer
 INTO total,enforced
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r';
 IF total<>57 OR enforced<>57 THEN
    RAISE EXCEPTION 'DOMI_R51_DISABLE_GATE: 57 public FORCE RLS tables required';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='domi_auth'
 ) OR (SELECT count(*) FROM pg_catalog.pg_roles
       WHERE rolname IN ('domi_auth_lookup','domi_auth_session_issuer'))<>2 THEN
   RAISE EXCEPTION 'DOMI_R51_DISABLE_GATE: missing auth components';
 END IF;
END $guard$;

-- NOLOGIN closes new sessions; revoking USAGE/EXECUTE also closes sessions
-- authenticated before the downgrade (after catalog invalidation).
ALTER ROLE domi_auth_lookup NOLOGIN;
ALTER ROLE domi_auth_session_issuer NOLOGIN;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA domi_auth
 FROM PUBLIC,domi_auth_lookup,domi_auth_session_issuer,domi_app_runtime;
REVOKE USAGE ON SCHEMA domi_auth
 FROM PUBLIC,domi_auth_lookup,domi_auth_session_issuer,domi_app_runtime;

DO $assert$
DECLARE total integer; forced integer;
BEGIN
 SELECT count(*)::integer,
        count(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity)::integer
 INTO total,forced
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r';
 IF total<>57 OR forced<>57 THEN
    RAISE EXCEPTION 'DOMI_R51_DISABLE_FAILED: FORCE RLS was lost';
 END IF;
 IF EXISTS (
   SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN
   ('domi_auth_lookup','domi_auth_session_issuer') AND rolcanlogin
 ) THEN RAISE EXCEPTION 'DOMI_R51_DISABLE_FAILED: login still enabled'; END IF;
END $assert$;
