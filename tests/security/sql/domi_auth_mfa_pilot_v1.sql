-- R16: disposable test-only privilege boundary for MFA and login throttling.
-- Never run this fixture on Neon or production. Real schema migration will
-- need to preserve legacy INTEGER/TEXT column encodings.
CREATE TABLE domi_pilot.user_mfa (
  user_id text PRIMARY KEY REFERENCES domi_pilot.users(id),
  totp_secret text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE domi_pilot.user_mfa_recovery_codes (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES domi_pilot.users(id),
  code_hash text NOT NULL,
  used_at timestamptz
);
CREATE TABLE domi_pilot.auth_login_attempts (
  id text PRIMARY KEY,
  email text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL
);
INSERT INTO domi_pilot.user_mfa VALUES
  ('u-a','SYNTHETIC_ENCRYPTED_MFA_PLACEHOLDER',true),
  ('u-b','SYNTHETIC_DISABLED_MFA_PLACEHOLDER',false);
-- Digest is SHA-256 of synthetic recovery code "abc", never a real code.
INSERT INTO domi_pilot.user_mfa_recovery_codes
VALUES ('rec-a','u-a','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',NULL);
ALTER TABLE domi_pilot.user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.user_mfa FORCE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.user_mfa_recovery_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE domi_pilot.auth_login_attempts FORCE ROW LEVEL SECURITY;

CREATE POLICY auth_mfa_select ON domi_pilot.user_mfa
FOR SELECT TO domi_pilot_auth_owner USING (current_user='domi_pilot_auth_owner');
CREATE POLICY auth_recovery_select ON domi_pilot.user_mfa_recovery_codes
FOR SELECT TO domi_pilot_auth_owner USING (current_user='domi_pilot_auth_owner');
CREATE POLICY auth_recovery_update ON domi_pilot.user_mfa_recovery_codes
FOR UPDATE TO domi_pilot_auth_owner
USING (current_user='domi_pilot_auth_owner')
WITH CHECK (current_user='domi_pilot_auth_owner');
CREATE POLICY auth_attempt_select ON domi_pilot.auth_login_attempts
FOR SELECT TO domi_pilot_auth_owner USING (current_user='domi_pilot_auth_owner');
CREATE POLICY auth_attempt_insert ON domi_pilot.auth_login_attempts
FOR INSERT TO domi_pilot_auth_owner WITH CHECK (current_user='domi_pilot_auth_owner');
CREATE POLICY auth_attempt_delete ON domi_pilot.auth_login_attempts
FOR DELETE TO domi_pilot_auth_owner USING (current_user='domi_pilot_auth_owner');

GRANT SELECT(user_id,totp_secret,is_enabled) ON domi_pilot.user_mfa TO domi_pilot_auth_owner;
GRANT SELECT(id,user_id,code_hash,used_at),UPDATE(used_at)
  ON domi_pilot.user_mfa_recovery_codes TO domi_pilot_auth_owner;
GRANT SELECT(email,success,created_at),INSERT(id,email,success,created_at),DELETE
  ON domi_pilot.auth_login_attempts TO domi_pilot_auth_owner;

CREATE FUNCTION domi_auth.lookup_mfa_state(p_user_id text)
RETURNS TABLE(totp_secret text,is_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT m.totp_secret,m.is_enabled
  FROM domi_pilot.user_mfa m JOIN domi_pilot.users u ON u.id=m.user_id
  WHERE m.user_id=p_user_id AND u.is_active;
$$;
CREATE FUNCTION domi_auth.consume_recovery_code(p_user_id text,p_hash text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE found_id text;
BEGIN
  UPDATE domi_pilot.user_mfa_recovery_codes AS r
  SET used_at=pg_catalog.clock_timestamp()
  WHERE r.id = (
    SELECT r2.id FROM domi_pilot.user_mfa_recovery_codes AS r2
    WHERE r2.user_id=p_user_id AND r2.code_hash=p_hash AND r2.used_at IS NULL
    ORDER BY r2.id LIMIT 1 FOR UPDATE SKIP LOCKED
  ) AND r.used_at IS NULL
  RETURNING r.id INTO found_id;
  RETURN found_id IS NOT NULL;
END;
$$;
CREATE FUNCTION domi_auth.recent_failed_logins(p_email text,p_since timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
 SELECT COUNT(*)::integer FROM domi_pilot.auth_login_attempts a
 WHERE a.email=pg_catalog.lower(pg_catalog.btrim(p_email))
 AND NOT a.success AND a.created_at>=p_since;
$$;
CREATE FUNCTION domi_auth.record_login_attempt(p_email text,p_success boolean)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
 INSERT INTO domi_pilot.auth_login_attempts(id,email,success,created_at)
 VALUES(pg_catalog.gen_random_uuid()::text,
        pg_catalog.lower(pg_catalog.btrim(p_email)),p_success,pg_catalog.clock_timestamp());
$$;
CREATE FUNCTION domi_auth.clear_failed_logins(p_email text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
 DELETE FROM domi_pilot.auth_login_attempts a
 WHERE a.email=pg_catalog.lower(pg_catalog.btrim(p_email)) AND NOT a.success;
$$;

ALTER FUNCTION domi_auth.lookup_mfa_state(text) OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_auth.consume_recovery_code(text,text) OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_auth.recent_failed_logins(text,timestamptz) OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_auth.record_login_attempt(text,boolean) OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_auth.clear_failed_logins(text) OWNER TO domi_pilot_auth_owner;
REVOKE ALL ON FUNCTION domi_auth.lookup_mfa_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_auth.consume_recovery_code(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_auth.recent_failed_logins(text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_auth.record_login_attempt(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_auth.clear_failed_logins(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_auth.lookup_mfa_state(text) TO domi_auth_lookup;
GRANT EXECUTE ON FUNCTION domi_auth.consume_recovery_code(text,text) TO domi_auth_lookup;
GRANT EXECUTE ON FUNCTION domi_auth.recent_failed_logins(text,timestamptz) TO domi_auth_lookup;
GRANT EXECUTE ON FUNCTION domi_auth.record_login_attempt(text,boolean) TO domi_auth_lookup;
GRANT EXECUTE ON FUNCTION domi_auth.clear_failed_logins(text) TO domi_auth_lookup;
