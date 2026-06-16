import argparse
import json
import os
import re
from pathlib import Path


SENSITIVE_PUBLIC_KEYS = {
    "NEXT_PUBLIC_ACCESS_TOKEN": "Static bearer tokens must never be bundled into the browser.",
    "NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID": "Customer or tenant identifiers must be resolved after login, not shipped as a public default.",
}


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def _merged_env(env_file: Path | None = None, overrides: dict[str, str] | None = None) -> dict[str, str]:
    merged = dict(os.environ)
    if env_file:
        merged.update(_parse_env_file(env_file))
    if overrides:
        merged.update(overrides)
    return merged


def _deploy_env(env: dict[str, str]) -> str:
    return (
        env.get("VANTDOMUS_DEPLOY_ENV")
        or env.get("APP_ENV")
        or "local"
    ).strip().lower()


def _check(name: str, ok: bool, status: str, **extra) -> dict:
    return {"name": name, "ok": ok, "status": status, **extra}


def _api_base_check(env: dict[str, str], production_like: bool) -> dict:
    api_base = env.get("NEXT_PUBLIC_API_BASE", "").strip()
    if not production_like:
        return _check("next_public_api_base", True, "development", value=api_base or "default-local")
    if not api_base:
        return _check("next_public_api_base", False, "missing")
    if not api_base.startswith("https://"):
        return _check("next_public_api_base", False, "not_https", value=api_base)
    if re.search(r"(^https://)?(localhost|127\.0\.0\.1)(:|/|$)", api_base, re.IGNORECASE):
        return _check("next_public_api_base", False, "local_origin", value=api_base)
    return _check("next_public_api_base", True, "ok", value=api_base)


def _public_secret_checks(env: dict[str, str], production_like: bool) -> list[dict]:
    checks: list[dict] = []
    for key, detail in SENSITIVE_PUBLIC_KEYS.items():
        value = env.get(key, "").strip()
        if production_like and value:
            checks.append(_check(key.lower(), False, "public_value_forbidden", detail=detail))
        else:
            checks.append(_check(key.lower(), True, "empty" if not value else "development_only"))
    return checks


def run_preflight(*, env_file: Path | None = None, overrides: dict[str, str] | None = None) -> dict:
    env = _merged_env(env_file, overrides)
    deploy_env = _deploy_env(env)
    production_like = deploy_env in {"production", "prod", "staging"}
    checks = [_api_base_check(env, production_like), *_public_secret_checks(env, production_like)]
    return {"ok": all(item["ok"] for item in checks), "deploy_env": deploy_env, "checks": checks}


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate frontend environment safety before deployment.")
    parser.add_argument("--env-file", help="Optional .env file to merge over the current environment.")
    args = parser.parse_args()
    result = run_preflight(env_file=Path(args.env_file) if args.env_file else None)
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
