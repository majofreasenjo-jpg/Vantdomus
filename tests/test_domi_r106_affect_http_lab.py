"""DOMI R106: real authenticated HTTP consent; synthetic users; no API calls."""
from __future__ import annotations

import importlib
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "R106-isolated-synthetic-2026!"


def auth(token):
    return {"Authorization": "Bearer " + token}


@pytest.fixture
def e(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DOMI_AFFECT_R106_HTTP_LAB_ENABLED", "true")
    monkeypatch.setenv("VANTDOMUS_SKIP_LOCAL_ENV", "1")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "r106.db"))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "domi-r106-jwt-synthetic-secret-32-chars")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "domi-r106-mfa-synthetic-secret-32-chars")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.setenv("ASSISTANT_REAL_PROVIDER_ENABLED", "0")
    monkeypatch.setenv("ASSISTANT_EXTERNAL_CALLS_ALLOWED", "0")
    monkeypatch.setenv("DOMI_ANTHROPIC_FAMILY_OPT_IN", "0")
    sys.path.insert(0, str(ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    from app.db import connect
    from app.assistant import affective_memory_bridge as bridge
    from app.assistant.affective_runtime import Candidate

    with TestClient(main.app) as client:
        people = {}
        for label in ("ana", "bruno", "outsider"):
            email = f"r106-{label}@example.com"
            r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
            assert r.status_code == 200, r.text
            r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
            assert r.status_code == 200, r.text
            people[label] = {"email": email, "token": r.json()["access_token"]}
        household = client.post("/households", params={"name": "R106 synthetic home"},
                                headers=auth(people["ana"]["token"]))
        assert household.status_code == 200, household.text
        hid = household.json()["id"]
        db = connect()
        try:
            for label in ("ana", "bruno", "outsider"):
                uid = db.execute("SELECT id FROM users WHERE email=?", (people[label]["email"],)).fetchone()["id"]
                people[label]["uid"] = uid
                if label == "bruno":
                    db.execute(
                        "INSERT INTO household_memberships(household_id,user_id,role,created_at) VALUES (?,?,?,?)",
                        (hid, uid, "member", "2026-11-17T00:00:00Z"),
                    )
                if label != "outsider":
                    pid = str(uuid.uuid4())
                    people[label]["pid"] = pid
                    db.execute(
                        "INSERT INTO persons(id,household_id,display_name,user_id,created_at,age_band) VALUES (?,?,?,?,?,?)",
                        (pid, hid, label, uid, "2026-11-17T00:00:00Z", "adult"),
                    )
            db.commit()
        finally:
            db.close()
        create = client.post(
            "/assistant/memory", headers=auth(people["ana"]["token"]),
            json={
                "household_id": hid, "person_id": people["ana"]["pid"],
                "memory_type": "calm_strategy",
                "visibility_scope": "private_self",
                "content": "Prefiero consultar antes de reorganizar mi agenda",
            },
        )
        assert create.status_code == 200, create.text
        yield {
            "client": client, "people": people, "hid": hid,
            "mid": create.json()["id"], "connect": connect, "bridge": bridge,
            "candidates": (
                Candidate("routine", 0.70, 0, True),
                Candidate("clarify", 0.63, 1, True),
                Candidate("unsafe", 1, 1, False),
            ),
            "monkeypatch": monkeypatch,
        }


def request(e, method, path, *, user="ana", data=None, params=None):
    return e["client"].request(
        method, path, headers=auth(e["people"][user]["token"]),
        json=data, params=params,
    )


def confirm(e, user="ana", memory_id=None):
    return request(e, "POST", "/assistant/affect-lab/source/confirm", user=user,
                   data={"household_id": e["hid"], "memory_id": memory_id or e["mid"],
                         "explicitly_confirmed": True})


def ratify(e, user="ana", memory_id=None, **more):
    payload = {
        "household_id": e["hid"], "memory_id": memory_id or e["mid"],
        "context_key": "schedule", "valence": 1, "activation": 0.5,
        "relevance": 1, "consent_for_affect": True,
    }
    payload.update(more)
    return request(e, "POST", "/assistant/affect-lab/ratify", user=user, data=payload)


def items(e, user="ana", **params):
    return request(e, "GET", "/assistant/affect-lab/own",
                   user=user, params={"household_id": e["hid"], **params})


def revoke(e, link_id, user="ana", **more):
    return request(e, "POST", "/assistant/affect-lab/revoke",
                   user=user, data={"household_id": e["hid"], "link_id": link_id, **more})


def test_full_http_attest_ratify_private_readback_revoke(e):
    assert items(e).status_code == 200
    assert items(e).json()["items"] == []
    assert ratify(e).status_code == 404
    assert confirm(e).status_code == 200
    created = ratify(e)
    assert created.status_code == 200, created.text
    link = created.json()["id"]
    rows = items(e)
    assert rows.status_code == 200 and len(rows.json()["items"]) == 1
    assert rows.json()["items"][0]["status"] == "active"
    assert "Prefiero consultar" not in rows.text
    assert items(e, user="bruno").json()["items"] == []
    assert revoke(e, link, user="bruno").status_code == 404
    assert revoke(e, link).status_code == 200
    assert revoke(e, link).status_code == 404
    assert items(e).json()["items"][0]["status"] == "revoked"
    db = e["connect"]()
    try:
        out = e["bridge"].preview_from_confirmed_memory(
            db, household_id=e["hid"], user_id=e["people"]["ana"]["uid"],
            surface="PERSONAL_MOBILE", context_key="schedule",
            candidates=e["candidates"], use_affect=True,
        )
        assert out.selected_key == "routine"
    finally:
        db.close()


def test_real_sqlite_readback_across_connections(e):
    assert confirm(e).status_code == 200
    assert ratify(e).status_code == 200
    db = e["connect"]()
    try:
        out = e["bridge"].preview_from_confirmed_memory(
            db, household_id=e["hid"], user_id=e["people"]["ana"]["uid"],
            surface="PERSONAL_DESKTOP", context_key="schedule",
            candidates=e["candidates"], use_affect=True,
        )
        assert out.selected_key == "clarify"
        assert out.claim_wall["consciousness_demonstrated"] is False
    finally:
        db.close()


def test_confirm_cannot_use_other_person_or_untrusted_role(e):
    assert confirm(e, user="bruno").status_code == 404
    assert confirm(e, user="outsider").status_code == 403
    assert ratify(e, user="bruno").status_code == 404
    assert items(e, user="outsider").status_code == 403
    assert request(e, "POST", "/assistant/affect-lab/source/confirm",
                   data={"household_id": e["hid"], "memory_id": e["mid"],
                         "explicitly_confirmed": True,
                         "requester_role": "owner", "requester_user_id": e["people"]["bruno"]["uid"]}
                   ).status_code == 422
    assert not items(e).json()["items"]


def test_no_automatic_affect_consent(e):
    assert confirm(e).status_code == 200
    assert ratify(e, consent_for_affect=False).status_code == 404
    assert items(e).json()["items"] == []
    assert ratify(e, consent_for_affect="true").status_code == 422
    assert ratify(e, valence=2).status_code == 422
    assert ratify(e, context_key="../file").status_code == 422
    assert ratify(e, person_id=e["people"]["bruno"]["pid"]).status_code == 422


def test_no_duplicate_active_consent(e):
    assert confirm(e).status_code == 200
    assert ratify(e).status_code == 200
    assert ratify(e).status_code == 409
    assert len(items(e).json()["items"]) == 1


def test_no_cross_tenant_list_and_foreign_revoke(e):
    assert confirm(e).status_code == 200
    link = ratify(e).json()["id"]
    assert items(e, user="outsider").status_code == 403
    assert items(e, user="bruno", household_id="fake-foreign").status_code == 403
    assert revoke(e, link, user="outsider").status_code == 403
    assert len(items(e).json()["items"]) == 1


def test_minor_or_unclassified_rejected_for_every_operation(e):
    db = e["connect"]()
    try:
        db.execute("UPDATE persons SET age_band='unclassified' WHERE id=?",
                   (e["people"]["ana"]["pid"],))
        db.commit()
    finally:
        db.close()
    assert confirm(e).status_code == 403
    assert ratify(e).status_code == 403
    assert items(e).status_code == 403
    assert revoke(e, "any").status_code == 403


def test_lab_gate_off_and_production_fail_closed(e):
    e["monkeypatch"].setenv("DOMI_AFFECT_R106_HTTP_LAB_ENABLED", "0")
    assert items(e).status_code == 404
    assert confirm(e).status_code == 404
    assert ratify(e).status_code == 404
    e["monkeypatch"].setenv("DOMI_AFFECT_R106_HTTP_LAB_ENABLED", "1")
    e["monkeypatch"].setenv("APP_ENV", "production")
    assert items(e).status_code == 404
    assert ratify(e).status_code == 404


def test_revocation_and_source_correction_invalidate(e):
    assert confirm(e).status_code == 200
    link = ratify(e).json()["id"]
    change = request(e, "POST", "/assistant/memory/" + e["mid"] + "/correct",
                     data={"household_id": e["hid"],
                           "content": "Ya no tengo esta preferencia"})
    assert change.status_code == 200
    assert items(e).json()["items"][0]["status"] == "invalidated"
    assert revoke(e, link).status_code == 200
