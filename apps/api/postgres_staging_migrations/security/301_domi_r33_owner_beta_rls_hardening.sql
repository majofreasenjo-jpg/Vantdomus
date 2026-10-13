-- DOMI R33 OFFLINE CANDIDATE: transaction-bound RLS identity and write minimization.
-- Requires R31. NEVER automatically execute on Neon or production.
-- Do not seed an operational secret in migration source; without a secret
-- every RLS identity check MUST fail closed.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE TABLE domi_r31.context_secrets (
  key_name text PRIMARY KEY,
  secret_key bytea NOT NULL
);
ALTER TABLE domi_r31.context_secrets OWNER TO domi_r31_auth_owner;
ALTER TABLE domi_r31.context_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_r31.context_secrets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON domi_r31.context_secrets FROM PUBLIC, domi_app_runtime;
CREATE POLICY domi_r33_private_key ON domi_r31.context_secrets
  FOR SELECT TO domi_r31_auth_owner USING (true);

-- This replaces the forgeable R31 GUC-only subject lookup. A client can set
-- custom PostgreSQL GUC values freely, but cannot generate the server HMAC
-- for a different subject/JTI/transaction without the out-of-band secret.
CREATE OR REPLACE FUNCTION domi_r31.subject_id() RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $body$
DECLARE v_user text;
DECLARE v_jti text;
DECLARE v_issued text;
DECLARE v_nonce text;
DECLARE v_mac text;
DECLARE v_key bytea;
DECLARE v_expected text;
DECLARE v_payload text;
DECLARE v_now bigint;
BEGIN
  v_user=NULLIF(pg_catalog.current_setting('domi.r31_subject',true),'');
  v_jti=NULLIF(pg_catalog.current_setting('domi.r31_jti',true),'');
  v_issued=NULLIF(pg_catalog.current_setting('domi.r31_issued',true),'');
  v_nonce=NULLIF(pg_catalog.current_setting('domi.r31_nonce',true),'');
  v_mac=NULLIF(pg_catalog.current_setting('domi.r31_mac',true),'');
  IF v_user IS NULL OR v_user !~ '^[A-Za-z0-9_-]{1,128}$'
     OR v_jti IS NULL OR v_jti !~ '^[A-Za-z0-9_-]{1,128}$'
     OR v_issued IS NULL OR v_issued !~ '^[0-9]{10}$'
     OR v_nonce IS NULL OR v_nonce !~ '^[0-9a-f]{32}$'
     OR v_mac IS NULL OR v_mac !~ '^[0-9a-f]{64}$'
  THEN RETURN NULL; END IF;
  v_now=pg_catalog.floor(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp()))::bigint;
  IF v_issued::bigint < v_now-30 OR v_issued::bigint > v_now+5
  THEN RETURN NULL; END IF;
  SELECT k.secret_key INTO v_key FROM domi_r31.context_secrets k
  WHERE k.key_name='active';
  IF v_key IS NULL OR pg_catalog.length(v_key)<32 THEN RETURN NULL; END IF;
  v_payload='r33|'||v_user||'|'||v_jti||'|'||v_issued||'|'||v_nonce||
    '|'||pg_catalog.pg_backend_pid()::text||'|'||pg_catalog.txid_current()::text;
  v_expected=pg_catalog.encode(
    public.hmac(pg_catalog.convert_to(v_payload,'UTF8'),v_key,'sha256'),'hex');
  IF v_mac<>v_expected THEN RETURN NULL; END IF;
  RETURN (
    SELECT s.user_id FROM public.auth_sessions s
    JOIN public.users u ON u.id=s.user_id
    WHERE s.user_id=v_user AND s.token_jti=v_jti
      AND s.revoked_at IS NULL AND u.is_active=1
      AND s.expires_at::timestamptz > pg_catalog.clock_timestamp()
    LIMIT 1
  );
END;
$body$;
ALTER FUNCTION domi_r31.subject_id() OWNER TO domi_r31_auth_owner;
REVOKE ALL ON FUNCTION domi_r31.subject_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_r31.subject_id() TO domi_app_runtime;

-- Column allowlists: no generic UPDATE may change privacy, ownership, status,
-- consent, inference or provenance. Direct DELETE is never granted.
REVOKE ALL ON public.memory_items FROM domi_app_runtime;
GRANT SELECT ON public.memory_items TO domi_app_runtime;
GRANT INSERT(id,person_id,household_id,organization_id,memory_type,content,
 importance,consent_scope,visibility_scope,created_by_user_id,created_at,updated_at)
 ON public.memory_items TO domi_app_runtime;
GRANT UPDATE(content,updated_at) ON public.memory_items TO domi_app_runtime;

-- Restrictive policies AND the R31 permissive policies. Consent must contain
-- only self visibility and no third-party share permission.
CREATE POLICY domi_r33_private_consent_select ON public.memory_items
 AS RESTRICTIVE FOR SELECT TO domi_app_runtime USING (
   consent_scope::jsonb - 'shareable_with_doctor' = '{"visible_to":["self"]}'::jsonb
   AND COALESCE((consent_scope::jsonb ->> 'shareable_with_doctor')::boolean,false)=false
 );
CREATE POLICY domi_r33_private_consent_insert ON public.memory_items
 AS RESTRICTIVE FOR INSERT TO domi_app_runtime WITH CHECK (
   consent_scope::jsonb - 'shareable_with_doctor' = '{"visible_to":["self"]}'::jsonb
   AND COALESCE((consent_scope::jsonb ->> 'shareable_with_doctor')::boolean,false)=false
 );
CREATE POLICY domi_r33_private_consent_update ON public.memory_items
 AS RESTRICTIVE FOR UPDATE TO domi_app_runtime
 USING (
   consent_scope::jsonb - 'shareable_with_doctor' = '{"visible_to":["self"]}'::jsonb
   AND COALESCE((consent_scope::jsonb ->> 'shareable_with_doctor')::boolean,false)=false
 ) WITH CHECK (
   consent_scope::jsonb - 'shareable_with_doctor' = '{"visible_to":["self"]}'::jsonb
   AND COALESCE((consent_scope::jsonb ->> 'shareable_with_doctor')::boolean,false)=false
 );
