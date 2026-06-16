import argparse
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _run(name: str, command: list[str], cwd: Path) -> bool:
    print(f"\n== {name} ==")
    print(" ".join(command))
    completed = subprocess.run(command, cwd=str(cwd))
    if completed.returncode != 0:
        print(f"{name} failed with exit code {completed.returncode}")
        return False
    print(f"{name} passed")
    return True


def run_gate(*, skip_web_build: bool = False) -> int:
    pytest_basetemp = str(Path(tempfile.gettempdir()) / f"vantdomus-security-gate-pytest-{uuid.uuid4().hex}")
    checks = [
        (
            "security event metadata lint",
            [
                sys.executable,
                "apps/api/scripts/security_event_metadata_lint.py",
            ],
            ROOT,
        ),
        (
            "secret scan",
            [
                sys.executable,
                "tools/secret_scan.py",
            ],
            ROOT,
        ),
        (
            "web session security lint",
            [
                sys.executable,
                "tools/web_session_security_lint.py",
            ],
            ROOT,
        ),
        (
            "security tests",
            [
                sys.executable,
                "-m",
                "pytest",
                "tests/security/test_tenant_isolation.py",
                "-q",
                "--basetemp",
                pytest_basetemp,
                "-p",
                "no:cacheprovider",
            ],
            ROOT,
        ),
        (
            "web env preflight",
            [
                sys.executable,
                "tools/web_env_preflight.py",
                "--env-file",
                "apps/web/.env.local",
            ],
            ROOT,
        ),
    ]
    if not skip_web_build:
        checks.append(("web build", ["npm.cmd" if sys.platform.startswith("win") else "npm", "run", "build"], ROOT / "apps" / "web"))

    ok = True
    for name, command, cwd in checks:
        ok = _run(name, command, cwd) and ok
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the VantDomus local security release gate.")
    parser.add_argument("--skip-web-build", action="store_true", help="Run only backend security tests.")
    args = parser.parse_args()
    raise SystemExit(run_gate(skip_web_build=args.skip_web_build))


if __name__ == "__main__":
    main()
