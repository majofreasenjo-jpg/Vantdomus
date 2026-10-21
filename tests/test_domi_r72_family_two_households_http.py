"""R72: two independent authenticated sessions and two synthetic households.
Disposable SQLite only; no outside network, family PII, Neon or production.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "R72SyntheticOnly2026!"

@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "r72-synthetic.db"))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "r72-synthetic-jwt-not-production-32-x")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "r72-synthetic-mfa-not-production-32-x")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "false")
    monkeypatch.delenv("ASSISTANT_PROVIDER", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    main = importlib.import_module("app.main")
    with TestClient(main.app) as test_client:
        yield test_client

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def new_user(client, name):
    email = f"r72-{name}@example.invalid"
    register = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert register.status_code == 200, register.text
    login = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.text
    return login.json()["access_token"]

def new_home(client, token, name):
    r=client.post("/households",params={"name":name},headers=auth(token))
    assert r.status_code==200,r.text
    return r.json()["id"]

def items(client,token,hid):
    return client.get(f"/household_shopping/{hid}/items",headers=auth(token))

def test_two_sessions_create_confirm_reload_cancel_and_isolate(client):
    alice=new_user(client,"alice")
    bob=new_user(client,"bob")
    home_a=new_home(client,alice,"Hogar A synthetic")
    home_b=new_home(client,bob,"Hogar B synthetic")
    assert items(client,alice,home_a).json()["items"]==[]
    assert items(client,bob,home_b).json()["items"]==[]

    proposal=client.post("/assistant/chat",json={
        "household_id":home_a,"messages":[{"role":"user","content":"agrega leche y pan a la lista"}]
    },headers=auth(alice))
    assert proposal.status_code==200,proposal.text
    pending=proposal.json()["proposals"][0]
    assert pending["status"]=="pending"
    assert items(client,alice,home_a).json()["items"]==[]

    confirm=client.post(f"/assistant/proposals/{pending['id']}/confirm",
                        json={"overrides":{}},headers=auth(alice))
    assert confirm.status_code==200,confirm.text
    assert confirm.json()["proposal"]["status"]=="executed"
    added=items(client,alice,home_a).json()["items"]
    assert {i["item_name"] for i in added}=={"leche","pan"}

    # New client instance + same token: HTTP fresh-read simulates reload/device.
    with TestClient(client.app) as other_device:
        fresh=items(other_device,alice,home_a)
        assert fresh.status_code==200,fresh.text
        assert {i["item_name"] for i in fresh.json()["items"]}=={"leche","pan"}
        forbidden=items(other_device,bob,home_a)
        assert forbidden.status_code==403,forbidden.text
        assert items(other_device,bob,home_b).json()["items"]==[]
        denied=other_device.post(
            f"/household_shopping/{home_a}/items/{added[0]['id']}/cancel",
            headers=auth(bob))
        assert denied.status_code==403,denied.text

    cancel=client.post(
        f"/household_shopping/{home_a}/items/{added[0]['id']}/cancel",
        headers=auth(alice))
    assert cancel.status_code==200,cancel.text
    statuses={i["id"]:i["status"] for i in items(client,alice,home_a).json()["items"]}
    assert statuses[added[0]["id"]]=="cancelled"
    assert statuses[added[1]["id"]]=="needed"
    summary=client.get(f"/household_shopping/{home_a}/summary",headers=auth(alice))
    assert summary.status_code==200,summary.text
    assert summary.json()["por_comprar"]==1
    assert summary.json()["cancelled"]==1
    # Reconfirm never duplicates earlier two items.
    again=client.post(f"/assistant/proposals/{pending['id']}/confirm",json={},
                      headers=auth(alice))
    assert again.status_code==200 and again.json()["already_executed"] is True
    assert len(items(client,alice,home_a).json()["items"])==2
