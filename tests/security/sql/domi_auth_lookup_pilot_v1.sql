-- R15 / CI only. Separate, non-inheriting login identity for authentication
-- bootstrap. The household runtime role must NOT gain this capability.
-- Applied to the disposable PostgreSQL pilot, NEVER directly to Neon.
CREATE ROLE domi_auth_lookup NOLOGIN NOSUPERUSER NOBYPASSRLS
    NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;

-- The synthetic users fixture intentionally matches the real Neon email key.
ALTER TABLE domi_pilot.users ADD COLUMN email text;
UPDATE domi_pilot.users SET email = CASE id
  WHEN 'u-a' THEN 'a@example.invalid'
  WHEN 'u-b' THEN 'b@example.invalid'
  ELSE 'disabled@example.invalid'
END;
ALTER TABLE domi_pilot.users ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX domi_pilot_users_email_key ON domi_pilot.users(email);

-- Only the definer can SELECT hashes; no table grants to either API login.
GRANT SELECT (email,password_hash) ON domi_pilot.users TO domi_pilot_auth_owner;
GRANT USAGE ON SCHEMA domi_auth TO domi_auth_lookup;

CREATE FUNCTION domi_auth.lookup_password_credential(p_email text)
RETURNS TABLE (user_id text, password_digest text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT u.id, u.password_hash
  FROM domi_pilot.users AS u
  WHERE u.is_active = TRUE
    AND u.email = pg_catalog.lower(pg_catalog.btrim(p_email))
  LIMIT 1;
$$;
ALTER FUNCTION domi_auth.lookup_password_credential(text)
    OWNER TO domi_pilot_auth_owner;
REVOKE ALL ON FUNCTION domi_auth.lookup_password_credential(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION domi_auth.lookup_password_credential(text)
    TO domi_auth_lookup;

-- No blanket table privileges, no RLS bypass, no password or session issuance
-- functions yet. The server MUST check bcrypt and later MFA, and use separately
-- scoped audited functions to create sessions and record login attempts.
