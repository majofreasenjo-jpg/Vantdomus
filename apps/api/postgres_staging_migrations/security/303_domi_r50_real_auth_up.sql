-- DOMI R50 / 2026-10-15: REAL 57-table AUTH candidate, OFFLINE ONLY.
-- DO NOT RUN ON NEON OR PRODUCTION WITHOUT SEPARATE MIGRATION AUTHORIZATION.
-- Apply on fresh disposable PostgreSQL AFTER R31 + R33, in one transaction.
-- This provides the SQL layer required by the existing trusted-server login.
-- RLS, the HMAC/JWT keys and authentication LOGIN passwords remain separate.
-- Roles are created NOLOGIN: deployment cannot become operational by accident.
--
-- Exact actual database shape: dates TEXT; users.is_active, MFA, login success INTEGER.
-- No operational secrets, real users, live tokens or passwords are in source.

DO $preflight$
DECLARE n integer; secured integer; crypto integer;
BEGIN
 SELECT COUNT(*)::integer,
        COUNT(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity)::integer
 INTO n,secured
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r';
 SELECT COUNT(*)::integer INTO crypto FROM pg_catalog.pg_extension WHERE extname='pgcrypto';
 IF n<>57 OR secured<>57 OR crypto<>1 THEN
   RAISE EXCEPTION 'DOMI_R50_PREFLIGHT: 57-table FORCE RLS and pgcrypto required';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='domi_auth')
 OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN
     ('domi_auth_owner','domi_auth_lookup','domi_auth_session_issuer')) THEN
   RAISE EXCEPTION 'DOMI_R50_PREFLIGHT: auth namespace or roles preexist; manual review';
 END IF;
 IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public'
     AND table_name='users' AND column_name='is_active') <> 'integer'
 OR (SELECT data_type FROM information_schema.columns WHERE table_schema='public'
     AND table_name='auth_sessions' AND column_name='expires_at') <> 'text'
 OR (SELECT data_type FROM information_schema.columns WHERE table_schema='public'
     AND table_name='user_mfa' AND column_name='is_enabled') <> 'integer'
 OR (SELECT data_type FROM information_schema.columns WHERE table_schema='public'
     AND table_name='auth_login_attempts' AND column_name='success') <> 'integer'
 THEN
   RAISE EXCEPTION 'DOMI_R50_PREFLIGHT: actual real-schema auth column types drifted';
 END IF;
END $preflight$;

CREATE ROLE domi_auth_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
 NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE domi_auth_lookup NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
 NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE domi_auth_session_issuer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
 NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE SCHEMA domi_auth;
ALTER SCHEMA domi_auth OWNER TO domi_auth_owner;
REVOKE ALL ON SCHEMA domi_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA domi_auth TO domi_auth_lookup,domi_auth_session_issuer;
GRANT USAGE ON SCHEMA public TO domi_auth_owner;

-- Owner of SECURITY DEFINER routines has *only* the minimum credential,
-- MFA, login-attempt and session table grants; neither SQL LOGIN has any.
GRANT SELECT(id,email,password_hash,is_active) ON public.users TO domi_auth_owner;
GRANT SELECT(id,user_id,token_jti,expires_at,revoked_at) ON public.auth_sessions
 TO domi_auth_owner;
GRANT INSERT(id,user_id,token_jti,created_at,expires_at,revoked_at)
 ON public.auth_sessions TO domi_auth_owner;
GRANT SELECT(user_id,totp_secret,is_enabled) ON public.user_mfa TO domi_auth_owner;
GRANT UPDATE(totp_secret) ON public.user_mfa TO domi_auth_owner;
GRANT SELECT(id,user_id,code_hash,used_at) ON public.user_mfa_recovery_codes
 TO domi_auth_owner;
GRANT UPDATE(used_at) ON public.user_mfa_recovery_codes TO domi_auth_owner;
GRANT SELECT(id,email,success,created_at) ON public.auth_login_attempts
 TO domi_auth_owner;
