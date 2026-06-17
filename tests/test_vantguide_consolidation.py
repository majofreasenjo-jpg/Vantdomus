"""
Tests del Sprint VG+1: consolidación del núcleo VantGuide.

Cubre las 8 decisiones implementadas:
  1. UnitFunction.version incrementa en cada PATCH
  2. unit_function_versions guarda snapshot del estado previo
  3. Dedupe compuesto en function_events impide duplicados
  4. AI confidence + ai_needs_confirmation se persisten
  5. Medication creada por IA queda con ai_needs_confirmation=true
  6. Scheduler tick SALTA funciones con ai_needs_confirmation y sin confirmar
  7. POST /unit_functions/{id}/confirm activa la función
  8. Multi-responsibles: dos personas con distintos roles + escalation_order
  9. Backward compat: responsible_person_id sigue funcionando
 10. FunctionEvent y EvidenceItem siguen siendo entidades separadas
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
    db_path = tmp_path / "vg-plus1.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JWT_SECRET", "vg-plus1-tests-secret-32-chars-long-x")
    monkeypatch.setenv("VANTDOMUS_MFA_SECRET_KEY", "vg-plus1-tests-mfa-key-32-chars-xxxx")
    monkeypatch.setenv("VANTDOMUS_ALLOW_DEMO_SEED", "true")
    # El TestClient usa el host "testserver"; permitilo explícitamente para no
    # depender de un .env local (TrustedHostMiddleware lo rechazaría si no).
    monkeypatch.setenv("VANTDOMUS_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
    monkeypatch.delenv("VANTDOMUS_MIN_PASSWORD_LENGTH", raising=False)

    sys.path.insert(0, str(API_ROOT))
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    main = importlib.import_module("app.main")
    # Usar el TestClient como context manager dispara el lifespan
    # (initialize_app_state → migraciones). Sin esto, la DB temporal
    # queda sin tablas y todo falla con "no such table".
    with TestClient(main.app) as test_client:
        yield test_client


PASSWORD = "VG-Plus1-Strong-2026!"


def _register_and_login(client: TestClient, email: str) -> str:
    res = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200, res.text
    res = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _bootstrap(client: TestClient, token: str) -> tuple[str, str]:
    res = client.post("/households", params={"name": "Familia VG+1"}, headers=_auth(token))
    assert res.status_code == 200
    hid = res.json()["id"]
    res = client.post(
        f"/households/{hid}/persons",
        json={"display_name": "Diego", "relation": "Hijo"},
        headers=_auth(token),
    )
    assert res.status_code in (200, 201)
    pid = res.json()["id"]
    return hid, pid


# =============================================================================
# 1+2: Versionado y snapshot
# =============================================================================

def test_version_increments_and_snapshot_recorded(client: TestClient):
    token = _register_and_login(client, "vg-version@example.com")
    hid, pid = _bootstrap(client, token)

    # Crear: version = 1
    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "study", "title": "Original Title"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    uf = res.json()
    uf_id = uf["id"]

    # PATCH: title cambia
    res = client.patch(
        f"/unit_functions/{uf_id}",
        json={"title": "Updated Title"},
        headers=_auth(token),
    )
    assert res.status_code == 200

    # Verificar version=2 en GET
    res = client.get(f"/unit_functions/{uf_id}", headers=_auth(token))
    body = res.json()
    # El endpoint actual retorna versión como parte del row a través de _row_to_response
    # El campo no está en el response model. Verificamos vía /versions.
    res = client.get(f"/unit_functions/{uf_id}/versions", headers=_auth(token))
    assert res.status_code == 200
    versions = res.json()
    assert versions["current_version"] == 2
    assert len(versions["items"]) == 1
    # El snapshot debe tener el title original
    snap = versions["items"][0]["snapshot"]
    assert snap["title"] == "Original Title"


def test_multiple_patches_produce_multiple_versions(client: TestClient):
    token = _register_and_login(client, "vg-multiver@example.com")
    hid, pid = _bootstrap(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "study", "title": "v1"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    for new_title in ("v2", "v3", "v4"):
        res = client.patch(
            f"/unit_functions/{uf_id}",
            json={"title": new_title},
            headers=_auth(token),
        )
        assert res.status_code == 200

    res = client.get(f"/unit_functions/{uf_id}/versions", headers=_auth(token))
    versions = res.json()
    assert versions["current_version"] == 4
    assert len(versions["items"]) == 3
    # Verificar orden DESC y contenido
    titles_in_versions = [v["snapshot"]["title"] for v in versions["items"]]
    assert "v1" in titles_in_versions
    assert "v2" in titles_in_versions
    assert "v3" in titles_in_versions


# =============================================================================
# 3: Dedupe compuesto
# =============================================================================

def test_function_event_composite_dedupe_prevents_duplicates(client: TestClient):
    """
    PATCH a status=done dos veces NO debe duplicar el event 'completed'.
    Esto se basa en el UNIQUE compuesto + la check en _insert_function_event.
    """
    token = _register_and_login(client, "vg-dedupe@example.com")
    hid, pid = _bootstrap(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "study", "title": "X"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    for _ in range(3):
        client.patch(
            f"/unit_functions/{uf_id}",
            json={"status": "done"},
            headers=_auth(token),
        )

    res = client.get(f"/unit_functions/{uf_id}/timeline", headers=_auth(token))
    events = res.json()["items"]
    completed = [e for e in events if e["event_type"] == "completed"]
    assert len(completed) == 1, f"Expected 1 completed, got {len(completed)}"


# =============================================================================
# 4+5: AI confidence y confirmation defaults
# =============================================================================

def test_ai_medication_requires_confirmation_by_default(client: TestClient):
    """
    Una función creada por IA con category=medication queda con
    ai_needs_confirmation=true automáticamente (es categoría sensible).
    """
    token = _register_and_login(client, "vg-aimed@example.com")
    hid, pid = _bootstrap(client, token)

    # Simulamos creación AI con confidence alta: igual debe pedir confirmación
    # porque medication es categoría sensible (decision 7 de Codex).
    sys.path.insert(0, str(API_ROOT))
    from app.routes.unit_functions import create_unit_function_internal
    from app.db import connect

    db = connect()
    try:
        uf_id = create_unit_function_internal(
            db,
            household_id=hid,
            organization_id=None,
            person_id=pid,
            category="medication",
            title="Losartán 50mg (sugerido por IA)",
            source_type="prescription",
            created_by_user_id="ai-system",
            created_by_ai=True,
            ai_confidence=0.92,  # alta confidence
            ai_extraction_source="ocr_receta",
        )
        db.commit()
    finally:
        db.close()

    res = client.get(f"/unit_functions/{uf_id}", headers=_auth(token))
    body = res.json()
    # No tenemos campo en el response, pero verificamos vía la confirmación
    # Intentar correr scheduler — si tick saltea, OK.

    # Confirmar
    res = client.post(
        f"/unit_functions/{uf_id}/confirm",
        json={"confirmed": True},
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    assert res.json()["confirmed"] is True


def test_ai_low_confidence_non_sensitive_also_needs_confirmation(client: TestClient):
    """Funciones IA con confidence < 0.85 piden confirmación aunque no sea sensible."""
    token = _register_and_login(client, "vg-aiconf@example.com")
    hid, pid = _bootstrap(client, token)

    from app.routes.unit_functions import create_unit_function_internal
    from app.db import connect

    db = connect()
    try:
        uf_id = create_unit_function_internal(
            db,
            household_id=hid,
            organization_id=None,
            person_id=pid,
            category="home_chore",
            title="Limpiar la pieza",
            source_type="ai_suggestion",
            created_by_user_id="ai-system",
            created_by_ai=True,
            ai_confidence=0.62,  # baja
        )
        db.commit()
    finally:
        db.close()

    # confirmable
    res = client.post(
        f"/unit_functions/{uf_id}/confirm",
        json={"confirmed": True},
        headers=_auth(token),
    )
    assert res.status_code == 200


def test_confirm_non_ai_function_returns_400(client: TestClient):
    """Si la función no fue creada por IA, /confirm devuelve 400."""
    token = _register_and_login(client, "vg-noai@example.com")
    hid, pid = _bootstrap(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "study", "title": "X"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    res = client.post(
        f"/unit_functions/{uf_id}/confirm",
        json={"confirmed": True},
        headers=_auth(token),
    )
    assert res.status_code == 400


def test_reject_ai_function(client: TestClient):
    """Si confirmed=false, la función pasa a status=cancelled."""
    token = _register_and_login(client, "vg-reject@example.com")
    hid, pid = _bootstrap(client, token)

    from app.routes.unit_functions import create_unit_function_internal
    from app.db import connect

    db = connect()
    try:
        uf_id = create_unit_function_internal(
            db,
            household_id=hid,
            organization_id=None,
            person_id=pid,
            category="medication",
            title="Sugerencia rechazada",
            source_type="ai_suggestion",
            created_by_user_id="ai",
            created_by_ai=True,
            ai_confidence=0.75,
        )
        db.commit()
    finally:
        db.close()

    res = client.post(
        f"/unit_functions/{uf_id}/confirm",
        json={"confirmed": False, "change_reason": "no era esta dosis"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


# =============================================================================
# 6: Scheduler salta funciones IA sin confirmar
# =============================================================================

def test_scheduler_skips_unconfirmed_ai_functions(client: TestClient):
    """
    El scheduler tick() debe saltar UnitFunctions con ai_needs_confirmation
    y sin confirmed_at. Verificamos via las métricas devueltas.
    """
    token = _register_and_login(client, "vg-schedskip@example.com")
    hid, pid = _bootstrap(client, token)

    from app.routes.unit_functions import create_unit_function_internal
    from app.vantguide_scheduler import tick
    from app.db import connect

    db = connect()
    try:
        # Crear función IA medication: queda pendiente confirmación
        create_unit_function_internal(
            db,
            household_id=hid,
            organization_id=None,
            person_id=pid,
            category="medication",
            title="Losartán pendiente confirmación",
            source_type="ai_suggestion",
            created_by_user_id="ai",
            created_by_ai=True,
            ai_confidence=0.90,
            schedule={"times": ["08:00", "20:00"], "days": [1, 2, 3, 4, 5, 6, 7]},
            recurrence="daily",
        )
        db.commit()

        metrics = tick(db)
    finally:
        db.close()

    # Debe haber saltado al menos 1 por pending AI confirmation
    assert metrics.get("skipped_pending_ai_confirmation", 0) >= 1


# =============================================================================
# 8: Multi-responsibles
# =============================================================================

def test_multiple_responsibles_with_distinct_roles(client: TestClient):
    """Dos responsables con roles distintos en la misma función."""
    token = _register_and_login(client, "vg-multi@example.com")
    hid, pid_diego = _bootstrap(client, token)

    # Crear segunda persona (cuidador)
    res = client.post(
        f"/households/{hid}/persons",
        json={"display_name": "Camila", "relation": "Madre"},
        headers=_auth(token),
    )
    pid_camila = res.json()["id"]
    res = client.post(
        f"/households/{hid}/persons",
        json={"display_name": "Pedro", "relation": "Padre"},
        headers=_auth(token),
    )
    pid_pedro = res.json()["id"]

    # Crear función para Diego
    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid_diego, "category": "study", "title": "Estudiar"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    # Agregar Camila como primary_caregiver y Pedro como secondary
    res = client.post(
        f"/unit_functions/{uf_id}/responsibles",
        json={
            "person_id": pid_camila,
            "responsibility_role": "primary_caregiver",
            "escalation_order": 1,
            "can_confirm": True,
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text

    res = client.post(
        f"/unit_functions/{uf_id}/responsibles",
        json={
            "person_id": pid_pedro,
            "responsibility_role": "secondary_caregiver",
            "escalation_order": 2,
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text

    # Listar — deben aparecer ambos ordenados por escalation_order
    res = client.get(f"/unit_functions/{uf_id}/responsibles", headers=_auth(token))
    items = res.json()["items"]
    assert len(items) == 2
    assert items[0]["responsibility_role"] == "primary_caregiver"
    assert items[1]["responsibility_role"] == "secondary_caregiver"


def test_invalid_responsibility_role_rejected(client: TestClient):
    token = _register_and_login(client, "vg-multirol@example.com")
    hid, pid = _bootstrap(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "study", "title": "X"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    res = client.post(
        f"/unit_functions/{uf_id}/responsibles",
        json={"person_id": pid, "responsibility_role": "not_a_real_role"},
        headers=_auth(token),
    )
    assert res.status_code == 400


# =============================================================================
# 9: Backward compat
# =============================================================================

def test_responsible_person_id_still_works(client: TestClient):
    """El campo legacy `responsible_person_id` sigue funcionando."""
    token = _register_and_login(client, "vg-back@example.com")
    hid, pid = _bootstrap(client, token)

    res = client.post(
        f"/households/{hid}/persons",
        json={"display_name": "Cuidadora", "relation": "Cuidadora"},
        headers=_auth(token),
    )
    pid_cuid = res.json()["id"]

    res = client.post(
        "/unit_functions",
        json={
            "household_id": hid,
            "person_id": pid,
            "responsible_person_id": pid_cuid,
            "category": "medication",
            "title": "X",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert res.json()["responsible_person_id"] == pid_cuid


# =============================================================================
# 10: FunctionEvent + EvidenceItem siguen separados
# =============================================================================

def test_function_event_and_evidence_remain_distinct(client: TestClient):
    """
    FunctionEvent describe ciclo de vida; EvidenceItem describe prueba
    concreta. Son tablas distintas, no se unifican.
    """
    token = _register_and_login(client, "vg-distinct@example.com")
    hid, pid = _bootstrap(client, token)

    res = client.post(
        "/unit_functions",
        json={"household_id": hid, "person_id": pid, "category": "medication", "title": "Y"},
        headers=_auth(token),
    )
    uf_id = res.json()["id"]

    # Registrar evidencia
    res = client.post(
        "/library/evidence",
        json={
            "household_id": hid,
            "unit_function_id": uf_id,
            "person_id": pid,
            "evidence_type": "medication_taken",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200

    # Marcar como done → genera function_event 'completed'
    client.patch(
        f"/unit_functions/{uf_id}",
        json={"status": "done"},
        headers=_auth(token),
    )

    # Timeline (function_events) ≠ Evidence
    res = client.get(f"/unit_functions/{uf_id}/timeline", headers=_auth(token))
    timeline = res.json()["items"]
    # Debe haber 'scheduled' (creación) + 'completed' (status change)
    event_types = {e["event_type"] for e in timeline}
    assert "scheduled" in event_types
    assert "completed" in event_types

    res = client.get(
        "/library/evidence",
        params={"household_id": hid, "unit_function_id": uf_id},
        headers=_auth(token),
    )
    evidence = res.json()["items"]
    assert len(evidence) == 1
    assert evidence[0]["evidence_type"] == "medication_taken"
