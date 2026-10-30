"""R85: end-to-end synthetic family across a COLD application restart.

Runs only on disposable per-test SQLite inside tmp_path. Never accesses
Render, Neon, production, external AI, actual owner/family data or live devices.
The acceptance receipt here is HTTP+SQLite local, NOT production acceptance.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"
PASSWORD = "R85-Fictional-Only-Password2026!"


def _app():
    if str(API_ROOT) not in sys.path:
        sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]
    return importlib.import_module("app.main").app


@pytest.fixture()
def state_path(monkeypatch, tmp_path):
    path = tmp_path / "r85_disposable_only.sqlite"
    monkeypatch.setenv("DB_PATH", str(path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "r85-fictitious-jwt-secret-32-characters")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "r85-fictitious-mfa-secret-32-characters")
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "false")
    monkeypatch.setenv("VANTDOMUS_PUBLIC_REGISTRATION", "true")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ASSISTANT_PROVIDER", raising=False)
    monkeypatch.delenv("DOMI_RLS_TEST_DSN", raising=False)
    monkeypatch.delenv("DOMI_ENABLE_OWNER_PG_MEMORY", raising=False)
    yield path
    # pytest tmp_path owns cleanup. No user or cloud data is touched.


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def register(client, handle):
    email = f"r85-{handle}@example.invalid"
    response = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return login(client, handle)


def login(client, handle):
    response = client.post(
        "/auth/login",
        json={"email": f"r85-{handle}@example.invalid", "password": PASSWORD},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def household(client, token, name):
    response = client.post(
        "/households", params={"name": name}, headers=headers(token)
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def get(client, token, path):
    return client.get(path, headers=headers(token))


def test_reboot_relogin_readback_memory_calendar_actions_and_tenant_isolation(state_path):
    """Two independent app lifespans with SAME database file; new auth session.

    This is stronger than R72's extra TestClient on the same running app,
    but still does not prove physical PC/mobile or live PostgreSQL.
    """
    with TestClient(_app()) as first:
        alice = register(first, "alice")
        bob = register(first, "bob")
        home_a = household(first, alice, "Synthetic Home A")
        home_b = household(first, bob, "Synthetic Home B")

        person = first.post(
            "/persons",
            params={
                "household_id": home_a,
                "display_name": "Fictional Sam",
                "relation": "fictional_member",
            },
            headers=headers(alice),
        )
        assert person.status_code in (200, 201), person.text
        person_id = person.json()["id"]

        memory = first.post(
            "/assistant/memory",
            json={
                "household_id": home_a,
                "memory_type": "preference",
                "content": "Sam ficticio prefiere sopa de verduras",
                "person_id": None,
                "visibility_scope": "household_shared",
            },
            headers=headers(alice),
        )
        assert memory.status_code == 200, memory.text
        memory_id = memory.json()["id"]

        activity = first.post(
            f"/daily_activities/{home_a}",
            json={
                "person_id": person_id,
                "title": "Prueba de historia ficticia",
                "activity_type": "school",
                "starts_at": "2026-11-15T10:00:00+00:00",
                "visibility": "family",
            },
            headers=headers(alice),
        )
        assert activity.status_code == 200, activity.text
        activity_id = activity.json()["id"]

        proposal = first.post(
            "/assistant/chat",
            json={
                "household_id": home_a,
                "messages": [{"role": "user", "content": "agrega leche y pan a la lista"}],
            },
            headers=headers(alice),
        )
        assert proposal.status_code == 200, proposal.text
        pending = proposal.json()["proposals"][0]
        assert pending["status"] == "pending"
        before = get(first, alice, f"/household_shopping/{home_a}/items")
        assert before.status_code == 200
        assert before.json()["items"] == []

        confirm = first.post(
            f"/assistant/proposals/{pending['id']}/confirm",
            json={"overrides": {}},
            headers=headers(alice),
        )
        assert confirm.status_code == 200, confirm.text
        assert confirm.json()["proposal"]["status"] == "executed"
        shopping_ids = {x["id"] for x in get(first, alice, f"/household_shopping/{home_a}/items").json()["items"]}
        assert len(shopping_ids) == 2

        # Unauthorized user must not see or mutate another household's data.
        for path in (
            f"/assistant/memory?household_id={home_a}",
            f"/daily_activities/{home_a}",
            f"/household_shopping/{home_a}/items",
        ):
            denied = get(first, bob, path)
            assert denied.status_code == 403, (path, denied.status_code, denied.text)
        denied_write = first.post(
            "/assistant/memory",
            json={
                "household_id": home_a,
                "memory_type": "preference",
                "content": "Intento ficticio de escritura cruzada",
                "visibility_scope": "household_shared",
            },
            headers=headers(bob),
        )
        assert denied_write.status_code == 403, denied_write.text

        memory_before = get(first, alice, f"/assistant/memory?household_id={home_a}").json()["items"]
        assert any(row["id"] == memory_id for row in memory_before)

    # Independent app import and lifespan; database file persists. A NEW token
    # and new HTTP session must read back exactly the saved state.
    assert state_path.exists() and state_path.stat().st_size > 0
    with TestClient(_app()) as second:
        alice_new = login(second, "alice")
        bob_new = login(second, "bob")

        homes = get(second, alice_new, "/households")
        assert homes.status_code == 200
        assert home_a in {x["id"] for x in homes.json()["items"]}
        assert home_b not in {x["id"] for x in homes.json()["items"]}

        memories = get(second, alice_new, f"/assistant/memory?household_id={home_a}")
        assert memories.status_code == 200, memories.text
        assert any(x["id"] == memory_id and "sopa de verduras" in x["content"] for x in memories.json()["items"])

        activities = get(second, alice_new, f"/daily_activities/{home_a}")
        assert activities.status_code == 200, activities.text
        assert any(x["id"] == activity_id for x in activities.json()["items"])

        bought = get(second, alice_new, f"/household_shopping/{home_a}/items")
        assert bought.status_code == 200, bought.text
        assert {x["id"] for x in bought.json()["items"]} == shopping_ids
        assert {x["item_name"] for x in bought.json()["items"]} == {"leche", "pan"}

        repeat = second.post(
            f"/assistant/proposals/{pending['id']}/confirm",
            json={},
            headers=headers(alice_new),
        )
        assert repeat.status_code == 200 and repeat.json().get("already_executed") is True
        assert len(get(second, alice_new, f"/household_shopping/{home_a}/items").json()["items"]) == 2

        for path in (
            f"/assistant/memory?household_id={home_a}",
            f"/daily_activities/{home_a}",
            f"/household_shopping/{home_a}/items",
        ):
            forbidden = get(second, bob_new, path)
            assert forbidden.status_code == 403, (path, forbidden.status_code, forbidden.text)
        assert get(second, bob_new, f"/household_shopping/{home_b}/items").json()["items"] == []
