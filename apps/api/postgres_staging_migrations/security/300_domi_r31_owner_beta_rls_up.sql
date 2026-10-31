-- VANTDOMUS DOMI R31: candidate RLS foundation for the REAL 57-table schema.
-- NOT deployed. First execute on disposable PostgreSQL and later, only after
-- explicit change approval, on Neon isolated validation branch (never main).
-- The app must remain offline: 53 of 57 tables are deliberately inaccessible.
-- Requires a direct, transaction-capable admin/migration connection.
--
-- DRIFT GATE: abort rather than silently allow a new or missing table.
DO $r31$
DECLARE actual text[]; expected text[] := ARRAY[
    'adherence_plans',
    'agent_hub_events',
    'alerts',
    'assistant_action_log',
    'assistant_proposals',
    'assistant_recommendations',
    'audit_log',
    'auth_login_attempts',
    'auth_sessions',
    'coupling_gateways',
    'daily_activities',
    'device_tokens',
    'document_route_candidates',
    'email_verification_tokens',
    'event_actors',
    'events',
    'evidence_items',
    'expenses',
    'family_board_posts',
    'family_documents',
    'family_music_links',
    'family_post_comments',
    'family_reminders',
    'features_daily',
    'function_events',
    'guardian_consents',
    'guardian_relationships',
    'household_invitations',
    'household_memberships',
    'household_shopping_items',
    'households',
    'logbook_entries',
    'medication_state',
    'memory_items',
    'notification_outbox',
    'notification_targets',
    'organization_memberships',
    'organizations',
    'password_reset_tokens',
    'person_support_profile',
    'persons',
    'progress_snapshots',
    'reward_events',
    'reward_rules',
    'scheduler_runs',
    'security_events',
    'signed_file_tokens',
    'state_snapshot',
    'task_items',
    'unit_function_responsibles',
    'unit_function_versions',
    'unit_functions',
    'user_mfa',
    'user_mfa_recovery_codes',
    'users',
    'web_push_subscriptions',
    'webhook_ingest_log'
  ];
BEGIN
 SELECT array_agg(c.relname::text ORDER BY c.relname::text)
 INTO actual FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r';
 IF actual IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'R31_SCHEMA_DRIFT: exact 57-table inventory required';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public') THEN
   RAISE EXCEPTION 'R31_POLICY_COLLISION: independently review existing policies';
 END IF;
END $r31$;

DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='domi_app_runtime') THEN
  CREATE ROLE domi_app_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
    NOCREATEDB NOCREATEROLE NOREPLICATION;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='domi_r31_auth_owner') THEN
  CREATE ROLE domi_r31_auth_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
    NOCREATEDB NOCREATEROLE NOREPLICATION;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles
   WHERE rolname IN ('domi_app_runtime','domi_r31_auth_owner')
   AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit)) THEN
  RAISE EXCEPTION 'R31_ROLE_PRIVILEGE_GATE: unsafe inherited/admin rights';
 END IF;
END $roles$;

CREATE SCHEMA IF NOT EXISTS domi_r31;
GRANT USAGE ON SCHEMA public TO domi_app_runtime,domi_r31_auth_owner;
GRANT USAGE ON SCHEMA domi_r31 TO domi_app_runtime,domi_r31_auth_owner;
GRANT CREATE ON SCHEMA domi_r31 TO domi_r31_auth_owner;

-- Enable row security on all 57 tables. No runtime grants except the four
-- scoped owner-beta tables below. Ordinary unlisted rows are denied.
DO $lockdown$
DECLARE table_name text;
BEGIN
 FOR table_name IN
  SELECT c.relname::text FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
 LOOP
  EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE pg_catalog.format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',table_name);
  IF table_name NOT IN ('households','household_memberships','persons','memory_items') THEN
   EXECUTE pg_catalog.format(
    'CREATE POLICY domi_r31_closed ON public.%I AS PERMISSIVE FOR ALL TO domi_app_runtime USING (false) WITH CHECK (false)',
    table_name);
  END IF;
 END LOOP;
END $lockdown$;

-- A NOLOGIN / NOINHERIT / NOBYPASSRLS SECURITY DEFINER reads only the
-- minimum private tables to authenticate the already-verified JWT claims.
GRANT SELECT ON public.users,public.auth_sessions,public.households,
 public.household_memberships,public.organization_memberships TO domi_r31_auth_owner;

CREATE POLICY domi_r31_auth_internal ON public.users AS PERMISSIVE FOR SELECT
 TO domi_r31_auth_owner USING (true);
CREATE POLICY domi_r31_auth_internal ON public.auth_sessions AS PERMISSIVE FOR SELECT
 TO domi_r31_auth_owner USING (true);
CREATE POLICY domi_r31_auth_internal ON public.households AS PERMISSIVE FOR SELECT
 TO domi_r31_auth_owner USING (true);
CREATE POLICY domi_r31_auth_internal ON public.household_memberships AS PERMISSIVE FOR SELECT
 TO domi_r31_auth_owner USING (true);
CREATE POLICY domi_r31_auth_internal ON public.organization_memberships AS PERMISSIVE FOR SELECT
 TO domi_r31_auth_owner USING (true);

CREATE FUNCTION domi_r31.subject_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp
AS $sql$
 SELECT a.user_id FROM public.auth_sessions a
 JOIN public.users u ON u.id=a.user_id
 WHERE a.user_id=NULLIF(pg_catalog.current_setting('domi.r31_subject',true),'')
 AND a.token_jti=NULLIF(pg_catalog.current_setting('domi.r31_jti',true),'')
 AND a.revoked_at IS NULL AND u.is_active=1
 AND a.expires_at::timestamptz > pg_catalog.clock_timestamp()
 LIMIT 1
