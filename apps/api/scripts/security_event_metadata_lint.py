import re
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = API_ROOT / "app"

FORBIDDEN_METADATA_KEYS = {
    "email",
    "token",
    "auth_token",
    "token_hash",
    "password",
    "secret",
    "file_path",
    "attachment_path",
}


def _event_blocks(text: str) -> list[tuple[int, str]]:
    blocks = []
    start = 0
    while True:
        index = text.find("write_security_event(", start)
        if index == -1:
            return blocks
        depth = 0
        end = index
        for pos in range(index, len(text)):
            char = text[pos]
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    end = pos + 1
                    break
        line_number = text[:index].count("\n") + 1
        blocks.append((line_number, text[index:end]))
        start = end


def lint_security_event_metadata() -> list[dict]:
    findings = []
    key_pattern = re.compile(r"""["']([^"']+)["']\s*:""")
    for path in SOURCE_ROOT.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for line_number, block in _event_blocks(text):
            metadata_index = block.find("metadata=")
            if metadata_index == -1:
                continue
            metadata_block = block[metadata_index:]
            for key in key_pattern.findall(metadata_block):
                if key.lower() in FORBIDDEN_METADATA_KEYS:
                    findings.append(
                        {
                            "file": str(path.relative_to(API_ROOT)),
                            "line": line_number,
                            "key": key,
                        }
                    )
    return findings


def main() -> int:
    findings = lint_security_event_metadata()
    if findings:
        print("Forbidden raw metadata keys in write_security_event:")
        for finding in findings:
            print(f"- {finding['file']}:{finding['line']} metadata key {finding['key']!r}")
        return 1
    print("security_event_metadata_lint passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
