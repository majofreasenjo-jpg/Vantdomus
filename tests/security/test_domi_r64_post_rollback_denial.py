"""R64: after R36 fail-closed rollback, R63 cannot reopen permissions."""
import os
from pathlib import Path
from urllib.parse import urlsplit
import pytest
psycopg2 = pytest.importorskip("psycopg2")
DSN = os.getenv("DOMI_RLS_TEST_DSN","")
if os.getenv("DOMI_RLS_REQUIRE_LIVE") == "1" and not DSN:
    raise RuntimeError("disposable PostgreSQL DSN mandatory")
pytestmark = pytest.mark.skipif(not DSN,reason="dedicated disposable PostgreSQL only")
SQL = Path(__file__).resolve().parents[2]/"apps/api/postgres_staging_migrations/security/305_domi_r63_reminder_pilot_rls_up.sql"

def test_r64_closed_base_stays_closed():
    p=urlsplit(DSN)
    assert p.hostname in ("127.0.0.1","localhost") and p.path=="/domi_rls_ci"
    db=psycopg2.connect(DSN)
    try:
        with db.cursor() as c:
            with pytest.raises(psycopg2.Error,match="R63_BASE_PREREQUISITE_CLOSED"):
                c.execute(SQL.read_text(encoding="utf8"))
        db.rollback()
        with db.cursor() as c:
            for tbl in ("assistant_proposals","family_reminders"):
                for op in ("SELECT","INSERT","UPDATE","DELETE"):
                    c.execute("SELECT has_table_privilege('domi_app_runtime',%s,%s)",("public."+tbl,op))
                    assert c.fetchone()[0] is False,(tbl,op)
    finally:
        db.rollback()
        db.close()
