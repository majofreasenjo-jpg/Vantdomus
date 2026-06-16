import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _check(name: str, ok: bool, status: str, **extra) -> dict:
    return {"name": name, "ok": ok, "status": status, **extra}


def run_lint() -> dict:
    login_actions = (ROOT / "apps" / "web" / "app" / "login" / "actions.ts").read_text(encoding="utf-8")
    proxy_route = (ROOT / "apps" / "web" / "app" / "api" / "proxy" / "[...path]" / "route.ts").read_text(encoding="utf-8")
    public_route = (ROOT / "apps" / "web" / "app" / "api" / "public" / "[...path]" / "route.ts").read_text(encoding="utf-8")
    api_client = (ROOT / "apps" / "web" / "lib" / "api.ts").read_text(encoding="utf-8")
    proxy_limits = (ROOT / "apps" / "web" / "lib" / "proxy-limits.ts").read_text(encoding="utf-8")
    next_config = (ROOT / "apps" / "web" / "next.config.js").read_text(encoding="utf-8")
    route_proxy = (ROOT / "apps" / "web" / "proxy.ts").read_text(encoding="utf-8")

    checks = [
        _check(
            "session_cookie_httponly",
            'store.set("vantdomus_access_token"' in login_actions and "httpOnly: true" in login_actions,
            "ok" if 'store.set("vantdomus_access_token"' in login_actions and "httpOnly: true" in login_actions else "missing",
        ),
        _check(
            "csrf_cookie_issued",
            "CSRF_COOKIE" in login_actions and "httpOnly: false" in login_actions,
            "ok" if "CSRF_COOKIE" in login_actions and "httpOnly: false" in login_actions else "missing",
        ),
        _check(
            "logout_revokes_backend_session",
            "/auth/logout" in login_actions and "vantdomus_access_token" in login_actions and "store.delete(CSRF_COOKIE)" in login_actions,
            "ok" if "/auth/logout" in login_actions and "vantdomus_access_token" in login_actions and "store.delete(CSRF_COOKIE)" in login_actions else "missing",
        ),
        _check(
            "authenticated_proxy_csrf",
            "validateCsrf" in proxy_route and "CSRF_HEADER" in proxy_route and "Invalid request origin" in proxy_route,
            "ok" if "validateCsrf" in proxy_route and "CSRF_HEADER" in proxy_route and "Invalid request origin" in proxy_route else "missing",
        ),
        _check(
            "client_sends_csrf_header",
            "browserCsrfToken()" in api_client and "CSRF_HEADER" in api_client,
            "ok" if "browserCsrfToken()" in api_client and "CSRF_HEADER" in api_client else "missing",
        ),
        _check(
            "public_proxy_allowlist",
            "ALLOWED_PUBLIC_PATHS" in public_route and "Invalid request origin" in public_route,
            "ok" if "ALLOWED_PUBLIC_PATHS" in public_route and "Invalid request origin" in public_route else "missing",
        ),
        _check(
            "browser_connect_self_only",
            '"connect-src \'self\'"' in next_config,
            "ok" if '"connect-src \'self\'"' in next_config else "missing",
        ),
        _check(
            "protected_routes_require_session",
            "PROTECTED_PREFIXES" in route_proxy and '"/login"' in route_proxy and "vantdomus_session_id" in route_proxy and "allowLocalDemoFallback" in route_proxy,
            "ok" if "PROTECTED_PREFIXES" in route_proxy and '"/login"' in route_proxy and "vantdomus_session_id" in route_proxy and "allowLocalDemoFallback" in route_proxy else "missing",
        ),
        _check(
            "route_proxy_sets_no_store",
            "withNoStore" in route_proxy and '"Cache-Control", "no-store, max-age=0"' in route_proxy and '"/login"' in route_proxy,
            "ok" if "withNoStore" in route_proxy and '"Cache-Control", "no-store, max-age=0"' in route_proxy and '"/login"' in route_proxy else "missing",
        ),
        _check(
            "sensitive_routes_no_store",
            "noStoreHeaders" in next_config and "'Cache-Control', value: 'no-store, max-age=0'" in next_config and "source: '/api/:path*'" in next_config and "source: '/dashboard/:path*'" in next_config,
            "ok" if "noStoreHeaders" in next_config and "'Cache-Control', value: 'no-store, max-age=0'" in next_config and "source: '/api/:path*'" in next_config and "source: '/dashboard/:path*'" in next_config else "missing",
        ),
        _check(
            "proxy_responses_no_store",
            '"Cache-Control", "no-store, max-age=0"' in proxy_route and '"Cache-Control", "no-store, max-age=0"' in public_route,
            "ok" if '"Cache-Control", "no-store, max-age=0"' in proxy_route and '"Cache-Control", "no-store, max-age=0"' in public_route else "missing",
        ),
        _check(
            "proxy_request_size_limits",
            "AUTHENTICATED_PROXY_MAX_BODY_BYTES" in proxy_limits and "PUBLIC_PROXY_MAX_BODY_BYTES" in proxy_limits and "requestBodyTooLarge" in proxy_route and "requestBodyTooLarge" in public_route and "413" in proxy_route and "413" in public_route,
            "ok" if "AUTHENTICATED_PROXY_MAX_BODY_BYTES" in proxy_limits and "PUBLIC_PROXY_MAX_BODY_BYTES" in proxy_limits and "requestBodyTooLarge" in proxy_route and "requestBodyTooLarge" in public_route and "413" in proxy_route and "413" in public_route else "missing",
        ),
    ]
    return {"ok": all(item["ok"] for item in checks), "checks": checks}


def main() -> None:
    result = run_lint()
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
