"""Fail-closed PostgreSQL readiness gate for DOMI staging / production.

This module never mutates the database. The runtime login must be a non-owner,
non-BYPASSRLS role. Provision migrations, permissions and RLS out of band.
"""
from __future__ import annotations

EXPECTED_DOMI_TABLES = 57


def check_postgres_staging_readiness(db) -> None:
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
    if int(summary["owned_count"]) != 0:
        raise RuntimeError("POSTGRES_RUNTIME_ROLE_UNSAFE: application role owns tables")

    # RLS being enabled is not proof of effective isolation: verify
    # policies, FORCE RLS and runtime grant surface in a separate gate.
    # This preflight deliberately refuses a schema with no policies.
    policy_count = db.execute(
        "SELECT COUNT(*) AS policy_count FROM pg_policies "
        "WHERE schemaname='public'"
    ).fetchone()
    if not policy_count or int(policy_count["policy_count"]) == 0:
        raise RuntimeError("POSTGRES_POLICY_GATE: no RLS policies configured")

    # Security gate only: it does not certify that tenant policies are correct.
    # Functional two-tenant adversarial tests are still mandatory before deploy.
