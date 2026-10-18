-- DOMI R63 — OFFLINE READ-ONLY PILOT. NOT a release authorization.
-- R31 + R33 required. The draft write policies were UNSAFE because direct
-- SQL UPDATE(status='confirmed') could forge consent without HTTP approval.
-- Until a separately verified DB-level human authorization exists, runtime
-- MUST NOT receive INSERT/UPDATE/DELETE on proposals or reminders.
-- Do not deploy this candidate to Neon or any existing DB without review.

DO $r63_guard$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r'
   AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n<>57 THEN RAISE EXCEPTION 'R63_RLS_DRIFT: exact 57 FORCE RLS tables required'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='domi_app_runtime' AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcanlogin AND NOT rolinherit
 ) THEN RAISE EXCEPTION 'R63_ROLE_UNSAFE'; END IF;
 IF EXISTS(
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND policyname LIKE 'domi_r63_%'
 ) THEN RAISE EXCEPTION 'R63_POLICY_COLLISION'; END IF;
 -- Refuse unexpected grants rather than silently *leave* a write path open.
 IF has_table_privilege('domi_app_runtime','public.assistant_proposals','INSERT')
 OR has_table_privilege('domi_app_runtime','public.assistant_proposals','UPDATE')
 OR has_table_privilege('domi_app_runtime','public.assistant_proposals','DELETE')
 OR has_table_privilege('domi_app_runtime','public.family_reminders','INSERT')
 OR has_table_privilege('domi_app_runtime','public.family_reminders','UPDATE')
 OR has_table_privilege('domi_app_runtime','public.family_reminders','DELETE')
 THEN RAISE EXCEPTION 'R63_PREEXISTING_WRITE_GRANT'; END IF;
END $r63_guard$;

-- Grant SELECT only and restrict to the requester's signed household.
-- A restricted member may view their own proposals; others remain invisible.
GRANT SELECT ON public.assistant_proposals TO domi_app_runtime;
CREATE POLICY domi_r63_proposal_self_select ON public.assistant_proposals
 FOR SELECT TO domi_app_runtime USING (
  user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND EXISTS (
   SELECT 1 FROM public.household_memberships hm
    WHERE hm.household_id=assistant_proposals.household_id
      AND hm.user_id=domi_r31.subject_id()
      AND hm.role IN ('owner','admin','member')
  )
 );

-- Shared reminders are visible to signed members of the same household only.
-- No INSERT, UPDATE, DELETE or write-audit grants in this pilot.
GRANT SELECT ON public.family_reminders TO domi_app_runtime;
CREATE POLICY domi_r63_reminder_shared_select ON public.family_reminders
 FOR SELECT TO domi_app_runtime USING (
  visibility_scope='household_shared'
  AND domi_r31.household_ok(household_id,organization_id)
  AND EXISTS (
   SELECT 1 FROM public.household_memberships hm
    WHERE hm.household_id=family_reminders.household_id
      AND hm.user_id=domi_r31.subject_id()
      AND hm.role IN ('owner','admin','member')
  )
 );

-- The base R31 closed policies for both tables remain in place.
-- Intentional terminal state: READ-ONLY. Propose/confirm/execute on the
-- signed-RLS PostgreSQL runtime must continue to fail closed until R64+.