$sql$;
ALTER FUNCTION domi_r31.subject_id() OWNER TO domi_r31_auth_owner;
REVOKE ALL ON FUNCTION domi_r31.subject_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_r31.subject_id() TO domi_app_runtime;

CREATE FUNCTION domi_r31.household_ok(p_household text,p_org text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp
AS $sql$
 SELECT EXISTS (
 SELECT 1 FROM public.households h
 JOIN public.household_memberships hm ON hm.household_id=h.id
 WHERE h.id=p_household
 AND h.organization_id IS NOT DISTINCT FROM p_org
 AND hm.user_id=domi_r31.subject_id()
 AND (h.organization_id IS NULL OR EXISTS (
  SELECT 1 FROM public.organization_memberships om
  WHERE om.organization_id=h.organization_id AND om.user_id=hm.user_id
 ))
 )
$sql$;
ALTER FUNCTION domi_r31.household_ok(text,text) OWNER TO domi_r31_auth_owner;
REVOKE ALL ON FUNCTION domi_r31.household_ok(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_r31.household_ok(text,text) TO domi_app_runtime;

-- Owner Beta minimal allowed read surface; no membership/household/person writes.
GRANT SELECT ON public.households,public.household_memberships,public.persons
 TO domi_app_runtime;
GRANT SELECT,INSERT,UPDATE ON public.memory_items TO domi_app_runtime;
CREATE POLICY domi_r31_households_read ON public.households AS PERMISSIVE FOR SELECT
 TO domi_app_runtime
 USING (domi_r31.household_ok(id,organization_id));
CREATE POLICY domi_r31_memberships_self ON public.household_memberships AS PERMISSIVE FOR SELECT
 TO domi_app_runtime
 USING (user_id=domi_r31.subject_id() AND EXISTS(
  SELECT 1 FROM public.households h WHERE h.id=household_id
  AND domi_r31.household_ok(h.id,h.organization_id)
 ));
CREATE POLICY domi_r31_person_self ON public.persons AS PERMISSIVE FOR SELECT
 TO domi_app_runtime
 USING (user_id=domi_r31.subject_id()
   AND domi_r31.household_ok(household_id,organization_id));

-- Only self-owned, consented, non-sensitive, non-deleted, confirmed or factual
-- memories are readable. Other six-layer memory scopes remain CLOSED in R31.
CREATE POLICY domi_r31_memory_self_read ON public.memory_items AS PERMISSIVE FOR SELECT
 TO domi_app_runtime
 USING (
   visibility_scope='private_self'
   AND sensitivity IN ('low','normal')
   AND deleted_at IS NULL
   AND (expires_at IS NULL OR expires_at::timestamptz > pg_catalog.clock_timestamp())
   AND (inference_status IS NULL OR inference_status='confirmed')
   AND COALESCE((consent_scope::jsonb -> 'visible_to') ? 'self',false)
   AND created_by_user_id=domi_r31.subject_id()
   AND domi_r31.household_ok(household_id,organization_id)
   AND EXISTS (
    SELECT 1 FROM public.persons p WHERE p.id=person_id
     AND p.user_id=domi_r31.subject_id()
     AND p.household_id=memory_items.household_id
     AND p.organization_id IS NOT DISTINCT FROM memory_items.organization_id
   )
 );
CREATE POLICY domi_r31_memory_self_insert ON public.memory_items AS PERMISSIVE FOR INSERT
 TO domi_app_runtime WITH CHECK (
   visibility_scope='private_self' AND sensitivity IN ('low','normal')
   AND deleted_at IS NULL AND inference_status IS NULL
   AND COALESCE((consent_scope::jsonb -> 'visible_to') ? 'self',false)
   AND created_by_user_id=domi_r31.subject_id()
   AND domi_r31.household_ok(household_id,organization_id)
   AND EXISTS (SELECT 1 FROM public.persons p WHERE p.id=person_id
    AND p.user_id=domi_r31.subject_id()
    AND p.household_id=memory_items.household_id
    AND p.organization_id IS NOT DISTINCT FROM memory_items.organization_id)
 );
CREATE POLICY domi_r31_memory_self_update ON public.memory_items AS PERMISSIVE FOR UPDATE
 TO domi_app_runtime
 USING (
   visibility_scope='private_self' AND deleted_at IS NULL
   AND created_by_user_id=domi_r31.subject_id()
   AND domi_r31.household_ok(household_id,organization_id)
   AND EXISTS (SELECT 1 FROM public.persons p WHERE p.id=person_id
     AND p.user_id=domi_r31.subject_id()
     AND p.household_id=memory_items.household_id
     AND p.organization_id IS NOT DISTINCT FROM memory_items.organization_id)
 )
 WITH CHECK (
   visibility_scope='private_self' AND sensitivity IN ('low','normal')
   AND COALESCE((consent_scope::jsonb -> 'visible_to') ? 'self',false)
   AND created_by_user_id=domi_r31.subject_id()
   AND domi_r31.household_ok(household_id,organization_id)
   AND EXISTS (SELECT 1 FROM public.persons p WHERE p.id=person_id
     AND p.user_id=domi_r31.subject_id()
     AND p.household_id=memory_items.household_id
     AND p.organization_id IS NOT DISTINCT FROM memory_items.organization_id)
 );
-- R31 remains an OFFLINE security candidate until full auth, grant and policy
-- certification. Never run it directly on Neon production.