GRANT INSERT(id,email,success,created_at),DELETE ON public.auth_login_attempts
 TO domi_auth_owner;

-- 53 R31 closed policies remain closed to app runtime; auth owner gets its
-- own restricted role-specific policies, not a global exemption or BYPASSRLS.
CREATE POLICY domi_r50_auth_owner_select ON public.users FOR SELECT
 TO domi_auth_owner USING (true);
CREATE POLICY domi_r50_auth_owner_rw ON public.auth_sessions FOR ALL
 TO domi_auth_owner USING (true) WITH CHECK (true);
CREATE POLICY domi_r50_auth_owner_rw ON public.user_mfa FOR ALL
 TO domi_auth_owner USING (true) WITH CHECK (true);
CREATE POLICY domi_r50_auth_owner_rw ON public.user_mfa_recovery_codes FOR ALL
 TO domi_auth_owner USING (true) WITH CHECK (true);
CREATE POLICY domi_r50_auth_owner_rw ON public.auth_login_attempts FOR ALL
 TO domi_auth_owner USING (true) WITH CHECK (true);

CREATE TABLE domi_auth.attestation_secrets (
 key_name text PRIMARY KEY,
 secret_key bytea NOT NULL
);
ALTER TABLE domi_auth.attestation_secrets OWNER TO domi_auth_owner;
ALTER TABLE domi_auth.attestation_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_auth.attestation_secrets FORCE ROW LEVEL SECURITY;
CREATE POLICY domi_r50_auth_owner_key ON domi_auth.attestation_secrets
 FOR SELECT TO domi_auth_owner USING (true);
REVOKE ALL ON domi_auth.attestation_secrets FROM PUBLIC,domi_auth_lookup,
 domi_auth_session_issuer,domi_app_runtime;

CREATE TABLE domi_auth.session_proofs (
 proof_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 user_id text NOT NULL,
 session_id text NOT NULL,
 token_jti text NOT NULL,
 ttl_seconds integer NOT NULL,
 issued_epoch bigint NOT NULL,
 attestation_nonce text NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 UNIQUE(user_id,attestation_nonce)
);
ALTER TABLE domi_auth.session_proofs OWNER TO domi_auth_owner;
ALTER TABLE domi_auth.session_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_auth.session_proofs FORCE ROW LEVEL SECURITY;
CREATE POLICY domi_r50_auth_owner_proof ON domi_auth.session_proofs FOR ALL
 TO domi_auth_owner USING (true) WITH CHECK (true);
REVOKE ALL ON domi_auth.session_proofs FROM PUBLIC,domi_auth_lookup,
 domi_auth_session_issuer,domi_app_runtime;

