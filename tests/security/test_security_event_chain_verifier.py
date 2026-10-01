from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "apps" / "api" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import security_event_chain_verify as verifier  # noqa: E402


def create_db(path: Path, *, with_hash_columns: bool = True) -> sqlite3.Connection:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    if with_hash_columns:
        con.execute(
            """
            CREATE TABLE security_events (
              id TEXT PRIMARY KEY,
              household_id TEXT,
              organization_id TEXT,
              user_id TEXT,
              event_type TEXT NOT NULL,
              severity TEXT NOT NULL,
              source TEXT NOT NULL,
              metadata TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              previous_hash TEXT,
              event_hash TEXT
            )
            """
        )
    else:
        con.execute(
            """
            CREATE TABLE security_events (
              id TEXT PRIMARY KEY,
              household_id TEXT,
              organization_id TEXT,
              user_id TEXT,
              event_type TEXT NOT NULL,
              severity TEXT NOT NULL,
              source TEXT NOT NULL,
              metadata TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL
            )
            """
        )
    con.commit()
    return con


def append_event(
    con: sqlite3.Connection,
    *,
    event_id: str,
    household_id: str | None,
    previous_hash: str | None,
    metadata: dict | None = None,
) -> str:
    payload = {
        "event_id": event_id,
        "household_id": household_id,
        "organization_id": "org-1" if household_id else None,
        "user_id": "user-1",
        "event_type": "test_event",
        "severity": "medium",
        "source": "unit-test",
        "metadata": metadata or {"safe": True},
        "created_at": f"2026-10-01T12:00:{event_id[-2:]}.000000+00:00",
        "previous_hash": previous_hash,
    }
    event_hash = verifier._event_hash(**payload)
    con.execute(
        """
        INSERT INTO security_events (
          id, household_id, organization_id, user_id, event_type, severity,
          source, metadata, created_at, previous_hash, event_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            household_id,
            payload["organization_id"],
            payload["user_id"],
            payload["event_type"],
            payload["severity"],
            payload["source"],
            json.dumps(payload["metadata"]),
            payload["created_at"],
            previous_hash,
            event_hash,
        ),
    )
    con.commit()
    return event_hash


class SecurityEventChainVerifierTests(unittest.TestCase):
    def test_valid_multiple_chains_pass_and_emit_privacy_minimized_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path)
            a1 = append_event(con, event_id="event-01", household_id="house-a", previous_hash=None)
            append_event(con, event_id="event-02", household_id="house-a", previous_hash=a1)
            b1 = append_event(con, event_id="event-03", household_id="house-b", previous_hash=None)
            append_event(con, event_id="event-04", household_id="house-b", previous_hash=b1)
            con.close()

            ro = verifier._sqlite_readonly(path)
            result = verifier.verify_database(ro)
            ro.close()

            self.assertTrue(result["ok"])
            self.assertEqual(result["status"], "PASS_SECURITY_EVENT_CHAIN")
            self.assertEqual(result["checked"], 4)
            self.assertEqual(result["chain_count"], 2)
            self.assertTrue(result["read_only"])
            self.assertFalse(result["metadata_emitted"])
            serialized = json.dumps(result)
            self.assertNotIn("house-a", serialized)
            self.assertNotIn("house-b", serialized)
            self.assertNotIn("user-1", serialized)

    def test_tampered_metadata_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path)
            append_event(con, event_id="event-01", household_id="house-a", previous_hash=None)
            con.execute("UPDATE security_events SET metadata=? WHERE id=?", ('{"safe":false}', "event-01"))
            con.commit()
            con.close()

            ro = verifier._sqlite_readonly(path)
            result = verifier.verify_database(ro)
            ro.close()

            self.assertFalse(result["ok"])
            self.assertEqual(result["failure_code"], "EVENT_HASH_MISMATCH")
            self.assertNotIn("event-01", json.dumps(result))

    def test_tampered_previous_hash_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path)
            first = append_event(con, event_id="event-01", household_id="house-a", previous_hash=None)
            append_event(con, event_id="event-02", household_id="house-a", previous_hash=first)
            con.execute("UPDATE security_events SET previous_hash=? WHERE id=?", ("0" * 64, "event-02"))
            con.commit()
            con.close()

            ro = verifier._sqlite_readonly(path)
            result = verifier.verify_database(ro)
            ro.close()

            self.assertFalse(result["ok"])
            self.assertEqual(result["failure_code"], "EVENT_HASH_MISMATCH")

    def test_missing_hash_columns_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path, with_hash_columns=False)
            con.close()

            ro = verifier._sqlite_readonly(path)
            with self.assertRaisesRegex(RuntimeError, "SECURITY_EVENT_CHAIN_SCHEMA_OR_QUERY_FAILURE"):
                verifier.verify_database(ro)
            ro.close()

    def test_orphan_link_fails_closed_even_if_hash_is_recomputed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path)
            append_event(con, event_id="event-01", household_id="house-a", previous_hash=None)
            orphan = "f" * 64
            append_event(con, event_id="event-02", household_id="house-a", previous_hash=orphan)
            con.close()

            ro = verifier._sqlite_readonly(path)
            result = verifier.verify_database(ro)
            ro.close()

            self.assertFalse(result["ok"])
            self.assertEqual(result["failure_code"], "CHAIN_ORPHAN_PREVIOUS_HASH")

    def test_branch_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path)
            first = append_event(con, event_id="event-01", household_id="house-a", previous_hash=None)
            append_event(con, event_id="event-02", household_id="house-a", previous_hash=first)
            append_event(con, event_id="event-03", household_id="house-a", previous_hash=first)
            con.close()

            ro = verifier._sqlite_readonly(path)
            result = verifier.verify_database(ro)
            ro.close()

            self.assertFalse(result["ok"])
            self.assertEqual(result["failure_code"], "CHAIN_BRANCH_DETECTED")

    def test_empty_database_is_hold_by_default_and_can_be_explicitly_allowed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path)
            con.close()

            ro = verifier._sqlite_readonly(path)
            hold = verifier.verify_database(ro)
            allow = verifier.verify_database(ro, allow_empty=True)
            ro.close()

            self.assertFalse(hold["ok"])
            self.assertEqual(hold["failure_code"], "EMPTY_CHAIN_SET")
            self.assertTrue(allow["ok"])
            self.assertEqual(allow["status"], "PASS_EMPTY_ALLOWED")

    def test_household_filter_checks_only_selected_chain(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.db"
            con = create_db(path)
            append_event(con, event_id="event-01", household_id="house-a", previous_hash=None)
            append_event(con, event_id="event-02", household_id="house-b", previous_hash=None)
            con.execute("UPDATE security_events SET metadata=? WHERE id=?", ('{"tampered":true}', "event-02"))
            con.commit()
            con.close()

            ro = verifier._sqlite_readonly(path)
            selected = verifier.verify_database(ro, household_id="house-a")
            all_rows = verifier.verify_database(ro)
            ro.close()

            self.assertTrue(selected["ok"])
            self.assertFalse(all_rows["ok"])
            self.assertEqual(all_rows["failure_code"], "EVENT_HASH_MISMATCH")

    def test_cli_missing_database_location_fails_closed(self):
        old_db_path = __import__("os").environ.pop("DB_PATH", None)
        old_db_url = __import__("os").environ.pop("DATABASE_URL", None)
        try:
            code = verifier.main(["--max-events", "10"])
            self.assertEqual(code, 1)
        finally:
            if old_db_path is not None:
                __import__("os").environ["DB_PATH"] = old_db_path
            if old_db_url is not None:
                __import__("os").environ["DATABASE_URL"] = old_db_url


if __name__ == "__main__":
    unittest.main()
