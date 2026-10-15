"""R48: fail-closed PostgreSQL authentication admission (metadata only).

Passing synthetic RLS tests is not sufficient for real Owner Beta. This
module checks the *actual* PostgreSQL role/function privilege shape at API
startup; it cannot certify function bodies, live password/MFA flows or safety
of the application server. No user records or secrets are accessed.
"""
from __future__ import annotations

# Expected exact input types are those used by the trusted server APIs.
# oidvectortypes() returns canonical PG names, including
# "timestamp with time zone" for the timestamptz alias.
# name, argument-types, return-type, returns-set, only-allowed-executor
_REQUIRED_AUTH_FUNCTIONS = (
    ("lookup_password_credential", "text", "record", True, "domi_auth_lookup"),
    ("lookup_mfa_state", "text", "record", True, "domi_auth_lookup"),
    ("recent_failed_logins", "text, timestamp with time zone", "integer", False, "domi_auth_lookup"),
    ("prepare_session_proof", "text, text, text, integer, bigint, text, text", "text", False, "domi_auth_lookup"),
    ("record_login_attempt", "text, boolean", "void", False, "domi_auth_session_issuer"),
    ("clear_failed_logins", "text", "void", False, "domi_auth_session_issuer"),
    ("consume_recovery_code", "text, text", "boolean", False, "domi_auth_session_issuer"),
    ("rotate_mfa_secret", "text, text, text", "boolean", False, "domi_auth_session_issuer"),
    ("issue_session_bound", "text, text, text, integer, text", "boolean", False, "domi_auth_session_issuer"),
)

_AUTH_ROLES = ("domi_auth_lookup", "domi_auth_session_issuer")


def _expected_values() -> str:
    """Produce a fixed VALUES clause from developer-owned, non-user constants."""
    values = []
    for name, signature, result_type, is_set, role in _REQUIRED_AUTH_FUNCTIONS:
        values.append(
            "('" + name + "','" + signature + "','" + result_type + "',"
            + ("true" if is_set else "false") + ",'" + role + "')"
        )
    return ",".join(values)


