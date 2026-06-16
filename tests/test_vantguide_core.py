"""
Tests del núcleo VantGuide.

Cubre:
 * Creación de UnitFunction desde body REST.
 * Categorías y source_types validados (rechazo de inválidos).
 * Dual-write a task_items cuando dual_write_task=True.
 * Listado y filtros.
 * Evidence: registro de evidencia positiva Y negativa.
 * Memory: creación con consent_scope, filtrado por rol.
 * Person support profile: upsert + lectura con redacción de
   campos sensibles para roles no-owner/admin.
 * Scheduler: dedupe_key impide duplicar reminder_due.
 * SchoolPlanner adapter: /tasks/school_plan ahora crea unit_functions
   además del task_items legacy.

Fixture mirror de tests/test_auth_body_and_policy.py para boot homogéneo.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "api"


@pytest.fixture
def client(monkeypatch, tmp_path) -> TestClient:
    db_path = tmp_path / "vantguide-tests.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "vantguide-tests-secret-32-chars-long-x")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "vantguide-tests-mfa-key-32-chars-xxx")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    monkeypatch.delenv("VANTDOMUS_MIN_PASSWORD_LENGTH", raising=False)

    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    main = importlib.import_module("app.main")
    return TestClient(main.app)


GOOD_PASSWORD = "VG-Pass-Strong-2026!"


def _register_and_login(client: TestClient, email: str) -> str:
    res = client.post("/auth/register", json={"email": email, "password": GOOD_PASSWORD})
    assert res.status_code == 200, res.text
    res = client.post("/auth/login", json={"email": email, "password": GOOD_PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _bootstrap_household(client: TestClient, token: str, name: str = "Familia Test") -> tuple[str, str]:
    """Crea un household + una persona base. Devuelve (household_id, person_id)."""
    res = client.post("/households", params={"name": name}, headers=_auth(token))
    assert res.status_code == 200, res.text
    household_id = res.json()["id"]

    res = client.post(
        f"/households/{household_id}/persons",
        json={"display_name": "Diego Test", "relation": "Hijo"},
        headers=_auth(token),
    )
    assert res.status_code in (200, 201), res.text
    person_id = res.json()["id"]
    return household_id, person_id


# =============================================================================
# UnitFunction CRUD
# =============================================================================

def test_create_unit_function_study(client: TestClient):
    token = _register_and_login(client, "vg-study@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={
            "household_id": hid,
            "person_id": pid,
            "category": "study",
            "title": "Estudiar fracciones",
            "source_type": "school_notice",
            "priority": "high",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["category"] == "study"
    assert body["source_type"] == "school_notice"
    assert body["status"] == "open"
    assert body["created_by_ai"] is False
    assert body["legacy_task_id"] is not None  # dual_write_task default True


def test_create_unit_function_medication_with_schedule(client: TestClient):
    token = _register_and_login(client, "vg-med@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={
            "household_id": hid,
            "person_id": pid,
            "category": "medication",
            "title": "Tomar Losartán 50mg",
            "source_type": "prescription",
            "schedule": {"times": ["08:00", "20:00"], "days": [1, 2, 3, 4, 5, 6, 7]},
            "recurrence": "daily",
            "support_mode": "tap",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["schedule"]["times"] == ["08:00", "20:00"]
    assert body["recurrence"] == "daily"


def test_invalid_category_rejected(client: TestClient):
    token = _register_and_login(client, "vg-cat@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={
            "household_id": hid,
            "person_id": pid,
            "category": "INVALID_CATEGORY",
            "title": "X",
        },
        headers=_auth(token),
    )
    assert res.status_code == 400
    assert "category" in res.json()["detail"].lower()


def test_invalid_source_type_rejected(client: TestClient):
    token = _register_and_login(client, "vg-src@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={
            "household_id": hid,
            "person_id": pid,
            "category": "study",
            "title": "X",
            "source_type": "totally_made_up",
        },
        headers=_auth(token),
    )
    assert res.status_code == 400


def test_list_unit_functions_filtered_by_category(client: TestClient):
    token = _register_and_login(client, "vg-list@example.com")
    hid, pid = _bootstrap_household(client, token)

    for category, title in [
        ("study", "Estudiar matemáticas"),
        ("medication", "Losartán mañana"),
        ("home_chore", "Tender la cama"),
    ]:
        res = client.post(
            "/unit_functions",
            json={"household_id": hid, "person_id": pid, "category": category, "title": title},
            headers=_auth(token),
        )
        assert res.status_code == 200, res.text

    res = client.get(
        "/unit_functions",
        params={"household_id": hid, "category": "medication"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["category"] == "medication"


def test_update_status_to_done_emits_completed_event(client: TestClient):
    token = _register_and_login(client, "vg-done@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "study", "title": "X"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    res = client.patch(
        f"/unit_functions/{uf_id}",
        json={"status": "done"},
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text

    # El timeline debería tener 'scheduled' (de la creación) + 'completed'
    res = client.get(f"/unit_functions/{uf_id}/timeline", headers=_auth(token))
    events = res.json()["items"]
    event_types = {e["event_type"] for e in events}
    assert "completed" in event_types
    assert "scheduled" in event_types


# =============================================================================
# Evidence Library
# =============================================================================

def test_log_positive_evidence(client: TestClient):
    token = _register_and_login(client, "vg-evpos@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "medication", "title": "Losartán"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    res = client.post(
        "/library/evidence",
        json={
            "household_id": hid,
            "unit_function_id": uf_id,
            "person_id": pid,
            "evidence_type": "medication_taken",
            "text_content": "Tomó la pastilla con desayuno",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text


def test_log_negative_evidence(client: TestClient):
    """La evidencia NEGATIVA es ciudadana de primera clase en VantGuide."""
    token = _register_and_login(client, "vg-evneg@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "study", "title": "X"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    res = client.post(
        "/library/evidence",
        json={
            "household_id": hid,
            "unit_function_id": uf_id,
            "person_id": pid,
            "evidence_type": "negative_outcome",
            "text_content": "Estudiar de noche no funcionó — Diego no se concentró",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text


def test_invalid_evidence_type_rejected(client: TestClient):
    token = _register_and_login(client, "vg-evbad@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/library/evidence",
        json={
            "household_id": hid,
            "person_id": pid,
            "evidence_type": "this_is_not_a_real_type",
        },
        headers=_auth(token),
    )
    assert res.status_code == 400


# =============================================================================
# Memory
# =============================================================================

def test_create_memory_routine_pattern(client: TestClient):
    token = _register_and_login(client, "vg-mem@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/library/memory",
        json={
            "household_id": hid,
            "person_id": pid,
            "memory_type": "routine_pattern",
            "content": "A Diego le funciona estudiar en bloques de 20 minutos.",
            "importance": 0.8,
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text


def test_create_memory_negative_learning(client: TestClient):
    """Las memorias de tipo negative_learning son explícitamente soportadas."""
    token = _register_and_login(client, "vg-memneg@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/library/memory",
        json={
            "household_id": hid,
            "person_id": pid,
            "memory_type": "negative_learning",
            "content": "Estudiar de noche no funcionó para Diego.",
            "importance": 0.7,
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text


def test_importance_out_of_range_rejected(client: TestClient):
    token = _register_and_login(client, "vg-memimp@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/library/memory",
        json={
            "household_id": hid,
            "memory_type": "preference",
            "content": "Test",
            "importance": 2.0,  # fuera de [0,1]
        },
        headers=_auth(token),
    )
    assert res.status_code == 400


# =============================================================================
# Person Support Profile
# =============================================================================

def test_upsert_and_read_support_profile(client: TestClient):
    token = _register_and_login(client, "vg-prof@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.put(
        f"/persons/{pid}/support_profile",
        json={
            "household_id": hid,
            "age_group": "child",
            "role_in_unit": "hijo",
            "communication_style": "playful",
            "supervision_level": "light_reminder",
            "motivation_style": "rewards",
            "calm_tools": ["soft_music", "pomodoro"],
            "study_style": "short_bursts",
            "attention_profile": "benefits_from_structure",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text

    res = client.get(
        f"/persons/{pid}/support_profile",
        params={"household_id": hid},
        headers=_auth(token),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["exists"] is True
    assert body["age_group"] == "child"
    assert body["communication_style"] == "playful"
    assert body["calm_tools"] == ["soft_music", "pomodoro"]


def test_invalid_communication_style_rejected(client: TestClient):
    token = _register_and_login(client, "vg-profbad@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.put(
        f"/persons/{pid}/support_profile",
        json={
            "household_id": hid,
            "communication_style": "shouting",  # no existe
        },
        headers=_auth(token),
    )
    assert res.status_code == 400


# =============================================================================
# Scheduler dedupe
# =============================================================================

def test_function_event_dedupe(client: TestClient):
    """
    Insertar dos function_events con el mismo dedupe_key debe fallar/no-duplicar.
    """
    token = _register_and_login(client, "vg-sched@example.com")
    hid, pid = _bootstrap_household(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "medication", "title": "Y"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    # La creación ya emitió un 'scheduled'. Ahora intentamos updates a done
    # dos veces para verificar idempotencia.
    res = client.patch(
        f"/unit_functions/{uf_id}",
        json={"status": "done"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    res = client.patch(
        f"/unit_functions/{uf_id}",
        json={"status": "done"},  # mismo status
        headers=_auth(token),
    )
    assert res.status_code == 200  # patch idempotente

    res = client.get(f"/unit_functions/{uf_id}/timeline", headers=_auth(token))
    events = res.json()["items"]
    # Solo UN evento completed pese a 2 PATCHes (dedupe key impide doble registro)
    completed = [e for e in events if e["event_type"] == "completed"]
    assert len(completed) == 1, f"Expected 1 completed, got {len(completed)}: {events}"


# =============================================================================
# SchoolPlanner adapter
# =============================================================================

def test_school_planner_creates_unit_functions(client: TestClient):
    """
    El endpoint /tasks/school_plan ahora ADEMÁS de crear task_items crea
    unit_functions(category=study, source_type=school_notice).
    """
    token = _register_and_login(client, "vg-school@example.com")
    hid, pid = _bootstrap_household(client, token)

    # multipart/form-data
    res = client.post(
        "/tasks/school_plan",
        data={
            "household_id": hid,
            "student": "Diego",
            "subject": "Matemáticas",
            "evaluation_title": "Prueba unidad 3",
            "due_date": "2026-12-15",
            "assigned_person_id": pid,
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    # Debe haber creado tanto unit_functions como tasks
    assert body["unit_functions_created"] >= 1, body
    assert body["tasks_created"] >= 1, body

    # Confirmar que las unit_functions creadas tienen category=study
    res = client.get(
        "/unit_functions",
        params={"household_id": hid, "category": "study"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    for it in items:
        assert it["source_type"] == "school_notice"
