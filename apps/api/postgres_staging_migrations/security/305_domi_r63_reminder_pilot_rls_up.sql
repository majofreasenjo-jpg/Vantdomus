-- DOMI R63 — OFFLINE CANDIDATE: permit only mock-backed family reminders
-- via a verified signed RLS runtime member; never auto-deploy on Neon.
-- R31/R33 are prerequisites. Extends four of the otherwise CLOSED 53 tables.
-- Does NOT implement proof of human consent inside SQL; HTTP confirmation
-- remains mandatory. No production or customer data permitted.
DO $r63_guard$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='public' AND c.relkind='r'
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n<>57 THEN RAISE EXCEPTION 'R63_RLS_DRIFT: exactly 57 force-RLS tables required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='domi_app_runtime'
    AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT rolinherit)
  THEN RAISE EXCEPTION 'R63_ROLE_UNSAFE'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND policyname LIKE 'domi_r63_%')
  THEN RAISE EXCEPTION 'R63_POLICY_COLLISION'; END IF;
END $r63_guard$;

-- Proposals: the caller may read only their own proposal, never change the
-- household, user, tool, payload or class after the original INSERT.
-- Only 'mock' is eligible for this CI pilot; Claude remains OFF.
GRANT SELECT ON public.assistant_proposals TO domi_app_runtime;
GRANT INSERT (
  id,household_id,organization_id,person_id,user_id,tool_name,
  category,title,summary,sensitive,requires_confirmation,
  proposed_payload,provider,status,created_at,expires_at
) ON public.assistant_proposals TO domi_app_runtime;
GRANT UPDATE (
  status,decided_by_user_id,decided_at,result_resource_type,
  result_resource_id,error
) ON public.assistant_proposals TO domi_app_runtime;

-- A membership must have real writing authority in the signed household.
-- A role of 'viewer' is deliberately excluded.
CREATE POLICY domi_r63_proposal_self_select ON public.assistant_proposals
 FOR SELECT TO domi_app_runtime USING (
  user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND EXISTS (
   SELECT 1 FROM public.household_memberships hm
    WHERE hm.household_id=assistant_proposals.household_id
      AND hm.user_id=domi_r31.subject_id()
      AND hm.role IN ('owner','admin','member'))
 );
CREATE POLICY domi_r63_proposal_self_insert ON public.assistant_proposals
 FOR INSERT TO domi_app_runtime WITH CHECK (
  user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND EXISTS (
   SELECT 1 FROM public.household_memberships hm
    WHERE hm.household_id=assistant_proposals.household_id
      AND hm.user_id=domi_r31.subject_id()
      AND hm.role IN ('owner','admin','member'))
  AND person_id IS NULL AND tool_name='propose_family_reminder'
  AND category='family' AND provider='mock' AND status='pending'
  AND sensitive=1 AND requires_confirmation=1
 );
CREATE POLICY domi_r63_proposal_self_update ON public.assistant_proposals
 FOR UPDATE TO domi_app_runtime
 USING (
  user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND provider='mock' AND tool_name='propose_family_reminder'
  AND EXISTS (
   SELECT 1 FROM public.household_memberships hm
    WHERE hm.household_id=assistant_proposals.household_id
      AND hm.user_id=domi_r31.subject_id()
      AND hm.role IN ('owner','admin','member'))
 )
 WITH CHECK (
  user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND provider='mock' AND tool_name='propose_family_reminder'
  AND status IN ('pending','confirmed','executed','failed','rejected','expired')
  AND EXISTS (
   SELECT 1 FROM public.household_memberships hm
    WHERE hm.household_id=assistant_proposals.household_id
      AND hm.user_id=domi_r31.subject_id()
      AND hm.role IN ('owner','admin','member'))
 );

-- Shared reminder rows: users may read only their household's shared entries.
-- New writes must correspond to their own already claimed mock proposal.
GRANT SELECT ON public.family_reminders TO domi_app_runtime;
GRANT INSERT (
  id,household_id,organization_id,person_id,created_by_user_id,
  title,body,remind_at,channel,visibility_scope,status,dedupe_key,created_at
) ON public.family_reminders TO domi_app_runtime;
CREATE POLICY domi_r63_reminder_shared_select ON public.family_reminders
 FOR SELECT TO domi_app_runtime USING (
  visibility_scope='household_shared'
  AND domi_r31.household_ok(household_id,organization_id)
  AND EXISTS (
   SELECT 1 FROM public.household_memberships hm
    WHERE hm.household_id=family_reminders.household_id
      AND hm.user_id=domi_r31.subject_id()
      AND hm.role IN ('owner','admin','member'))
 );
CREATE POLICY domi_r63_reminder_claimed_insert ON public.family_reminders
 FOR INSERT TO domi_app_runtime WITH CHECK (
  created_by_user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND person_id IS NULL AND visibility_scope='household_shared'
  AND channel='in_app' AND status='pending'
  AND dedupe_key LIKE 'assistant-proposal-%'
  AND EXISTS (
   SELECT 1 FROM public.assistant_proposals ap
   WHERE ap.id=substring(family_reminders.dedupe_key from 20)
     AND ap.household_id=family_reminders.household_id
     AND ap.organization_id IS NOT DISTINCT FROM family_reminders.organization_id
     AND ap.user_id=domi_r31.subject_id()
     AND ap.tool_name='propose_family_reminder'
     AND ap.provider='mock' AND ap.status='confirmed')
 );

-- Append-only audit: no runtime SELECT/UPDATE/DELETE rights at all.
GRANT INSERT (
 id,household_id,organization_id,user_id,action,resource_type,
 resource_id,metadata,created_at
) ON public.audit_log TO domi_app_runtime;
CREATE POLICY domi_r63_audit_append ON public.audit_log
 FOR INSERT TO domi_app_runtime WITH CHECK (
  user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND action IN ('assistant_proposed','assistant_executed',
                 'assistant_proposal_edited','assistant_rejected')
  AND resource_type IN ('assistant_proposal','family_reminder')
 );

GRANT INSERT (
 id,household_id,organization_id,user_id,tool_name,
 arguments,result,status,created_at
) ON public.assistant_action_log TO domi_app_runtime;
CREATE POLICY domi_r63_action_append ON public.assistant_action_log
 FOR INSERT TO domi_app_runtime WITH CHECK (
  user_id=domi_r31.subject_id()
  AND domi_r31.household_ok(household_id,organization_id)
  AND tool_name='propose_family_reminder'
  AND status IN ('success','error')
 );
