"""R86 Windows local-pilot launcher static security acceptance (CI/Linux friendly)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START = ROOT / "tools/windows/Start-DOMI-R86-Local.ps1"
WEB = ROOT / "tools/windows/Run-DOMI-R86-Web.ps1"


def test_r86_launcher_is_local_and_synthetic_only():
    script = START.read_text(encoding="utf-8")
    assert '$env:DB_PATH = Join-Path $PilotDir "domi-r86-fictional.sqlite"' in script
    assert '$env:DATABASE_URL = ""' in script
    assert '$env:VANTDOMUS_ALLOW_DEMO_SEED = "false"' in script
    assert '$env:ASSISTANT_PROVIDER_MODE = "mock"' in script
    assert '$env:ASSISTANT_REAL_PROVIDER_ENABLED = "false"' in script
    assert '$env:ASSISTANT_EXTERNAL_CALLS_ALLOWED = "false"' in script
    assert '$env:OPENAI_API_KEY = ""' in script
    assert "Test-LoopbackPort" in script
    assert "127.0.0.1:8001/health" in script
    assert "127.0.0.1:3000/login" in script
    assert "Setup-LocalDev.ps1" in script
    assert "Start-Process" in script
    assert not any(x in script for x in ("--prod", "neonctl", "render deploy", "vercel deploy"))


def test_r86_web_listener_only_loopback():
    script = WEB.read_text(encoding="utf-8")
    assert "npm run dev -- --hostname 127.0.0.1 --port 3000" in script
    assert '$env:NEXT_PUBLIC_API_BASE = "http://127.0.0.1:8001"' in script
    assert "0.0.0.0" not in script
