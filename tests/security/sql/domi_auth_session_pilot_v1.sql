-- DOMI R22, disposable PostgreSQL CI only.
-- Real Neon uses TEXT date columns and requires separate reviewed migration.
-- Auth-only login may issue sessions through a narrow SECURITY DEFINER,
-- but cannot INSERT or SELECT the private session table directly.

CREATE POLICY auth_session_insert
ON domi_pilot.auth_sessions FOR INSERT TO domi_pilot_auth_owner
WITH CHECK (current_user='domi_pilot_auth_owner');
GRANT INSERT(id,user_id,token_jti,expires_at,revoked_at)
ON domi_pilot.auth_sessions TO domi_pilot_auth_owner;

CREATE FUNCTION domi_auth.issue_session(
  p_user_id text,p_session_id text,p_token_jti text,p_ttl_seconds integer
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
BEGIN
 IF p_user_id IS NULL OR p_session_id IS NULL OR p_token_jti IS NULL
    OR p_ttl_seconds IS NULL OR p_ttl_seconds < 60 OR p_ttl_seconds > 86400
    OR length(p_session_id) != 36 OR length(p_token_jti) != 36
 THEN RETURN FALSE; END IF;
 IF NOT EXISTS(SELECT 1 FROM domi_pilot.users u WHERE u.id=p_user_id AND u.is_active)
 THEN RETURN FALSE; END IF;
 INSERT INTO domi_pilot.auth_sessions(id,user_id,token_jti,expires_at,revoked_at)
 VALUES(p_session_id,p_user_id,p_token_jti,
        pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>p_ttl_seconds),NULL);
 RETURN TRUE;
EXCEPTION WHEN unique_violation THEN RETURN FALSE;
END;
$$;

CREATE POLICY auth_mfa_rotate
ON domi_pilot.user_mfa FOR UPDATE TO domi_pilot_auth_owner
USING (current_user='domi_pilot_auth_owner')
WITH CHECK (current_user='domi_pilot_auth_owner');
GRANT UPDATE(totp_secret) ON domi_pilot.user_mfa TO domi_pilot_auth_owner;

CREATE FUNCTION domi_auth.rotate_mfa_secret(
  p_user_id text,p_old text,p_replacement text
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
DECLARE changed text;
BEGIN
 IF p_replacement IS NULL OR left(p_replacement,10) != 'fernet:v1:'
 THEN RETURN FALSE; END IF;
 UPDATE domi_pilot.user_mfa m SET totp_secret=p_replacement
 WHERE m.user_id=p_user_id AND m.totp_secret=p_old AND m.is_enabled
 RETURNING m.user_id INTO changed;
 RETURN changed IS NOT NULL;
END;
$$;

ALTER FUNCTION domi_auth.issue_session(text,text,text,integer)
OWNER TO domi_pilot_auth_owner;
ALTER FUNCTION domi_auth.rotate_mfa_secret(text,text,text)
OWNER TO domi_pilot_auth_owner;
REVOKE ALL ON FUNCTION domi_auth.issue_session(text,text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION domi_auth.rotate_mfa_secret(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_auth.issue_session(text,text,text,integer) TO domi_auth_lookup;
GRANT EXECUTE ON FUNCTION domi_auth.rotate_mfa_secret(text,text,text) TO domi_auth_lookup;
