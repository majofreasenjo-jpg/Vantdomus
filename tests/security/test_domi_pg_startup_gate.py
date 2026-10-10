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
                 create_role=False, create_db=False, count=57, rls=57, owner=0):
        self.rows = [
            DummyRow(role_name=role, bypass_rls=bypass),
            DummyRow(rolsuper=superuser, rolcreaterole=create_role, rolcreatedb=create_db),
            DummyRow(table_count=count, rls_count=rls, force_rls_count=0, owned_count=owner),
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
    assert len(db.calls) == 3
