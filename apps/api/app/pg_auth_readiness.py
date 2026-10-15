"""R47 fail-closed readiness gate for the *real* PostgreSQL auth login.

R31/R33 protect memory but do NOT provision a working authentication service.
A green 57-table RLS test must never be misinterpreted as proof that
password/MFA/session issuance is ready. The checks here are metadata-only:
no secrets, credentials, user rows or DDL are read or changed.

This gate supplements (never replaces) end-to-end auth and RLS tests.
"""
from __future__ import annotations


_REQUIRED_AUTH_FUNCTIONS = (
    ("lookup_password_credential", 1, "domi_auth_lookup"),
    ("lookup_mfa_state", 1, "domi_auth_lookup"),
    ("recent_failed_logins", 2, "domi_auth_lookup"),
    ("prepare_session_proof", 7, "domi_auth_lookup"),
    ("record_login_attempt", 2, "domi_auth_session_issuer"),
    ("clear_failed_logins", 1, "domi_auth_session_issuer"),
    ("consume_recovery_code", 2, "domi_auth_session_issuer"),
    ("rotate_mfa_secret", 3, "domi_auth_session_issuer"),
    ("issue_session_bound", 5, "domi_auth_session_issuer"),
)


def check_signed_auth_login_readiness(db) -> None:
    """Refuse signed-runtime startup when restricted real login is missing.

    The application login querying pg_catalog requires no USAGE on domi_auth;
    each authentication login, however, must be able to execute exactly the
    allowlisted SECURITY DEFINER entrypoints from its own independent DSN.
    """
    roles = db.execute(
        "SELECT COUNT(*) AS safe_logins FROM pg_catalog.pg_roles r "
        "WHERE r.rolname IN ('domi_auth_lookup','domi_auth_session_issuer') "
        "AND r.rolcanlogin AND NOT r.rolinherit AND NOT r.rolsuper "
        "AND NOT r.rolbypassrls AND NOT r.rolcreaterole "
        "AND NOT r.rolcreatedb AND NOT r.rolreplication"
    ).fetchone()
    if not roles or int(roles["safe_logins"]) != 2:
        raise RuntimeError(
            "POSTGRES_AUTH_LOGIN_ROLES_GATE: independent restricted login roles missing"
        )

    # A login must NEVER read raw password/MFA/session tables, even if it can
    # call carefully scoped definer functions. A PUBLIC grant also fails this
    # check through the effective has_table_privilege predicate.
    direct = db.execute(
        "SELECT EXISTS ("
        " SELECT 1 FROM (VALUES "
        " ('public.users'),('public.auth_sessions'),('public.user_mfa'),"
        " ('public.user_mfa_recovery_codes')"
        " ) AS sensitive(tab) "
        " WHERE has_table_privilege('domi_auth_lookup',sensitive.tab,"
        " 'SELECT,INSERT,UPDATE,DELETE') "
        " OR has_table_privilege('domi_auth_session_issuer',sensitive.tab,"
        " 'SELECT,INSERT,UPDATE,DELETE')"
        ") AS raw_auth_table_access"
    ).fetchone()
    if not direct or direct["raw_auth_table_access"] is not False:
        raise RuntimeError(
            "POSTGRES_AUTH_LOGIN_GRANTS_GATE: direct sensitive-table access"
        )

    # Build a *fixed* VALUES list from the in-code allowlist. All values are
    # developer-defined constants; there is no user input or dynamic SQL name.
    values = ",".join(
        "('" + name + "'," + str(arity) + ",'" + role + "')"
        for name, arity, role in _REQUIRED_AUTH_FUNCTIONS
    )
    funcs = db.execute(
        "WITH required(proname,pronargs,principal) AS (VALUES " + values + ") "
        "SELECT COUNT(*) AS verified_functions FROM required req "
        "JOIN pg_catalog.pg_namespace n ON n.nspname='domi_auth' "
        "JOIN pg_catalog.pg_proc p ON p.pronamespace=n.oid "
        " AND p.proname=req.proname AND p.pronargs=req.pronargs "
        " AND p.prokind='f' AND p.prosecdef "
        "JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=p.proowner "
        "WHERE NOT owner_role.rolcanlogin AND NOT owner_role.rolinherit "
        " AND NOT owner_role.rolsuper AND NOT owner_role.rolbypassrls "
        " AND NOT owner_role.rolcreaterole AND NOT owner_role.rolcreatedb "
        " AND has_schema_privilege(req.principal,n.oid,'USAGE') "
        " AND has_function_privilege(req.principal,p.oid,'EXECUTE') "
        " AND NOT has_function_privilege('domi_app_runtime',p.oid,'EXECUTE')"
    ).fetchone()
    if not funcs or int(funcs["verified_functions"]) != len(_REQUIRED_AUTH_FUNCTIONS):
        raise RuntimeError(
            "POSTGRES_AUTH_LOGIN_FUNCTION_GATE: restricted auth API not fully provisioned"
        )

    # This does NOT certify procedure bodies, credential rotation, MFA,
    # rollback, session replay protection, or production readiness.
