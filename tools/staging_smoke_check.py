import argparse
import json
import urllib.error
import urllib.request
from urllib.parse import urljoin


def _check(name: str, ok: bool, status: str, **extra) -> dict:
    return {"name": name, "ok": ok, "status": status, **extra}


def _open(url: str, *, method: str = "GET", data: bytes | None = None, headers: dict | None = None, timeout: int = 15):
    request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    return urllib.request.urlopen(request, timeout=timeout)


def _http_check(name: str, url: str, expected_status: int = 200) -> dict:
    try:
        with _open(url) as response:
            return _check(name, response.status == expected_status, str(response.status), url=url)
    except urllib.error.HTTPError as exc:
        return _check(name, exc.code == expected_status, str(exc.code), url=url)
    except Exception as exc:
        return _check(name, False, "error", url=url, detail=str(exc))


def _json_health(api_url: str) -> dict:
    url = urljoin(api_url.rstrip("/") + "/", "health")
    try:
        with _open(url) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return _check("api_health", response.status == 200 and payload.get("ok") is True, "ok" if payload.get("ok") is True else "bad_payload", url=url)
    except Exception as exc:
        return _check("api_health", False, "error", url=url, detail=str(exc))


def _cache_check(name: str, url: str, *, allow_dev_cache: bool = False) -> dict:
    try:
        with _open(url) as response:
            cache_control = response.headers.get("cache-control", "")
            has_no_store = "no-store" in cache_control.lower()
            ok = has_no_store or (allow_dev_cache and "no-cache" in cache_control.lower())
            status = "ok" if has_no_store else "dev_no_cache" if ok else "missing_no_store"
            return _check(name, ok, status, url=url, cache_control=cache_control)
    except Exception as exc:
        return _check(name, False, "error", url=url, detail=str(exc))


def _protected_route_check(web_url: str, path: str, *, allow_demo: bool) -> dict:
    url = urljoin(web_url.rstrip("/") + "/", path.lstrip("/"))
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler)
    try:
        response = opener.open(url, timeout=15)
        final_url = response.geturl()
        redirected_to_login = "/login" in final_url
        ok = redirected_to_login or allow_demo
        return _check("protected_route_requires_session", ok, "redirected" if redirected_to_login else "allowed_demo" if allow_demo else "not_redirected", url=url, final_url=final_url)
    except Exception as exc:
        return _check("protected_route_requires_session", False, "error", url=url, detail=str(exc))


def _public_proxy_size_check(web_url: str) -> dict:
    url = urljoin(web_url.rstrip("/") + "/", "api/public/auth/password/reset/confirm")
    try:
        _open(
            url,
            method="POST",
            data=b"{}",
            headers={
                "Content-Type": "application/json",
                "Content-Length": "2000000",
            },
        )
        return _check("public_proxy_size_limit", False, "unexpected_success", url=url)
    except urllib.error.HTTPError as exc:
        return _check("public_proxy_size_limit", exc.code == 413, str(exc.code), url=url)
    except Exception as exc:
        return _check("public_proxy_size_limit", False, "error", url=url, detail=str(exc))


def run_smoke(*, web_url: str, api_url: str, household_id: str | None, allow_demo: bool, allow_dev_cache: bool) -> dict:
    checks = [
        _json_health(api_url),
        _http_check("web_login", urljoin(web_url.rstrip("/") + "/", "login")),
        _cache_check("web_login_no_store", urljoin(web_url.rstrip("/") + "/", "login"), allow_dev_cache=allow_dev_cache),
        _public_proxy_size_check(web_url),
    ]
    if household_id:
        dashboard_path = f"dashboard/{household_id}"
        checks.append(_protected_route_check(web_url, dashboard_path, allow_demo=allow_demo))
        checks.append(_cache_check("dashboard_no_store", urljoin(web_url.rstrip("/") + "/", dashboard_path), allow_dev_cache=allow_dev_cache))
    return {"ok": all(item["ok"] for item in checks), "checks": checks}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run staging/production smoke checks for VantDomus.")
    parser.add_argument("--web-url", required=True, help="Web panel base URL, for example https://app.example.com")
    parser.add_argument("--api-url", required=True, help="API base URL, for example https://api.example.com")
    parser.add_argument("--household-id", help="Optional tenant id used to test protected dashboard route.")
    parser.add_argument("--allow-demo", action="store_true", help="Allow protected routes to be reachable without redirect in local/demo mode.")
    parser.add_argument("--allow-dev-cache", action="store_true", help="Allow Next dev no-cache headers instead of production no-store headers.")
    args = parser.parse_args()
    result = run_smoke(web_url=args.web_url, api_url=args.api_url, household_id=args.household_id, allow_demo=args.allow_demo, allow_dev_cache=args.allow_dev_cache)
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
