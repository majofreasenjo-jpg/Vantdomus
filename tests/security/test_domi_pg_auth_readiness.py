"""R47: deterministic fail-closed real PostgreSQL auth login readiness tests."""
from __future__ import annotations
import importlib.util
from pathlib import Path
import pytest

MODULE = Path(__file__).resolve().parents[2] / "apps/api/app/pg_auth_readiness.py"
SPEC = importlib.util.spec_from_file_location("domi_pg_auth_readiness", MODULE)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class FakeDB:
    def __init__(self, *, logins=2, direct=False, functions=9):
        self.responses = [
            {"safe_logins": logins},
            {"raw_auth_table_access": direct},
            {"verified_functions": functions},
        ]
        self.sql = []

    def execute(self, sql):
        self.sql.append(sql)
        return self

    def fetchone(self):
        return self.responses.pop(0)


def test_auth_gate_accepts_only_complete_restricted_contract():
    db = FakeDB()
    gate.check_signed_auth_login_readiness(db)
    assert len(db.sql) == 3
    assert "p.prosecdef" in db.sql[2]
    assert "domi_app_runtime" in db.sql[2]


@pytest.mark.parametrize("logins,direct,functions,code", [
    (0, False, 9, "POSTGRES_AUTH_LOGIN_ROLES_GATE"),
    (1, False, 9, "POSTGRES_AUTH_LOGIN_ROLES_GATE"),
    (2, True, 9, "POSTGRES_AUTH_LOGIN_GRANTS_GATE"),
    (2, False, 0, "POSTGRES_AUTH_LOGIN_FUNCTION_GATE"),
    (2, False, 8, "POSTGRES_AUTH_LOGIN_FUNCTION_GATE"),
])
def test_auth_gate_blocks_missing_or_excessive_authority(logins, direct, functions, code):
    with pytest.raises(RuntimeError, match=code):
        gate.check_signed_auth_login_readiness(FakeDB(
            logins=logins, direct=direct, functions=functions
        ))


def test_auth_gate_catalog_lookup_does_not_resolve_private_schema_by_name():
    db = FakeDB()
    gate.check_signed_auth_login_readiness(db)
    assert "to_regprocedure" not in " ".join(db.sql)
    assert "has_schema_privilege" in db.sql[2]
    assert "has_function_privilege" in db.sql[2]
    assert "rolbypassrls" in db.sql[0]
    assert len(gate._REQUIRED_AUTH_FUNCTIONS) == 9
