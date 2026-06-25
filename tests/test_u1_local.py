"""
U1-LOCAL — Tests de Avisos del Hogar, Compras del Hogar, Actividades del Día
y seed v2 ("Familia Demo VantDomus"). Cubre creación/listado/scoping y 403
cruzado entre hogares.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "U1-Local-Strong-2026!"


@pytest.fixture
def client(monkeypatch, tmp_path) -> TestClient:
    db_path = tmp_path / "u1-local-tests.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "u1-local-tests-secret-32-chars-xxxx")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "u1-local-tests-mfa-key-32-chars-xxx")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.delenv("VANTDOMUS_MIN_PASSWORD_LENGTH", raising=False)

    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    with TestClient(main.app) as test_client:
        yield test_client


def _login(client, email):
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def _hh(client, token, name="Hogar Demo"):
    r = client.post("/households", params={"name": name}, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _person(client, token, hid, name="Ana"):
    r = client.post(
        "/persons",
        params={"household_id": hid, "display_name": name, "relation": "integrante"},
        headers=_auth(token),
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# ---------- Family Board ----------

def test_family_board_create_and_list(client):
    t = _login(client, "fb1@example.com")
    hid = _hh(client, t)
    r = client.post(
        f"/family_board/{hid}",
        json={"title": "Aviso uno", "body": "cuerpo", "post_type": "notice", "priority": "high", "pinned": True},
        headers=_auth(t),
    )
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["title"] == "Aviso uno" and p["pinned"] is True and p["priority"] == "high"
    lst = client.get(f"/family_board/{hid}", headers=_auth(t)).json()["items"]
    assert any(it["id"] == p["id"] for it in lst)


def test_family_board_403_cross_household(client):
    owner = _login(client, "fbA@example.com")
    other = _login(client, "fbB@example.com")
    hid_a = _hh(client, owner)
    r = client.get(f"/family_board/{hid_a}", headers=_auth(other))
    assert r.status_code == 403


def test_family_board_resolve_and_archive(client):
    t = _login(client, "fb2@example.com")
    hid = _hh(client, t)
    p = client.post(
        f"/family_board/{hid}", json={"title": "X"}, headers=_auth(t),
    ).json()
    r = client.post(f"/family_board/{hid}/{p['id']}/resolve", headers=_auth(t))
    assert r.status_code == 200
    r = client.post(f"/family_board/{hid}/{p['id']}/archive", headers=_auth(t))
    assert r.status_code == 200
    lst = client.get(f"/family_board/{hid}", headers=_auth(t)).json()["items"]
    assert all(it["id"] != p["id"] for it in lst)  # archivados ocultos por defecto


# ---------- Household Shopping ----------

def test_shopping_create_and_transitions(client):
    t = _login(client, "sh1@example.com")
    hid = _hh(client, t)
    r = client.post(
        f"/household_shopping/{hid}/items",
        json={"item_name": "Leche", "category": "grocery", "store_type": "supermarket", "estimated_price": 1500},
        headers=_auth(t),
    )
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["status"] == "needed"
    # mark-in-cart
    r = client.post(f"/household_shopping/{hid}/items/{item['id']}/mark-in-cart", headers=_auth(t))
    assert r.status_code == 200 and r.json()["status"] == "in_cart"
    # cart endpoint
    cart = client.get(f"/household_shopping/{hid}/cart", headers=_auth(t)).json()
    assert cart["groups"][0]["store_type"] == "supermarket"
    assert "disclaimer" in cart  # no checkout real
    # mark-purchased
    r = client.post(f"/household_shopping/{hid}/items/{item['id']}/mark-purchased", headers=_auth(t))
    assert r.status_code == 200 and r.json()["status"] == "purchased"


def test_shopping_403_cross_household(client):
    owner = _login(client, "shA@example.com")
    other = _login(client, "shB@example.com")
    hid_a = _hh(client, owner)
    r = client.get(f"/household_shopping/{hid_a}/items", headers=_auth(other))
    assert r.status_code == 403


def test_shopping_invalid_category_rejected(client):
    t = _login(client, "sh2@example.com")
    hid = _hh(client, t)
    r = client.post(
        f"/household_shopping/{hid}/items",
        json={"item_name": "X", "category": "weapons"},
        headers=_auth(t),
    )
    assert r.status_code == 400


# ---------- Daily Activities ----------

def test_daily_activity_create_complete(client):
    t = _login(client, "da1@example.com")
    hid = _hh(client, t)
    pid = _person(client, t, hid, name="Camila")
    r = client.post(
        f"/daily_activities/{hid}",
        json={"person_id": pid, "title": "Reunión", "activity_type": "work", "starts_at": "2026-07-01T10:00:00+00:00"},
        headers=_auth(t),
    )
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["status"] == "planned"
    lst = client.get(f"/daily_activities/{hid}", headers=_auth(t)).json()["items"]
    assert any(x["id"] == a["id"] for x in lst)
    r = client.post(f"/daily_activities/{hid}/{a['id']}/complete", headers=_auth(t))
    assert r.status_code == 200 and r.json()["status"] == "done"


def test_daily_activity_person_must_be_in_household(client):
    owner = _login(client, "daA@example.com")
    other_owner = _login(client, "daB@example.com")
    hid_a = _hh(client, owner)
    hid_b = _hh(client, other_owner)
    pid_b = _person(client, other_owner, hid_b, "X")
    # owner_A intenta crear actividad para persona de hogar_B en su propio hogar
    r = client.post(
        f"/daily_activities/{hid_a}",
        json={"person_id": pid_b, "title": "Spy"},
        headers=_auth(owner),
    )
    assert r.status_code == 400


def test_daily_activity_403_cross_household(client):
    owner = _login(client, "daC@example.com")
    other = _login(client, "daD@example.com")
    hid = _hh(client, owner)
    r = client.get(f"/daily_activities/{hid}", headers=_auth(other))
    assert r.status_code == 403


# ---------- Seed v2 ----------

def test_seed_home_v2_curates_family(client):
    t = _login(client, "sv2@example.com")
    hid = _hh(client, t, name="Familia Demo VantDomus")
    r = client.post(f"/demo/seed?mode=home_v2&household_id={hid}", headers=_auth(t))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "home_v2"
    names = sorted(p["name"] for p in body["persons"])
    assert names == sorted(["Camila", "Pedro", "Diego", "Sofía", "Elena"])
    assert body["seeded"]["board_posts"] >= 5
    assert body["seeded"]["shopping_items"] >= 6
    assert body["seeded"]["daily_activities"] >= 8


def test_seed_home_v2_idempotent(client):
    t = _login(client, "sv2idem@example.com")
    hid = _hh(client, t, name="Familia Demo VantDomus")
    client.post(f"/demo/seed?mode=home_v2&household_id={hid}", headers=_auth(t))
    # segunda corrida no duplica personas ni avisos
    r2 = client.post(f"/demo/seed?mode=home_v2&household_id={hid}", headers=_auth(t))
    assert r2.status_code == 200
    assert r2.json().get("already_seeded") is True
    items = client.get(f"/family_board/{hid}", headers=_auth(t)).json()["items"]
    # No se duplicó al segundo seed
    assert 1 <= len(items) <= 12
