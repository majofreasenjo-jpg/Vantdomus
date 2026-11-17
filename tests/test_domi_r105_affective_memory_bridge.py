"""R105: authenticated real SQLite memory -> affect readback -> invalidation.

No provider/network/LLM. All sensitive information remains inside disposable DB.
"""
from __future__ import annotations

import importlib
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "R105-bridge-local-test-2026!"


@pytest.fixture
def family(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "r105.db"))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "domi-r105-synthetic-secret-32-characters")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "domi-r105-mfa-synthetic-secret-32-chars")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.setenv("ASSISTANT_REAL_PROVIDER_ENABLED", "0")
    monkeypatch.setenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED", "0")
    sys.path.insert(0, str(ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    from app.db import connect
    from app.assistant import memory
    from app.assistant.affective_runtime import Candidate
    from app.assistant import affective_memory_bridge as bridge

    with TestClient(main.app) as client:
        users = {}
        for label in ("ana", "bruno"):
            email = f"r105-{label}@example.com"
            r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
            assert r.status_code == 200, r.text
            users[label] = email
        db = connect()
        try:
            hid = str(uuid.uuid4())
            db.execute(
                "INSERT INTO households (id,name,meta,created_at) VALUES (?,?,?,?)",
                (hid, "Hogar R105", "{}", "2026-11-16T00:00:00Z")
            )
            people = {}
            user_ids = {}
            for label in ("ana", "bruno"):
                uid = db.execute(
                    "SELECT id FROM users WHERE email=?", (users[label],)
                ).fetchone()["id"]
                user_ids[label] = uid
                pid = str(uuid.uuid4())
                people[label] = pid
                db.execute(
                    "INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
                    (hid, uid, "owner" if label == "ana" else "member", "2026-11-16T00:00:00Z")
                )
                db.execute(
                    "INSERT INTO persons (id,household_id,display_name,user_id,created_at) VALUES (?,?,?,?,?)",
                    (pid, hid, label, uid, "2026-11-16T00:00:00Z")
                )
            # Already-confirmed preference: cannot be silently treated as affect
            # until an independent user-ratified link is written.
            mid = memory.add_memory(
                db, household_id=hid, organization_id=None,
                person_id=people["ana"], memory_type="calm_strategy",
                content="Prefiero confirmar primero una nueva actividad",
                importance=0.8, created_by_user_id=user_ids["ana"],
                visibility_scope="private_self", source="family",
                inference_status="confirmed",
            )
            db.commit()
            options = (
                Candidate("routine", 0.70, 0, True),
                Candidate("ask_clarification", 0.63, 1, True),
                Candidate("unauthorized", 1, 1, False),
            )
            yield (db, hid, people, user_ids, mid, options, bridge, memory)
        finally:
            db.close()


def query(f, user="ana", house=None, surface="PERSONAL_MOBILE", enabled=True):
    db, hid, people, users, mid, options, bridge, memory = f
    return bridge.preview_from_confirmed_memory(
        db, household_id=house or hid, user_id=users[user],
        surface=surface, context_key="schedule", candidates=options,
        use_affect=enabled,
    )


def ratify(f, user="ana", memory_id=None, scope="schedule", consent=True):
    db, hid, people, users, mid, options, bridge, memory = f
    return bridge.ratify_affective_link(
        db, household_id=hid, user_id=users[user],
        memory_id=mid if memory_id is None else memory_id,
        context_key=scope, valence=1.0, activation=0.5, relevance=1.0,
        consent_for_affect=consent,
    )


def test_end_to_end_confirmed_private_memory_affect_and_ablation(family):
    assert query(family).selected_key == "routine"
    link = ratify(family)
    family[0].commit()
    on = query(family)
    off = query(family, enabled=False)
    assert on.selected_key == "ask_clarification"
    assert on.causal_credit == "FUNCTIONAL_ORDER_CHANGE"
    assert off.selected_key == "routine"
    assert on.allowed_trace_count == 1
    assert "unauthorized" not in [x.key for x in on.ranked]
    assert "Prefiero confirmar" not in repr(on)


def test_persistence_across_db_connection_restart(family):
    db, hid, people, users, mid, options, bridge, memory = family
    ratify(family)
    db.commit()
    from app.db import connect
    reopened = connect()
    try:
        out = bridge.preview_from_confirmed_memory(
            reopened, household_id=hid, user_id=users["ana"],
            surface="PERSONAL_DESKTOP", context_key="schedule",
            candidates=options, use_affect=True,
        )
        assert out.selected_key == "ask_clarification"
    finally:
        reopened.close()


def test_cross_person_owner_and_shared_tv_never_leak(family):
    ratify(family)
    family[0].commit()
    assert query(family, user="bruno").allowed_trace_count == 0
    assert query(family, surface="SHARED_TV").allowed_trace_count == 0
    assert query(family, surface="OTHER").allowed_trace_count == 0


def test_missing_household_membership_and_wrong_tenant_fail_closed(family):
    ratify(family)
    family[0].commit()
    with pytest.raises(PermissionError):
        query(family, house="other-household")
    with pytest.raises(PermissionError):
        family[6].preview_from_confirmed_memory(
            family[0], household_id=family[1], user_id="unbound",
            surface="PERSONAL_DESKTOP", context_key="schedule",
            candidates=family[5], use_affect=True,
        )


def test_explicit_consent_and_confirmed_source_required(family):
    with pytest.raises(PermissionError, match="CONSENT"):
        ratify(family, consent=False)
    with pytest.raises(PermissionError):
        ratify(family, user="bruno")
    db, hid, people, users, mid, options, bridge, memory = family
    unconfirmed = memory.add_memory(
        db, household_id=hid, organization_id=None, person_id=people["ana"],
        memory_type="preference", content="Dato aún no ratificado",
        importance=0.5, created_by_user_id=users["ana"],
        visibility_scope="private_self", inference_status="pending",
    )
    with pytest.raises(PermissionError):
        ratify(family, memory_id=unconfirmed)


def test_revoke_is_immediate_and_only_the_owner_can_revoke(family):
    db, hid, people, users, mid, options, bridge, memory = family
    link = ratify(family)
    db.commit()
    with pytest.raises(PermissionError):
        bridge.revoke_affective_link(db, household_id=hid,
                                    user_id="unauthorized-user", link_id=link)
    assert not bridge.revoke_affective_link(
        db, household_id=hid, user_id=users["bruno"], link_id=link
    )
    assert query(family).allowed_trace_count == 1
    assert bridge.revoke_affective_link(
        db, household_id=hid, user_id=users["ana"], link_id=link
    )
    db.commit()
    assert query(family).selected_key == "routine"


def test_source_memory_deleted_invalidate_overlay(family):
    db, hid, people, users, mid, options, bridge, memory = family
    ratify(family)
    db.commit()
    assert memory.delete_memory(
        db, hid, mid, requester_user_id=users["ana"],
        requester_person_id=people["ana"], requester_role="owner"
    )
    db.commit()
    assert query(family).allowed_trace_count == 0


def test_corrected_memory_invalidate_even_if_still_confirmed(family):
    db, hid, people, users, mid, options, bridge, memory = family
    ratify(family)
    db.commit()
    assert memory.correct_memory(
        db, hid, mid, "Ya no tengo esa preferencia",
        requester_user_id=users["ana"],
        requester_person_id=people["ana"], requester_role="owner"
    )
    db.commit()
    assert query(family).selected_key == "routine"


def test_source_visibility_change_and_expiry_invalidate(family):
    db, hid, people, users, mid, options, bridge, memory = family
    ratify(family)
    db.execute("UPDATE memory_items SET visibility_scope='household_shared' WHERE id=?", (mid,))
    db.commit()
    assert query(family).allowed_trace_count == 0
    db.execute("UPDATE memory_items SET visibility_scope='private_self', expires_at=? WHERE id=?",
               ("2020-01-01T00:00:00+00:00", mid))
    db.commit()
    assert query(family).allowed_trace_count == 0


def test_no_private_inference_from_free_text_and_no_automatic_promotions(family):
    db, hid, people, users, mid, options, bridge, memory = family
    no_link = query(family)
    assert no_link.allowed_trace_count == 0
    assert not db.execute(
        "SELECT id FROM domi_affective_memory_links"
    ).fetchall()


def test_invalid_context_and_untrusted_claims_fail_closed(family):
    with pytest.raises(ValueError):
        ratify(family, scope="schedule; DROP TABLE memory_items")
    with pytest.raises(ValueError):
        family[6].preview_from_confirmed_memory(
            family[0], household_id=family[1],
            user_id=family[3]["ana"], surface="PERSONAL_MOBILE",
            context_key="../path", candidates=family[5], use_affect=True,
        )
