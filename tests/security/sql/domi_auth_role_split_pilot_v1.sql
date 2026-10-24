-- R23 disposable CI fixture only. Never apply to Neon main.
-- Auth credential lookup is read-only; session issuance uses a separate role.
CREATE ROLE domi_auth_session_issuer NOLOGIN NOSUPERUSER NOBYPASSRLS
  NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
GRANT USAGE ON SCHEMA domi_auth TO domi_auth_session_issuer;

REVOKE EXECUTE ON FUNCTION domi_auth.issue_session(text,text,text,integer)
  FROM domi_auth_lookup;
REVOKE EXECUTE ON FUNCTION domi_auth.record_login_attempt(text,boolean)
  FROM domi_auth_lookup;
REVOKE EXECUTE ON FUNCTION domi_auth.clear_failed_logins(text)
  FROM domi_auth_lookup;
REVOKE EXECUTE ON FUNCTION domi_auth.consume_recovery_code(text,text)
  FROM domi_auth_lookup;
REVOKE EXECUTE ON FUNCTION domi_auth.rotate_mfa_secret(text,text,text)
  FROM domi_auth_lookup;

GRANT EXECUTE ON FUNCTION domi_auth.issue_session(text,text,text,integer)
  TO domi_auth_session_issuer;
GRANT EXECUTE ON FUNCTION domi_auth.record_login_attempt(text,boolean)
  TO domi_auth_session_issuer;
GRANT EXECUTE ON FUNCTION domi_auth.clear_failed_logins(text)
  TO domi_auth_session_issuer;
GRANT EXECUTE ON FUNCTION domi_auth.consume_recovery_code(text,text)
  TO domi_auth_session_issuer;
GRANT EXECUTE ON FUNCTION domi_auth.rotate_mfa_secret(text,text,text)
  TO domi_auth_session_issuer;
