-- DOMI R36 OFFLINE CANDIDATE — R31+R33 additive fail-closed rollback.
-- Execute after R31 migration in a transaction on a DISPOSABLE database.
-- Never run on Neon main. Requires explicit isolated-branch change approval.
-- No RLS/FORCE is disabled, no user data is removed.
DO $r36$
DECLARE n integer; v_rls integer; v_forced integer;
BEGIN
 SELECT COUNT(*)::integer,
        COUNT(*) FILTER(WHERE c.relrowsecurity)::integer,
        COUNT(*) FILTER(WHERE c.relforcerowsecurity)::integer
 INTO n,v_rls,v_forced
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r';
 IF n!=57 OR v_rls!=57 OR v_forced!=57 THEN
   RAISE EXCEPTION 'R36_ROLLBACK_GATE: all 57 tables must remain FORCE RLS';
 END IF;
END $r36$;

-- Fail closed before touching the signing key. Existing four-table R31
-- permissive policies must not remain reachable even if grants are restored.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM domi_app_runtime;
REVOKE EXECUTE ON FUNCTION domi_r31.subject_id() FROM domi_app_runtime;
REVOKE EXECUTE ON FUNCTION domi_r31.household_ok(text,text) FROM domi_app_runtime;
REVOKE USAGE ON SCHEMA domi_r31 FROM domi_app_runtime;

DROP POLICY IF EXISTS domi_r31_households_read ON public.households;
DROP POLICY IF EXISTS domi_r31_memberships_self ON public.household_memberships;
DROP POLICY IF EXISTS domi_r31_person_self ON public.persons;
DROP POLICY IF EXISTS domi_r31_memory_self_read ON public.memory_items;
DROP POLICY IF EXISTS domi_r31_memory_self_insert ON public.memory_items;
DROP POLICY IF EXISTS domi_r31_memory_self_update ON public.memory_items;
DROP POLICY IF EXISTS domi_r33_private_consent_select ON public.memory_items;
DROP POLICY IF EXISTS domi_r33_private_consent_insert ON public.memory_items;
DROP POLICY IF EXISTS domi_r33_private_consent_update ON public.memory_items;

-- Recreate explicit denials on the four originally open tables. Other 53
-- tables retain their existing R31 domi_r31_closed policies.
DO $policies$
DECLARE target text;
BEGIN
 FOREACH target IN ARRAY ARRAY[
  'households','household_memberships','persons','memory_items'
 ] LOOP
  IF NOT EXISTS (
   SELECT 1 FROM pg_catalog.pg_policies
   WHERE schemaname='public' AND tablename=target
     AND policyname='domi_r31_closed'
  ) THEN
   EXECUTE pg_catalog.format(
    'CREATE POLICY domi_r31_closed ON public.%I FOR ALL TO domi_app_runtime '
    'USING (false) WITH CHECK (false)', target);
  END IF;
 END LOOP;
END $policies$;

-- The R33 signing key is operationally invalidated, but the restricted table
-- and its FORCE RLS stay intact for audited migration history.
DELETE FROM domi_r31.context_secrets WHERE key_name='active';

DO $assert$
DECLARE n integer; v_rls integer; v_forced integer;
BEGIN
 SELECT COUNT(*)::integer,
        COUNT(*) FILTER(WHERE c.relrowsecurity)::integer,
        COUNT(*) FILTER(WHERE c.relforcerowsecurity)::integer
 INTO n,v_rls,v_forced
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r';
 IF n!=57 OR v_rls!=57 OR v_forced!=57 THEN
   RAISE EXCEPTION 'R36_ROLLBACK_INCOMPLETE';
 END IF;
END $assert$;
