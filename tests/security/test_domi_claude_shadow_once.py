"""R57 command-line dry-run and one-shot safety. Network always mocked."""
import importlib.util
from datetime import date
from pathlib import Path
import pytest

@pytest.fixture(autouse=True)
def isolated_r57_test_environment(monkeypatch):
    # Prior tests may leave APP_ENV=production; the fixture must own its env.
    # Production rejection remains separately verified below.
    monkeypatch.setenv("APP_ENV", "local")

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("domi_shadow_once", ROOT/"tools/domi_claude_shadow_once.py")
cli=importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)


def test_default_no_key_no_network(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY",raising=False)
    assert cli.run()["status"]=="DRY_RUN"
    assert cli.run()["external_call_attempted"] is False


def test_expired_promo_blocks(tmp_path):
    assert cli.run(execute=True,confirmation=cli._CONFIRM,key="dummy",
                   today=date(2026,11,14),marker_path=tmp_path/"once")["status"]=="BLOCKED"
    assert not (tmp_path/"once").exists()


def test_without_confirmation_blocks_before_marker(tmp_path):
    p=tmp_path/"once"
    r=cli.run(execute=True,confirmation="wrong",key="dummy",marker_path=p)
    assert r["gate"]=="explicit_credit_confirmation_required"
    assert not p.exists()


def test_synthetic_one_shot_and_restore_env(monkeypatch,tmp_path):
    from app.assistant import anthropic_shadow_bridge as bridge
    calls=[]
    def fake(request):
        calls.append(request)
        assert request.synthetic is True
        assert request.documents_excerpt==""
        return {"status":"COMPLETE","provider":"anthropic-shadow","schema_valid":True,
                "external_call_attempted":True,"actions_executed":0,
                "proposals_persisted":0,"personal_data_transmitted":False,
                "input_tokens":55,"output_tokens":20}
    monkeypatch.setattr(bridge,"compare_synthetic_claude",fake)
    monkeypatch.delenv("ANTHROPIC_API_KEY",raising=False)
    monkeypatch.setenv("APP_ENV","local")
    marker=tmp_path/"once"
    first=cli.run(execute=True,confirmation=cli._CONFIRM,key="fake-secret",
                  today=date(2026,10,16),marker_path=marker)
    assert first["status"]=="COMPLETE"
    assert first["actions_executed"]==0
    assert len(calls)==1
    assert "fake-secret" not in str(first)
    assert "fake-secret" not in marker.read_text()
    import os
    assert "ANTHROPIC_API_KEY" not in os.environ
    second=cli.run(execute=True,confirmation=cli._CONFIRM,key="fake-secret",
                   today=date(2026,10,16),marker_path=marker)
    assert second["gate"]=="local_one_shot_already_reserved"
    assert len(calls)==1


def test_non_local_environment_rejected(monkeypatch,tmp_path):
    monkeypatch.setenv("APP_ENV","production")
    x=cli.run(execute=True,confirmation=cli._CONFIRM,key="dummy",
              today=date(2026,10,16),marker_path=tmp_path/"once")
    assert x["gate"]=="local_environment_only"
