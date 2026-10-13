-- R28: HMAC-backed proof of trusted app verification (CI-only).
-- NEVER apply to Neon or production. Server key is generated per CI run,
-- injected into this table and server env by disposable test harness.
-- Existing PostgreSQL roles cannot read the key; the SECURITY DEFINER may.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE TABLE domi_pilot.auth_attestation_secrets (
  key_name text PRIMARY KEY,
  secret_key bytea NOT NULL
);
ALTER TABLE domi_pilot.auth_attestation_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.auth_attestation_secrets FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_attestation_owner ON domi_pilot.auth_attestation_secrets
FOR SELECT TO domi_pilot_auth_owner USING (current_user='domi_pilot_auth_owner');
GRANT SELECT(key_name,secret_key) ON domi_pilot.auth_attestation_secrets TO domi_pilot_auth_owner;

ALTER TABLE domi_pilot.auth_session_proofs ADD COLUMN ttl_seconds integer;
ALTER TABLE domi_pilot.auth_session_proofs ADD COLUMN issued_epoch bigint;
ALTER TABLE domi_pilot.auth_session_proofs ADD COLUMN attestation_nonce text;
ALTER TABLE domi_pilot.auth_session_proofs ALTER COLUMN ttl_seconds SET NOT NULL;
ALTER TABLE domi_pilot.auth_session_proofs ALTER COLUMN issued_epoch SET NOT NULL;
ALTER TABLE domi_pilot.auth_session_proofs ALTER COLUMN attestation_nonce SET NOT NULL;
CREATE UNIQUE INDEX auth_session_proofs_unique_session
 ON domi_pilot.auth_session_proofs(session_id,token_jti);

-- Remove the vulnerable R27 lookup-only proof minting entry point.
REVOKE ALL ON FUNCTION domi_auth.prepare_session_proof(text,text,text)
 FROM domi_auth_lookup;
DROP FUNCTION domi_auth.prepare_session_proof(text,text,text);

CREATE FUNCTION domi_auth.prepare_session_proof(
  p_user_id text,p_session_id text,p_token_jti text,
  p_ttl_seconds integer,p_issued_epoch bigint,p_nonce text,p_signature text
) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
DECLARE v_key bytea;
DECLARE v_payload text;
DECLARE v_expected text;
DECLARE v_proof uuid;
DECLARE v_clock bigint;
BEGIN
 IF p_user_id IS NULL OR p_user_id !~ '^[A-Za-z0-9_-]{1,128}$'
    OR p_session_id IS NULL OR p_session_id !~ '^[0-9a-f-]{36}$'
    OR p_token_jti IS NULL OR p_token_jti !~ '^[0-9a-f-]{36}$'
    OR p_ttl_seconds IS NULL OR p_ttl_seconds<60 OR p_ttl_seconds>86400
    OR p_issued_epoch IS NULL
    OR p_nonce IS NULL OR p_nonce !~ '^[0-9a-f]{32}$'
    OR p_signature IS NULL OR p_signature !~ '^[0-9a-f]{64}$'
 THEN RETURN NULL; END IF;
 v_clock=pg_catalog.floor(pg_catalog.extract(epoch FROM pg_catalog.clock_timestamp()))::bigint;
 IF p_issued_epoch < v_clock-45 OR p_issued_epoch>v_clock+5
 THEN RETURN NULL; END IF;
 SELECT k.secret_key INTO v_key FROM domi_pilot.auth_attestation_secrets k
 WHERE k.key_name='active';
 IF v_key IS NULL OR pg_catalog.length(v_key)<32 THEN RETURN NULL; END IF;
 v_payload=p_user_id||'|'||p_session_id||'|'||p_token_jti||'|'||
           p_ttl_seconds::text||'|'||p_issued_epoch::text||'|'||p_nonce;
 v_expected=pg_catalog.encode(public.hmac(pg_catalog.convert_to(v_payload,'UTF8'),v_key,'sha256'),'hex');
 IF v_expected<>p_signature THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM domi_pilot.users u WHERE u.id=p_user_id AND u.is_active)
 THEN RETURN NULL; END IF;
 INSERT INTO domi_pilot.auth_session_proofs
   (user_id,session_id,token_jti,ttl_seconds,issued_epoch,attestation_nonce,expires_at)
 VALUES(p_user_id,p_session_id,p_token_jti,p_ttl_seconds,p_issued_epoch,p_nonce,
        pg_catalog.clock_timestamp()+interval '45 seconds')
 ON CONFLICT (session_id,token_jti) DO NOTHING
 RETURNING proof_id INTO v_proof;
 RETURN v_proof::text;
END;
$$;
ALTER FUNCTION domi_auth.prepare_session_proof(text,text,text,integer,bigint,text,text)
 OWNER TO domi_pilot_auth_owner;
REVOKE ALL ON FUNCTION domi_auth.prepare_session_proof(text,text,text,integer,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_auth.prepare_session_proof(text,text,text,integer,bigint,text,text)
 TO domi_auth_lookup;

-- Same issuer signature as R27, but TTL now has to be identical to the
-- trusted app's signed and immutable attestation, not caller-controlled.
CREATE OR REPLACE FUNCTION domi_auth.issue_session_bound(
 p_user_id text,p_session_id text,p_token_jti text,p_ttl_seconds integer,
 p_proof_id text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
DECLARE v_proof uuid;
BEGIN
 IF p_user_id IS NULL OR p_session_id IS NULL OR p_token_jti IS NULL
    OR p_ttl_seconds IS NULL OR p_ttl_seconds<60 OR p_ttl_seconds>86400
    OR length(p_session_id)!=36 OR length(p_token_jti)!=36
    OR p_proof_id IS NULL OR p_proof_id !~ '^[0-9a-f-]{36}$'
 THEN RETURN FALSE; END IF;
 UPDATE domi_pilot.auth_session_proofs AS proof
 SET consumed_at=pg_catalog.clock_timestamp()
 WHERE proof.proof_id=p_proof_id::uuid
   AND proof.user_id=p_user_id AND proof.session_id=p_session_id
   AND proof.token_jti=p_token_jti AND proof.ttl_seconds=p_ttl_seconds
   AND proof.consumed_at IS NULL
   AND proof.expires_at>pg_catalog.clock_timestamp()
 RETURNING proof.proof_id INTO v_proof;
 IF v_proof IS NULL THEN RETURN FALSE; END IF;
 IF NOT EXISTS(SELECT 1 FROM domi_pilot.users u WHERE u.id=p_user_id AND u.is_active)
 THEN RETURN FALSE; END IF;
 INSERT INTO domi_pilot.auth_sessions(id,user_id,token_jti,expires_at,revoked_at)
 VALUES(p_session_id,p_user_id,p_token_jti,
        pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>p_ttl_seconds),NULL);
 RETURN TRUE;
EXCEPTION WHEN unique_violation OR invalid_text_representation THEN
 RETURN FALSE;
END;
$$;
