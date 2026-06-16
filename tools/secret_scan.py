import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SELF = Path(__file__).resolve()

SKIP_DIRS = {
    ".git",
    ".next",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "uploads",
    "private_uploads",
    "backups",
    "data",
}

TEXT_EXTENSIONS = {
    "",
    ".bat",
    ".css",
    ".env",
    ".example",
    ".html",
    ".js",
    ".json",
    ".md",
    ".ps1",
    ".py",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yml",
    ".yaml",
}

SECRET_ASSIGNMENT_KEYS = (
    "JWT_SECRET",
    "SMTP_PASS",
    "VANTDOMUS_BACKUP_ENCRYPTION_KEY",
    "VANTDOMUS_MFA_SECRET_KEY",
    "VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET",
    "NEXT_PUBLIC_ACCESS_TOKEN",
)

PLACEHOLDER_MARKERS = (
    "CHANGE_ME",
    "PASTE_",
    "example",
    "demo",
    "local",
    "test",
    "tenant-isolation",
)

PATTERNS = [
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{36,}\b")),
    ("slack_token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("jwt_token", re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b")),
]


def _is_skipped(path: Path) -> bool:
    return any(part in SKIP_DIRS or part.startswith("pytest-cache-files-") for part in path.parts)


def _is_env_like_filename(path: Path) -> bool:
    """
    Detect dotenv-style files regardless of extension.

    Matches: .env, .env.local, .env.production.local, .env.development,
             foo.env.local, etc. Files like these typically hold local
             secrets, but their `.suffix` is `.local` / `.development` /
             etc., so the extension allow-list misses them.
    """
    name = path.name.lower()
    if name == ".env" or name.startswith(".env."):
        return True
    if ".env." in name or name.endswith(".env"):
        return True
    return False


def _is_text_candidate(path: Path) -> bool:
    if path.stat().st_size > 1_000_000:
        return False
    if _is_env_like_filename(path):
        return True
    return path.suffix.lower() in TEXT_EXTENSIONS


def _looks_like_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(marker.lower() in lowered for marker in PLACEHOLDER_MARKERS)


def _scan_text(path: Path, text: str) -> list[dict]:
    findings: list[dict] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        for name, pattern in PATTERNS:
            if pattern.search(line):
                findings.append({"rule": name, "file": str(path), "line": line_number})
        for key in SECRET_ASSIGNMENT_KEYS:
            match = re.search(rf"^\s*{re.escape(key)}\s*=\s*(.+?)\s*$", line)
            if not match:
                continue
            value = match.group(1).strip().strip('"').strip("'")
            if value and not _looks_like_placeholder(value):
                findings.append({"rule": "secret_assignment", "key": key, "file": str(path), "line": line_number})
    return findings


def run_scan(*, roots: list[Path] | None = None) -> dict:
    scan_roots = roots or [ROOT / ".github", ROOT / "apps", ROOT / "docs", ROOT / "tests", ROOT / "tools", ROOT / "README.md", ROOT / ".gitignore"]
    findings: list[dict] = []
    scanned_files = 0
    for root in scan_roots:
        if not root.exists():
            continue
        paths = [root] if root.is_file() else [path for path in root.rglob("*") if path.is_file()]
        for path in paths:
            resolved = path.resolve()
            if resolved == SELF or _is_skipped(path.relative_to(ROOT) if path.is_relative_to(ROOT) else path):
                continue
            if not _is_text_candidate(path):
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            scanned_files += 1
            findings.extend(_scan_text(path, text))
    return {"ok": not findings, "scanned_files": scanned_files, "findings": findings}


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan source files for accidentally committed secrets.")
    parser.add_argument("roots", nargs="*", help="Optional files or directories to scan.")
    args = parser.parse_args()
    roots = [Path(item) for item in args.roots] if args.roots else None
    result = run_scan(roots=roots)
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
