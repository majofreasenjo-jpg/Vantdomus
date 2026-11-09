"""R94-F — Full synthetic family-pilot flow across *separate Python processes*.

Covers: first owner bootstrap (closed public registration), invited family
member, independent authenticated HTTP clients, shared vs owner-only memory,
session revocation, and memory + revocation persistence after a process restart.

Transport is TestClient/in-process HTTP; subprocesses make application lifespans
independent. This is NOT real LAN, TLS, mobile hardware or production acceptance.
No cloud DB, secrets, network listeners, third-party AI or real family data.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import pytest

REPO = Path(__file__).resolve().parents[1]
API = REPO / "apps" / "api"
OWNER_EMAIL = "r94f.owner@example.invalid"
MEMBER_EMAIL = "r94f.member@example.invalid"
PASSWORD = "R94F-Only-Fictional-Strong!2026"
API_URL = "http://127.0.0.1:8001"
SHARED_TEXT = "Recuerdo R94F: nuestra familia ficticia prefiere mapas"
OWNER_TEXT = "Contexto operativo ficticio R94F, reservado al titular"


def _synthetic_env(db_path: Path) -> dict[str, str]:
    """No copy of any private application secrets is needed in the test."""
    env = os.environ.copy()
    env.update({
        "VANTDOMUS_SKIP_LOCAL_ENV": "1",
        "APP_ENV": "family-pilot",
        "DB_PATH": str(db_path),
        "DATABASE_URL": "",
        "JWT_SECRET": "r94f-isolated-jwt-fixture-not-for-use-outside-ci-2026",
        "VANTDOMUS_MFA_SECRET_KEY": "r94f-isolated-mfa-fixture-not-for-use-outside-ci-2026",
        "VANTDOMUS_MFA_SECRET_KEYS": "",
        "VANTDOMUS_ALLOWED_HOSTS": "domi.lab.example.invalid",
        "VANTDOMUS_API_ALLOWED_HOSTS": "127.0.0.1",
        "VANTDOMUS_APP_PUBLIC_URL": "https://domi.lab.example.invalid",
        "CORS_ALLOWED_ORIGINS": "https://domi.lab.example.invalid",
        "VANTDOMUS_PUBLIC_REGISTRATION": "false",
        "VANTDOMUS_ALLOW_DEMO_SEED": "false",
        "VANTDOMUS_API_RATE_LIMIT_MODE": "memory",
        "VANTDOMUS_BACKEND_INSTANCES": "1",
        "VANTDOMUS_ENABLE_PUBLIC_UPLOADS": "false",
        "ASSISTANT_PROVIDER_MODE": "mock",
        "ASSISTANT_REAL_PROVIDER_ENABLED": "false",
        "ASSISTANT_SHADOW_MODE": "false",
        "ASSISTANT_EXTERNAL_CALLS_ALLOWED": "false",
        "VANTDOMUS_AI_FEATURES_ENABLED": "false",
        "OPENAI_API_KEY": "",
        "SMTP_HOST": "",
        "SMTP_USER": "",
        "SMTP_PASS": "",
        "SMTP_FROM": "",
        "PYTHONPATH": str(API),
    })
    return env


def _phase(phase: str, env: dict[str, str], args: dict | None = None) -> dict:
    """Pass tokens only over stdin and captured stdout, never argv/env/logs."""
    p = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), phase],
        input=json.dumps(args or {}),
        text=True, capture_output=True, env=env,
        cwd=str(REPO), timeout=100,
        check=False,
    )
    # No uncontrolled stderr or stdout included in test reports: child output
    # may include fixture bearer tokens and should not leak into CI logs.
    assert p.returncode == 0, f"R94F_{phase.upper()}_FAILED_EXIT_{p.returncode}"
    try:
        return json.loads(p.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        pytest.fail(f"R94F_{phase.upper()}_MISSING_RESULT")


def test_closed_family_bootstrap_to_invitation_memory_revocation_and_cold_restart():
    """Three actual Python lifetimes; one disposable synthetic SQLite database."""
    base = Path.home() / ".cache" / "vantdomus-r94f-isolated-tests"
    base.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="family-r94f-", dir=base) as scratch:
        db_path = Path(scratch) / "fictional-family.sqlite"
        env = _synthetic_env(db_path)
        boot = _phase("bootstrap", env)
        assert boot["bootstrap"] == "CREATED_ONLY_FIRST_OWNER"
        hid = boot["household_id"]
        flow = _phase("http-flow", env, {"household_id": hid})
        assert flow["flow"] == "FAMILY_PILOT_TWO_SESSIONS_AND_INVITATION_PASS"
        assert flow["household_id"] == hid
        assert flow["shared_id"] != flow["owner_id"]
        assert flow["revoked_owner_token"]
        readback = _phase("readback", env, flow)
        assert readback["flow"] == "FRESH_PROCESS_PERSISTENCE_AND_REVOCATION_PASS"
        # Even after the cold restart the owner bootstrap remains single-use.
        second_boot = _phase("bootstrap-again", env)
        assert second_boot["result"] == "R94C_DATABASE_NOT_EMPTY"
        # The context manager erases synthetic DB and token-free fixtures.


# The code below only runs inside isolated subprocesses. Do not import the app
# into the pytest collection process: other test suites reload config and DB.
def _login(client, email: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, f"R94F_LOGIN_FAILED_{response.status_code}"
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": "Bearer " + token}


def _memory_ids(client, token: str, household_id: str) -> dict[str, str]:
    response = client.get(
        "/assistant/memory", params={"household_id": household_id}, headers=_auth(token),
    )
    assert response.status_code == 200, f"R94F_MEMORY_READ_{response.status_code}"
    return {item["id"]: item["content"] for item in response.json()["items"]}


def _run_subprocess_phase(phase: str, arguments: dict) -> dict:
    sys.path.insert(0, str(API))
    if phase in ("bootstrap", "bootstrap-again"):
        from app.db import ensure_schema
        from scripts.bootstrap_first_owner_r94c import bootstrap_first_owner

        if phase == "bootstrap":
            ensure_schema()
            result = bootstrap_first_owner(OWNER_EMAIL, PASSWORD, "Hogar ficticio R94F")
            assert result["user_action"] == "creado"
            assert result["home_status"] == "hogar creado"
            return {"bootstrap": "CREATED_ONLY_FIRST_OWNER", "household_id": result["household_id"]}
        try:
            bootstrap_first_owner(OWNER_EMAIL, PASSWORD)
        except SystemExit as exc:
            return {"result": str(exc)}
        raise AssertionError("R94F_SECOND_OWNER_BOOTSTRAP_SHOULD_NOT_SUCCEED")

    from fastapi.testclient import TestClient
    from app.main import app

    if phase == "http-flow":
        hid = arguments["household_id"]
        with TestClient(app, base_url=API_URL) as desktop:
            phone_context = TestClient(app, base_url=API_URL)
            config = desktop.get("/auth/config")
            assert config.status_code == 200
            assert config.json() == {"public_registration": False}
            blocked = desktop.post(
                "/auth/register",
                json={"email": "r94f.unsolicited@example.invalid", "password": PASSWORD},
            )
            assert blocked.status_code == 403, "R94F_PUBLIC_REGISTER_BYPASS"

            desktop_token = _login(desktop, OWNER_EMAIL)
            independent_token = _login(phone_context, OWNER_EMAIL)
            assert desktop_token != independent_token
            assert desktop.get("/households", headers=_auth(desktop_token)).status_code == 200

            # Private onboarding: this invited account is a distinct identity.
            person = desktop.post(
                "/persons",
                params={"household_id": hid, "display_name": "Integrante completamente ficticio",
                        "relation": "Familiar"},
                headers=_auth(desktop_token),
            )
            assert person.status_code in (200, 201), f"R94F_PERSON_{person.status_code}"
            pid = person.json()["id"]
            classified = desktop.patch(
                f"/persons/{pid}/classification", json={"age_band": "adult"},
                headers=_auth(desktop_token),
            )
            assert classified.status_code == 200, f"R94F_CLASSIFY_{classified.status_code}"
            invitation = desktop.post(
                f"/households/{hid}/invitations",
                json={"email": MEMBER_EMAIL, "role": "member", "ttl_hours": 24, "person_id": pid},
                headers=_auth(desktop_token),
            )
            assert invitation.status_code == 200, f"R94F_INVITATION_{invitation.status_code}"
            invite_token = invitation.json()["token"]
            enrolled = phone_context.post(
                "/auth/register-with-invitation",
                json={"email": MEMBER_EMAIL, "password": PASSWORD, "token": invite_token},
            )
            assert enrolled.status_code == 200, f"R94F_INVITED_REGISTER_{enrolled.status_code}"
            assert enrolled.json()["household_id"] == hid
            assert enrolled.json()["role"] == "member"
            reused = phone_context.post(
                "/auth/register-with-invitation",
                json={"email": MEMBER_EMAIL, "password": PASSWORD, "token": invite_token},
            )
            assert reused.status_code in (400, 409), "R94F_INVITE_REPLAY"
            invite_token = None  # Never return or log the one-time secret.
            member_token = _login(phone_context, MEMBER_EMAIL)

            def create(text: str, scope: str, kind: str) -> str:
                response = desktop.post(
                    "/assistant/memory",
                    json={"household_id": hid, "memory_type": kind, "content": text,
                          "visibility_scope": scope},
                    headers=_auth(desktop_token),
                )
                assert response.status_code == 200, f"R94F_MEMORY_WRITE_{response.status_code}"
                return response.json()["id"]

            shared_id = create(SHARED_TEXT, "household_shared", "family_story")
            owner_id = create(OWNER_TEXT, "owner_operational", "operational_context")
            all_owner = _memory_ids(desktop, desktop_token, hid)
            member_memories = _memory_ids(phone_context, member_token, hid)
            assert all_owner.get(shared_id) == SHARED_TEXT
            assert all_owner.get(owner_id) == OWNER_TEXT
            assert member_memories.get(shared_id) == SHARED_TEXT
            assert owner_id not in member_memories, "R94F_OWNER_MEMORY_LEAK_TO_MEMBER"
            assert phone_context.get(
                "/assistant/memory", params={"household_id": hid},
            ).status_code == 401, "R94F_GUEST_MEMORY_LEAK"
            # An authorized member cannot edit the owner's operational memory.
            unauthorized_edit = phone_context.post(
                f"/assistant/memory/{owner_id}/correct",
                json={"household_id": hid, "content": "attempted unauthorized rewrite"},
                headers=_auth(member_token),
            )
            assert unauthorized_edit.status_code in (403, 404), "R94F_OWNER_MEMORY_EDIT_LEAK"

            listed = desktop.get("/auth/sessions", headers=_auth(desktop_token))
            assert listed.status_code == 200
            others = [
                item["id"] for item in listed.json()["items"]
                if not item["current"] and not item["revoked_at"]
            ]
            assert len(others) == 1, "R94F_EXPECTED_TWO_OWNER_SESSIONS"
            revoked = desktop.post(
                "/auth/sessions/revoke", json={"session_id": others[0]},
                headers=_auth(desktop_token),
            )
            assert revoked.status_code == 200
            assert desktop.get("/households", headers=_auth(desktop_token)).status_code == 200
            assert phone_context.get("/households", headers=_auth(independent_token)).status_code == 401
            assert _memory_ids(phone_context, member_token, hid).get(shared_id) == SHARED_TEXT
            return {
                "flow": "FAMILY_PILOT_TWO_SESSIONS_AND_INVITATION_PASS",
                "household_id": hid,
                "shared_id": shared_id,
                "owner_id": owner_id,
                "revoked_owner_token": independent_token,
            }

    if phase == "readback":
        hid = arguments["household_id"]
        with TestClient(app, base_url=API_URL) as fresh:
            denied = fresh.get("/households", headers=_auth(arguments["revoked_owner_token"]))
            assert denied.status_code == 401, "R94F_REVOKED_SESSION_RESURRECTED"
            owner_token = _login(fresh, OWNER_EMAIL)
            member_token = _login(fresh, MEMBER_EMAIL)
            owner_memories = _memory_ids(fresh, owner_token, hid)
            member_memories = _memory_ids(fresh, member_token, hid)
            assert owner_memories.get(arguments["shared_id"]) == SHARED_TEXT
            assert owner_memories.get(arguments["owner_id"]) == OWNER_TEXT
            assert member_memories.get(arguments["shared_id"]) == SHARED_TEXT
            assert arguments["owner_id"] not in member_memories
            return {"flow": "FRESH_PROCESS_PERSISTENCE_AND_REVOCATION_PASS"}

    raise AssertionError("R94F_UNKNOWN_SUBPROCESS_PHASE")


if __name__ == "__main__":
    # Parent sends ONLY synthetic fixture metadata / revoked synthetic token via
    # stdin, not argv (or a visible shell history). Result is captured by pytest.
    arguments = json.loads(sys.stdin.read() or "{}")
    answer = _run_subprocess_phase(sys.argv[1], arguments)
    print(json.dumps(answer))
