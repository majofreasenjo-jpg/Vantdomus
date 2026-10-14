"""Fail-closed PostgreSQL readiness gate for DOMI staging / production.

This module never mutates the database. The runtime login must be a non-owner,
non-BYPASSRLS role. Provision migrations, permissions and RLS out of band.
"""
from __future__ import annotations

EXPECTED_DOMI_TABLES = 57


def check_postgres_staging_readiness(db, *, signed_rls: bool = False) -> None:
    """Refuse startup until the separately provisioned schema is safe.

    This gate is deliberately stricter than just checking that the database
    answers SELECT 1: the API must never authenticate as a migration owner.
    """
    identity = db.execute(
        "SELECT current_user AS role_name, "
        "(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass_rls"
    ).fetchone()
    if not identity or identity["bypass_rls"]:
        raise RuntimeError("POSTGRES_RUNTIME_ROLE_UNSAFE: BYPASSRLS is forbidden")

    role_name = identity["role_name"]
    privileged = db.execute(
        "SELECT rolsuper, rolcreaterole, rolcreatedb "
        "FROM pg_roles WHERE rolname=%s", (role_name,)
    ).fetchone()
    if not privileged or any(privileged[key] for key in ("rolsuper", "rolcreaterole", "rolcreatedb")):
        raise RuntimeError("POSTGRES_RUNTIME_ROLE_UNSAFE: privileged role is forbidden")

    # Membership in another privileged role can enable SET ROLE or
    # inherited authority even when the immediate login is unprivileged.
    unsafe = db.execute(
        "SELECT EXISTS (SELECT 1 FROM pg_roles r "
        "WHERE r.rolname<>current_user "
        "AND pg_has_role(current_user,r.oid,'member') "
        "AND (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole "
        "OR r.rolcreatedb OR EXISTS ("
        "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        "WHERE n.nspname='public' AND c.relkind='r' AND c.relowner=r.oid"
        "))) AS unsafe_membership"
    ).fetchone()
    if not unsafe or unsafe["unsafe_membership"]:
        raise RuntimeError("POSTGRES_RUNTIME_ROLE_UNSAFE: privileged role membership forbidden")

    summary = db.execute(
        "SELECT COUNT(*) AS table_count, "
        "COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_count, "
        "COUNT(*) FILTER (WHERE c.relforcerowsecurity) AS force_rls_count, "
        "COUNT(*) FILTER (WHERE pg_get_userbyid(c.relowner)=current_user) AS owned_count "
        "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        "WHERE n.nspname='public' AND c.relkind='r'"
    ).fetchone()
    if not summary or int(summary["table_count"]) != EXPECTED_DOMI_TABLES:
        raise RuntimeError("POSTGRES_SCHEMA_GATE: expected exactly 57 public tables")
    if int(summary["rls_count"]) != EXPECTED_DOMI_TABLES:
        raise RuntimeError("POSTGRES_RLS_GATE: all public tables must have RLS enabled")
    if int(summary["force_rls_count"]) != EXPECTED_DOMI_TABLES:
        raise RuntimeError("POSTGRES_FORCE_RLS_GATE: all public tables must use FORCE RLS")
    if int(summary["owned_count"]) != 0:
        raise RuntimeError("POSTGRES_RUNTIME_ROLE_UNSAFE: application role owns tables")

    # Each of the 57 ordinary tables must have at least one policy.
    # One policy elsewhere MUST NOT make an uncovered table appear safe.
    # The policy semantics still require live adversarial verification.
    missing = db.execute(
        "SELECT COUNT(*) AS tables_without_policy "
        "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        "WHERE n.nspname='public' AND c.relkind='r' "
        "AND NOT EXISTS (SELECT 1 FROM pg_policies p "
        "WHERE p.schemaname=n.nspname AND p.tablename=c.relname)"
    ).fetchone()
    if not missing or int(missing["tables_without_policy"]) != 0:
        raise RuntimeError("POSTGRES_POLICY_GATE: some public tables lack an RLS policy")

    # R44: Signed Owner Beta uses domi_r31.subject_id(), not the
    # legacy domi_auth.activate_session(). Never accept the legacy helper as
    # evidence that the HMAC/SET LOCAL/RLS path has been provisioned.
    if signed_rls:
        role = db.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_roles r "
            "WHERE r.rolname='domi_app_runtime' AND NOT r.rolcanlogin "
            "AND NOT r.rolinherit AND NOT r.rolsuper AND NOT r.rolbypassrls "
            "AND NOT r.rolcreatedb AND NOT r.rolcreaterole "
            "AND pg_has_role(session_user,r.oid,'member')) "
            "AS signed_runtime_ready"
        ).fetchone()
        if not role or not role["signed_runtime_ready"]:
            raise RuntimeError("POSTGRES_SIGNED_ROLE_GATE: restricted runtime membership unavailable")

        auth_helper = db.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_proc p "
            "JOIN pg_namespace n ON n.oid=p.pronamespace "
            "JOIN pg_roles r ON r.oid=p.proowner "
            "WHERE p.oid=to_regprocedure('domi_r31.subject_id()') "
            "AND n.nspname='domi_r31' AND p.prosecdef "
            "AND r.rolname='domi_r31_auth_owner' "
            "AND NOT r.rolsuper AND NOT r.rolbypassrls "
            "AND NOT r.rolcreaterole AND NOT r.rolcreatedb "
            "AND NOT r.rolcanlogin AND NOT r.rolinherit "
            "AND has_function_privilege('domi_app_runtime',p.oid,'EXECUTE')) "
            "AS signed_auth_ready"
        ).fetchone()
        if not auth_helper or not auth_helper["signed_auth_ready"]:
            raise RuntimeError("POSTGRES_SIGNED_AUTH_GATE: HMAC subject verifier unavailable")

        secrets_table = db.execute(
            "SELECT EXISTS(SELECT 1 FROM pg_class c "
            "JOIN pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname='domi_r31' AND c.relname='context_secrets' "
            "AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity "
            "AND pg_get_userbyid(c.relowner)='domi_r31_auth_owner' "
            "AND NOT has_table_privilege('domi_app_runtime',c.oid,'SELECT')) "
            "AS signed_secrets_ready"
        ).fetchone()
        if not secrets_table or not secrets_table["signed_secrets_ready"]:
            raise RuntimeError("POSTGRES_SIGNED_KEY_GATE: private context-key table unavailable")

        crypto = db.execute(
            "SELECT EXISTS(SELECT 1 FROM pg_extension e "
            "WHERE e.extname='pgcrypto') "
            "AND to_regprocedure('public.hmac(bytea,bytea,text)') IS NOT NULL "
            "AS signed_crypto_ready"
        ).fetchone()
        if not crypto or not crypto["signed_crypto_ready"]:
            raise RuntimeError("POSTGRES_SIGNED_CRYPTO_GATE: crypto verifier unavailable")
    else:
        auth_helper = db.execute(
            "SELECT EXISTS ("
            "SELECT 1 FROM pg_proc p "
            "JOIN pg_namespace n ON n.oid=p.pronamespace "
            "JOIN pg_roles r ON r.oid=p.proowner "
            "WHERE p.oid=to_regprocedure('domi_auth.activate_session(text,text)') "
            "AND n.nspname='domi_auth' AND p.prosecdef "
            "AND NOT r.rolsuper AND NOT r.rolbypassrls "
            "AND NOT r.rolcreaterole AND NOT r.rolcreatedb "
            "AND NOT r.rolcanlogin "
            "AND has_function_privilege(current_user,p.oid,'EXECUTE')"
            ") AS auth_helper_ready"
        ).fetchone()
        if not auth_helper or not auth_helper["auth_helper_ready"]:
            raise RuntimeError("POSTGRES_AUTH_GATE: restricted auth helper unavailable")

    # Structural gate only. Requires real tenant adversarial tests for rollout.