CREATE FUNCTION domi_auth.lookup_password_credential(p_email text)
RETURNS TABLE(user_id text,password_digest text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT u.id,u.password_hash FROM public.users u
 WHERE u.is_active=1
 AND u.email=pg_catalog.lower(pg_catalog.btrim(p_email))
 LIMIT 1;
$fn$;

CREATE FUNCTION domi_auth.lookup_mfa_state(p_user_id text)
RETURNS TABLE(totp_secret text,is_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT m.totp_secret, m.is_enabled=1
 FROM public.user_mfa m
 JOIN public.users u ON u.id=m.user_id
 WHERE m.user_id=p_user_id AND u.is_active=1;
$fn$;

CREATE FUNCTION domi_auth.recent_failed_logins(p_email text,p_since timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT COUNT(*)::integer FROM public.auth_login_attempts a
 WHERE a.email=pg_catalog.lower(pg_catalog.btrim(p_email))
 AND a.success=0
 AND a.created_at::timestamptz>=p_since;
$fn$;

CREATE FUNCTION domi_auth.record_login_attempt(p_email text,p_success boolean)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
 INSERT INTO public.auth_login_attempts(id,email,success,created_at)
 VALUES (pg_catalog.gen_random_uuid()::text,
         pg_catalog.lower(pg_catalog.btrim(p_email)),
         CASE WHEN p_success THEN 1 ELSE 0 END,
         pg_catalog.clock_timestamp()::text);
$fn$;

CREATE FUNCTION domi_auth.clear_failed_logins(p_email text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
 DELETE FROM public.auth_login_attempts a
 WHERE a.email=pg_catalog.lower(pg_catalog.btrim(p_email)) AND a.success=0;
$fn$;

CREATE FUNCTION domi_auth.consume_recovery_code(p_user_id text,p_hash text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v_id text;
BEGIN
 IF p_user_id IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
 THEN RETURN false; END IF;
 UPDATE public.user_mfa_recovery_codes r
 SET used_at=pg_catalog.clock_timestamp()::text
 WHERE r.id=(
   SELECT rc.id FROM public.user_mfa_recovery_codes rc
   JOIN public.user_mfa m ON m.user_id=rc.user_id
   JOIN public.users u ON u.id=rc.user_id
   WHERE rc.user_id=p_user_id AND rc.code_hash=p_hash
     AND rc.used_at IS NULL AND m.is_enabled=1 AND u.is_active=1
   LIMIT 1 FOR UPDATE OF rc
 )
 RETURNING r.id INTO v_id;
 RETURN v_id IS NOT NULL;
END;
$fn$;

CREATE FUNCTION domi_auth.rotate_mfa_secret(p_user_id text,p_old text,p_new text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v_id text;
BEGIN
 IF p_user_id IS NULL OR p_new IS NULL
 OR pg_catalog.left(p_new,10)<>'fernet:v1:'
 THEN RETURN false; END IF;
 UPDATE public.user_mfa m SET totp_secret=p_new
 WHERE m.user_id=p_user_id AND m.totp_secret=p_old
 AND m.is_enabled=1 AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id=m.user_id AND u.is_active=1
 )
 RETURNING m.user_id INTO v_id;
 RETURN v_id IS NOT NULL;
END;
$fn$;

-- The server signs: user|session|JTI|TTL|epoch|nonce with a separately
-- provisioned 32+ byte HMAC key. No database login can mint arbitrary proofs.
CREATE FUNCTION domi_auth.prepare_session_proof(
 p_user_id text,p_session_id text,p_token_jti text,
 p_ttl_seconds integer,p_issued_epoch bigint,p_nonce text,p_signature text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v_key bytea; v_expected text; v_message text;
DECLARE v_proof uuid; v_now bigint;
BEGIN
 IF p_user_id IS NULL OR p_user_id !~ '^[A-Za-z0-9_-]{1,128}$'
 OR p_session_id IS NULL OR p_session_id !~ '^[0-9a-f-]{36}$'
 OR p_token_jti IS NULL OR p_token_jti !~ '^[0-9a-f-]{36}$'
 OR p_ttl_seconds IS NULL OR p_ttl_seconds<60 OR p_ttl_seconds>86400
 OR p_issued_epoch IS NULL OR p_nonce IS NULL OR p_nonce !~ '^[0-9a-f]{32}$'
 OR p_signature IS NULL OR p_signature !~ '^[0-9a-f]{64}$'
 THEN RETURN NULL; END IF;
 v_now=pg_catalog.floor(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp()))::bigint;
 IF p_issued_epoch<v_now-30 OR p_issued_epoch>v_now+5
 THEN RETURN NULL; END IF;
 SELECT secret_key INTO v_key FROM domi_auth.attestation_secrets
 WHERE key_name='active';
 IF v_key IS NULL OR pg_catalog.length(v_key)<32 THEN RETURN NULL; END IF;
 v_message=p_user_id||'|'||p_session_id||'|'||p_token_jti||'|'||
 p_ttl_seconds::text||'|'||p_issued_epoch::text||'|'||p_nonce;
 v_expected=pg_catalog.encode(public.hmac(
   pg_catalog.convert_to(v_message,'UTF8'),v_key,'sha256'),'hex');
 IF v_expected<>p_signature OR NOT EXISTS (
   SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.is_active=1
 ) THEN RETURN NULL; END IF;
 INSERT INTO domi_auth.session_proofs(
   user_id,session_id,token_jti,ttl_seconds,issued_epoch,
   attestation_nonce,expires_at)
 VALUES(p_user_id,p_session_id,p_token_jti,p_ttl_seconds,p_issued_epoch,
        p_nonce,pg_catalog.clock_timestamp()+interval '45 seconds')
 RETURNING proof_id INTO v_proof;
 RETURN v_proof::text;
EXCEPTION WHEN unique_violation THEN RETURN NULL;
END;
$fn$;

-- A distinct issuer login can ONLY consume a committed one-use signed proof.
-- Session insertion and proof consumption occur in one SQL transaction.
CREATE FUNCTION domi_auth.issue_session_bound(
 p_user_id text,p_session_id text,p_token_jti text,
 p_ttl_seconds integer,p_proof_id text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v_proof uuid;
BEGIN
 IF p_user_id IS NULL OR p_session_id IS NULL OR p_token_jti IS NULL
 OR p_ttl_seconds IS NULL OR p_ttl_seconds<60 OR p_ttl_seconds>86400
 OR p_proof_id IS NULL OR p_proof_id !~ '^[0-9a-f-]{36}$'
 THEN RETURN false; END IF;
 UPDATE domi_auth.session_proofs p
 SET consumed_at=pg_catalog.clock_timestamp()
 WHERE p.proof_id=p_proof_id::uuid
 AND p.user_id=p_user_id AND p.session_id=p_session_id
 AND p.token_jti=p_token_jti AND p.ttl_seconds=p_ttl_seconds
 AND p.expires_at>pg_catalog.clock_timestamp() AND p.consumed_at IS NULL
 RETURNING p.proof_id INTO v_proof;
 IF v_proof IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.is_active=1
 ) THEN RETURN false; END IF;
 INSERT INTO public.auth_sessions(
  id,user_id,token_jti,created_at,expires_at,revoked_at)
 VALUES(p_session_id,p_user_id,p_token_jti,
   pg_catalog.clock_timestamp()::text,
   (pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>p_ttl_seconds))::text,
   NULL);
 RETURN true;
EXCEPTION WHEN unique_violation OR invalid_text_representation THEN
 RETURN false;
END;
$fn$;

ALTER FUNCTION domi_auth.lookup_password_credential(text) OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.lookup_mfa_state(text) OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.recent_failed_logins(text,timestamptz) OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.record_login_attempt(text,boolean) OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.clear_failed_logins(text) OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.consume_recovery_code(text,text) OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.rotate_mfa_secret(text,text,text) OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.prepare_session_proof(text,text,text,integer,bigint,text,text)
 OWNER TO domi_auth_owner;
ALTER FUNCTION domi_auth.issue_session_bound(text,text,text,integer,text)
 OWNER TO domi_auth_owner;

-- PostgreSQL grants EXECUTE to PUBLIC by default for new functions.
-- Explicitly remove ALL such grants before allowing either auth login.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA domi_auth FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA domi_auth FROM domi_app_runtime,
 domi_auth_lookup,domi_auth_session_issuer;

GRANT EXECUTE ON FUNCTION domi_auth.lookup_password_credential(text),
 domi_auth.lookup_mfa_state(text),
 domi_auth.recent_failed_logins(text,timestamptz),
 domi_auth.prepare_session_proof(text,text,text,integer,bigint,text,text)
 TO domi_auth_lookup;
GRANT EXECUTE ON FUNCTION domi_auth.record_login_attempt(text,boolean),
 domi_auth.clear_failed_logins(text),
 domi_auth.consume_recovery_code(text,text),
 domi_auth.rotate_mfa_secret(text,text,text),
 domi_auth.issue_session_bound(text,text,text,integer,text)
 TO domi_auth_session_issuer;

-- Remains DISABLED: both auth SQL logins are NOLOGIN; HMAC secret row absent.
-- Never authorize a rollout from function metadata alone.
