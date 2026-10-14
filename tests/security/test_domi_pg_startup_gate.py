"""Contract tests for the PostgreSQL staging startup gate (no live database)."""
from __future__ import annotations
import importlib.util
from pathlib import Path

MODULE = Path(__file__).resolve().parents[2] / "apps/api/app/pg_staging_gate.py"
SPEC = importlib.util.spec_from_file_location("pg_staging_gate", MODULE)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class DummyRow(dict):
    pass


class FakeDB:
    def __init__(self, *, role="domi_api", bypass=False, superuser=False,
                 create_role=False, create_db=False, unsafe_membership=False, count=57,
                 rls=57, force_rls=57, owner=0, policies=57, auth_ready=True,
                 signed_role=True,signed_auth=True,signed_keys=True,signed_crypto=True):
        self.rows = [
            DummyRow(role_name=role, bypass_rls=bypass),
            DummyRow(rolsuper=superuser, rolcreaterole=create_role, rolcreatedb=create_db),
            DummyRow(unsafe_membership=unsafe_membership),
            DummyRow(table_count=count, rls_count=rls, force_rls_count=force_rls, owned_count=owner),
            DummyRow(tables_without_policy=max(0, count - policies)),
            DummyRow(auth_helper_ready=auth_ready),
            DummyRow(signed_runtime_ready=signed_role),
            DummyRow(signed_auth_ready=signed_auth),
            DummyRow(signed_secrets_ready=signed_keys),
            DummyRow(signed_crypto_ready=signed_crypto),
        ]
        self.calls = []

    def execute(self, query, args=None):
        self.calls.append((query, args))
        return self

    def fetchone(self):
        return self.rows.pop(0)


def fails(db, pattern):
    try:
        gate.check_postgres_staging_readiness(db)
    except RuntimeError as exc:
        assert pattern in str(exc), str(exc)
    else:
        raise AssertionError("expected fail-closed gate")


def test_pg_gate_rejects_missing_rls():
    fails(FakeDB(rls=0), "POSTGRES_RLS_GATE")


def test_pg_gate_rejects_owner():
    fails(FakeDB(role="neondb_owner", bypass=True), "POSTGRES_RUNTIME_ROLE_UNSAFE")
    fails(FakeDB(owner=57), "POSTGRES_RUNTIME_ROLE_UNSAFE")


def test_pg_gate_rejects_missing_table():
    fails(FakeDB(count=56), "POSTGRES_SCHEMA_GATE")


def test_pg_gate_rejects_privileged_runtime():
    fails(FakeDB(superuser=True), "POSTGRES_RUNTIME_ROLE_UNSAFE")
    fails(FakeDB(create_role=True), "POSTGRES_RUNTIME_ROLE_UNSAFE")


def test_pg_gate_accepts_unprivileged_fully_rls_enabled_schema():
    db = FakeDB()
    gate.check_postgres_staging_readiness(db)
    assert len(db.calls) == 6


def test_pg_gate_rejects_empty_policy_catalog():
    fails(FakeDB(policies=0), "POSTGRES_POLICY_GATE")


def test_pg_gate_rejects_one_table_without_policy():
    fails(FakeDB(policies=56), "POSTGRES_POLICY_GATE")


def test_pg_gate_rejects_missing_restricted_auth_bootstrap():
    fails(FakeDB(auth_ready=False), "POSTGRES_AUTH_GATE")


def test_pg_gate_rejects_privileged_role_membership():
    fails(FakeDB(unsafe_membership=True), "POSTGRES_RUNTIME_ROLE_UNSAFE")


def test_pg_gate_rejects_tables_without_force_rls():
    fails(FakeDB(force_rls=56), "POSTGRES_FORCE_RLS_GATE")


def test_pg_gate_signed_mode_accepts_real_signed_auth_without_legacy_helper():
    # Strict mode MUST NOT accept (or require) the obsolete legacy helper.
    db=FakeDB(auth_ready=False)
    # Legacy response sits unused at slot 6: remove it to line up the new mode.
    db.rows.pop(5)
    gate.check_postgres_staging_readiness(db,signed_rls=True)
    assert len(db.calls)==9
    assert "domi_r31.subject_id()" in db.calls[6][0]
    assert "activate_session" not in " ".join(query for query,_ in db.calls)


def test_pg_gate_signed_mode_rejects_missing_role_verifier_key_and_crypto():
    for field,code in (
        ("signed_role","POSTGRES_SIGNED_ROLE_GATE"),
        ("signed_auth","POSTGRES_SIGNED_AUTH_GATE"),
        ("signed_keys","POSTGRES_SIGNED_KEY_GATE"),
        ("signed_crypto","POSTGRES_SIGNED_CRYPTO_GATE"),
    ):
        db=FakeDB(**{field:False})
        db.rows.pop(5)
        try:
            gate.check_postgres_staging_readiness(db,signed_rls=True)
        except RuntimeError as e:
            assert code in str(e),str(e)
        else:
            raise AssertionError("Signed startup unexpectedly accepted "+field)


def test_pg_gate_signed_mode_still_checks_all_57_force_rls():
    db=FakeDB(force_rls=56)
    db.rows.pop(5)
    try:
        gate.check_postgres_staging_readiness(db,signed_rls=True)
    except RuntimeError as e:
        assert "POSTGRES_FORCE_RLS_GATE" in str(e)
    else:
        raise AssertionError("Signed startup bypassed RLS")