def check_signed_auth_login_readiness(db) -> None:
    """Block signed PostgreSQL startup unless real auth SQL is least-privileged.

    In particular NOINHERIT alone is insufficient: a role member may be able
    to SET ROLE, and a column-level grant is not a table-level grant.
    """
    roles = db.execute(
        "SELECT COUNT(*) AS safe_logins, "
        "COUNT(*) FILTER (WHERE EXISTS("
        " SELECT 1 FROM pg_catalog.pg_roles inherited "
        " WHERE inherited.oid<>r.oid "
        " AND pg_catalog.pg_has_role(r.oid,inherited.oid,'MEMBER')"
        ")) AS roles_with_memberships "
        "FROM pg_catalog.pg_roles r "
        "WHERE r.rolname IN ('domi_auth_lookup','domi_auth_session_issuer') "
        "AND r.rolcanlogin AND NOT r.rolinherit AND NOT r.rolsuper "
        "AND NOT r.rolbypassrls AND NOT r.rolcreaterole "
        "AND NOT r.rolcreatedb AND NOT r.rolreplication"
    ).fetchone()
    if (not roles or int(roles["safe_logins"]) != 2
            or int(roles["roles_with_memberships"]) != 0):
        raise RuntimeError(
            "POSTGRES_AUTH_LOGIN_ROLES_GATE: unsafe or inherited authentication role"
        )

    # No direct table OR column access for either auth LOGIN, including
    # credentials, R31 signing keys and all other public user data.
    # Tests require privileges through narrowly-scoped SECURITY DEFINER APIs.
    direct = db.execute(
        "SELECT EXISTS ("
        " SELECT 1 FROM pg_catalog.pg_class c "
        " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace "
        " CROSS JOIN (VALUES ('domi_auth_lookup'),"
        " ('domi_auth_session_issuer')) AS principal(name) "
        " WHERE n.nspname IN ('public','domi_auth','domi_r31') "
        " AND c.relkind IN ('r','p','v','m','f') "
        " AND ("
        " pg_catalog.has_table_privilege(principal.name,c.oid,"
        " 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') "
        " OR pg_catalog.has_any_column_privilege(principal.name,c.oid,"
        " 'SELECT,INSERT,UPDATE,REFERENCES')"
        " )) AS raw_auth_table_access"
    ).fetchone()
    if not direct or direct["raw_auth_table_access"] is not False:
        raise RuntimeError(
            "POSTGRES_AUTH_LOGIN_GRANTS_GATE: direct table or column authority"
        )

    expected_sql = _expected_values()
    funcs = db.execute(
        "WITH required(proname,signature,result_type,returns_set,principal)"
        " AS (VALUES " + expected_sql + ") "
        "SELECT COUNT(*) AS verified_functions FROM required req "
        "JOIN pg_catalog.pg_namespace n ON n.nspname='domi_auth' "
        "JOIN pg_catalog.pg_proc p ON p.pronamespace=n.oid "
        " AND p.proname=req.proname "
        " AND pg_catalog.oidvectortypes(p.proargtypes)=req.signature "
        " AND p.prorettype=req.result_type::pg_catalog.regtype "
        " AND p.proretset=req.returns_set "
        " AND p.pronargdefaults=0 AND p.prokind='f' AND p.prosecdef "
        "JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=p.proowner "
        "JOIN pg_catalog.pg_language lang ON lang.oid=p.prolang "
        "WHERE lang.lanname IN ('sql','plpgsql') "
        " AND NOT owner_role.rolcanlogin AND NOT owner_role.rolinherit "
        " AND NOT owner_role.rolsuper AND NOT owner_role.rolbypassrls "
        " AND NOT owner_role.rolcreaterole AND NOT owner_role.rolcreatedb "
        " AND NOT owner_role.rolreplication "
        " AND has_schema_privilege(req.principal,n.oid,'USAGE') "
        " AND NOT has_schema_privilege(req.principal,n.oid,'CREATE') "
        " AND NOT has_schema_privilege('domi_app_runtime',n.oid,'USAGE,CREATE') "
        " AND has_function_privilege(req.principal,p.oid,'EXECUTE') "
        " AND NOT has_function_privilege('domi_app_runtime',p.oid,'EXECUTE') "
        " AND NOT has_function_privilege("
        " CASE WHEN req.principal='domi_auth_lookup' "
        " THEN 'domi_auth_session_issuer' ELSE 'domi_auth_lookup' END,"
        " p.oid,'EXECUTE') "
        " AND EXISTS (SELECT 1 FROM pg_catalog.unnest(p.proconfig) cfg "
        " WHERE pg_catalog.replace(cfg,' ','')="
        " 'search_path=pg_catalog,pg_temp') "
        " AND NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode("
        " COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl "
        " WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE')"
    ).fetchone()
    if not funcs or int(funcs["verified_functions"]) != len(_REQUIRED_AUTH_FUNCTIONS):
        raise RuntimeError(
            "POSTGRES_AUTH_LOGIN_FUNCTION_GATE: required scoped auth functions missing"
        )

    # Even when the nine expected functions exist, an extra grant on a
    # second overload or legacy issue_session() must stop startup.
    extra = db.execute(
        "WITH required(proname,signature,result_type,returns_set,principal) "
        "AS (VALUES " + expected_sql + ") "
        "SELECT COUNT(*) AS unexpected_functions FROM pg_catalog.pg_proc p "
        "JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace "
        "CROSS JOIN (VALUES ('domi_auth_lookup'),"
        " ('domi_auth_session_issuer')) AS executor(name) "
        "WHERE n.nspname='domi_auth' "
        "AND has_function_privilege(executor.name,p.oid,'EXECUTE') "
        "AND NOT EXISTS (SELECT 1 FROM required req "
        " WHERE req.proname=p.proname "
        " AND req.signature=pg_catalog.oidvectortypes(p.proargtypes) "
        " AND req.principal=executor.name)"
    ).fetchone()
    if not extra or int(extra["unexpected_functions"]) != 0:
        raise RuntimeError(
            "POSTGRES_AUTH_LOGIN_EXTRA_FUNCTION_GATE: unreviewed executable entrypoint"
        )

    # All these checks are necessary, never sufficient, for a deployment.
