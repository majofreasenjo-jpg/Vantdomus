-- R27: synthetic dual-role, one-use, short-lived session authorization.
-- Disposable GitHub CI database only: NEVER execute in real Neon or production.
-- Only the lookup SQL identity can prepare a proof; only the issuer can consume.
-- A proof binds user, signed JWT JTI and distinct session ID. Possessing only
-- the issuer login cannot mint a proof, and possessing only lookup cannot issue.
CREATE TABLE domi_pilot.auth_session_proofs (
  proof_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id text NOT NULL REFERENCES domi_pilot.users(id),
  session_id text NOT NULL,
  token_jti text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
ALTER TABLE domi_pilot.auth_session_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.auth_session_proofs FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_proof_owner
ON domi_pilot.auth_session_proofs FOR ALL TO domi_pilot_auth_owner
USING (current_user='domi_pilot_auth_owner')
WITH CHECK (current_user='domi_pilot_auth_owner');
GRANT SELECT,INSERT,UPDATE ON domi_pilot.auth_session_proofs TO domi_pilot_auth_owner;

CREATE FUNCTION domi_auth.prepare_session_proof(
 p_user_id text,p_session_id text,p_token_jti text
) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
DECLARE v_proof uuid;
BEGIN
 IF p_user_id IS NULL OR p_session_id IS NULL OR p_token_jti IS NULL
    OR length(p_session_id)!=36 OR length(p_token_jti)!=36
    OR NOT EXISTS (SELECT 1 FROM domi_pilot.users u
                   WHERE u.id=p_user_id AND u.is_active)
 THEN RETURN NULL; END IF;
 INSERT INTO domi_pilot.auth_session_proofs
   (user_id,session_id,token_jti,expires_at)
 VALUES (p_user_id,p_session_id,p_token_jti,
         pg_catalog.clock_timestamp()+interval '45 seconds')
 RETURNING proof_id INTO v_proof;
 RETURN v_proof::text;
END;
$$;

CREATE FUNCTION domi_auth.issue_session_bound(
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
   AND proof.token_jti=p_token_jti
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

ALTER FUNCTION domi_auth.prepare_session_proof(text,text,text)
  OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_auth.issue_session_bound(text,text,text,integer,text)
  OWNER TO domi_pilot_auth_owner;
REVOKE ALL ON FUNCTION domi_auth.prepare_session_proof(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_auth.issue_session_bound(text,text,text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_auth.issue_session(text,text,text,integer)
  FROM domi_auth_session_issuer;
GRANT EXECUTE ON FUNCTION domi_auth.prepare_session_proof(text,text,text)
  TO domi_auth_lookup;
GRANT EXECUTE ON FUNCTION domi_auth.issue_session_bound(text,text,text,integer,text)
  TO domi_auth_session_issuer;
