"""R48 regression tests for exact auth metadata admission, no live DB."""
from __future__ import annotations
import importlib.util
from pathlib import Path
import pytest

MODULE = Path(__file__).resolve().parents[2] / "apps/api/app/pg_auth_readiness.py"
SPEC = importlib.util.spec_from_file_location("domi_pg_auth_readiness", MODULE)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class FakeDB:
    def __init__(self, *, logins=2, memberships=0, direct=False,
                 functions=9, unexpected=0):
        self.responses = [
            {"safe_logins": logins, "roles_with_memberships": memberships},
            {"raw_auth_table_access": direct},
            {"verified_functions": functions},
            {"unexpected_functions": unexpected},
        ]
        self.sql = []

    def execute(self, sql):
        self.sql.append(sql)
        return self

    def fetchone(self):
        return self.responses.pop(0)


def test_auth_gate_accepts_complete_restricted_contract():
    db = FakeDB()
    gate.check_signed_auth_login_readiness(db)
    assert len(db.sql) == 4
    assert "p.prosecdef" in db.sql[2]
    assert "domi_app_runtime" in db.sql[2]


@pytest.mark.parametrize("kwargs,code", [
    ({"logins": 0}, "POSTGRES_AUTH_LOGIN_ROLES_GATE"),
    ({"logins": 1}, "POSTGRES_AUTH_LOGIN_ROLES_GATE"),
    ({"memberships": 1}, "POSTGRES_AUTH_LOGIN_ROLES_GATE"),
    ({"direct": True}, "POSTGRES_AUTH_LOGIN_GRANTS_GATE"),
    ({"functions": 0}, "POSTGRES_AUTH_LOGIN_FUNCTION_GATE"),
    ({"functions": 8}, "POSTGRES_AUTH_LOGIN_FUNCTION_GATE"),
    ({"unexpected": 1}, "POSTGRES_AUTH_LOGIN_EXTRA_FUNCTION_GATE"),
])
def test_auth_gate_blocks_missing_or_excessive_authority(kwargs, code):
    with pytest.raises(RuntimeError, match=code):
        gate.check_signed_auth_login_readiness(FakeDB(**kwargs))


def test_auth_gate_enforces_exact_signature_and_acl_exposure():
    db = FakeDB()
    gate.check_signed_auth_login_readiness(db)
    sql = db.sql[2]
    assert "oidvectortypes(p.proargtypes)=req.signature" in sql
    assert "p.prorettype=req.result_type::pg_catalog.regtype" in sql
    assert "p.proretset=req.returns_set" in sql
    assert "p.pronargdefaults=0" in sql
    assert "lang.lanname IN ('sql','plpgsql')" in sql
    assert "aclexplode" in sql
    assert "acl.grantee=0" in sql
    assert "search_path=pg_catalog,pg_temp" in sql
    assert "THEN 'domi_auth_session_issuer'" in sql
    assert "NOT has_schema_privilege('domi_app_runtime'" in sql
    assert "has_any_column_privilege" in db.sql[1]
    assert "pg_has_role" in db.sql[0]
    assert "to_regprocedure" not in " ".join(db.sql)
    assert len(gate._REQUIRED_AUTH_FUNCTIONS) == 9


def test_no_unexpected_legacy_or_overloaded_entrypoint():
    db = FakeDB()
    gate.check_signed_auth_login_readiness(db)
    sql = db.sql[3]
    assert "unexpected_functions" in sql
    assert "NOT EXISTS" in sql
    assert "oidvectortypes(p.proargtypes)" in sql
    assert "issue_session_bound" in db.sql[2]
    assert "prepare_session_proof" in db.sql[2]
