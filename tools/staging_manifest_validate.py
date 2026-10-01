#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SHA40_RE = re.compile(r"^[0-9a-f]{40}$", re.I)
SHA256_RE = re.compile(r"^sha256:[0-9a-f]{64}$", re.I)

FORBIDDEN_LITERAL_MARKERS = (
    "sk-proj-",
    "BEGIN PRIVATE KEY",
    "postgresql://CHANGE_ME",
    "redis://CHANGE_ME",
    "CHANGE_ME_32_PLUS",
)

REQUIRED_RESOURCE_IDS = {
    "web_runtime","api_runtime","database","redis","clamav","smtp",
    "signed_alert_receiver","backup_primary","backup_offsite","secret_manager",
    "operator_ownership",
}

REQUIRED_API_KEYS = {
    "APP_ENV","DATABASE_URL","JWT_SECRET","VANTDOMUS_MFA_SECRET_KEY",
    "VANTDOMUS_ALLOWED_HOSTS","CORS_ALLOWED_ORIGINS","VANTDOMUS_APP_PUBLIC_URL",
    "VANTDOMUS_API_RATE_LIMIT_MODE","VANTDOMUS_REDIS_URL",
    "VANTDOMUS_MALWARE_SCAN_MODE","VANTDOMUS_CLAMAV_HOST","VANTDOMUS_CLAMAV_PORT",
    "SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","SMTP_FROM",
    "VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL","VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET",
    "VANTDOMUS_BACKUP_ENCRYPTION_KEY","VANTDOMUS_ENABLE_PUBLIC_UPLOADS",
    "VANTDOMUS_ALLOW_DEMO_SEED","VANTDOMUS_ALLOW_NOTIFICATION_TESTS",
}

REQUIRED_WEB_KEYS = {
    "VANTDOMUS_DEPLOY_ENV","APP_ENV","NEXT_PUBLIC_API_BASE",
    "VANTDOMUS_WEB_PROXY_MAX_BODY_BYTES",
    "VANTDOMUS_WEB_PUBLIC_PROXY_MAX_BODY_BYTES",
    "NEXT_PUBLIC_ACCESS_TOKEN","NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID",
}

def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))

def validate_manifest(doc: dict) -> list[str]:
    failures: list[str] = []
    if doc.get("version") != "DOMI_P5_STAGING_CONFIGURATION_MANIFEST_V0_1":
        failures.append("MANIFEST_VERSION_MISMATCH")
    if doc.get("environment") != "staging":
        failures.append("ENVIRONMENT_NOT_STAGING")
    if doc.get("dataClass") != "SYNTHETIC_ONLY":
        failures.append("SYNTHETIC_ONLY_REQUIRED")

    resources = doc.get("resources")
    if not isinstance(resources, list):
        failures.append("RESOURCES_ARRAY_REQUIRED")
        resources = []
    ids = {item.get("id") for item in resources if isinstance(item, dict)}
    missing_resources = sorted(REQUIRED_RESOURCE_IDS - ids)
    if missing_resources:
        failures.append("MISSING_RESOURCES:" + ",".join(missing_resources))

    api = doc.get("apiEnvironment")
    web = doc.get("webEnvironment")
    if not isinstance(api, list):
        failures.append("API_ENV_ARRAY_REQUIRED")
        api = []
    if not isinstance(web, list):
        failures.append("WEB_ENV_ARRAY_REQUIRED")
        web = []
    api_keys = {item.get("key") for item in api if isinstance(item, dict)}
    web_keys = {item.get("key") for item in web if isinstance(item, dict)}
    if REQUIRED_API_KEYS - api_keys:
        failures.append("MISSING_API_KEYS:" + ",".join(sorted(REQUIRED_API_KEYS - api_keys)))
    if REQUIRED_WEB_KEYS - web_keys:
        failures.append("MISSING_WEB_KEYS:" + ",".join(sorted(REQUIRED_WEB_KEYS - web_keys)))

    for item in api + web:
        if not isinstance(item, dict):
            failures.append("ENV_ITEM_OBJECT_REQUIRED")
            continue
        if item.get("classification") == "SECRET" and item.get("receiptPolicy") != "PRESENCE_AND_HASH_ONLY":
            failures.append(f"SECRET_RECEIPT_POLICY_INVALID:{item.get('key')}")
        if item.get("classification") == "FORBIDDEN_PUBLIC" and item.get("expected") != "ABSENT_OR_EMPTY":
            failures.append(f"FORBIDDEN_PUBLIC_EXPECTATION_INVALID:{item.get('key')}")

    boundary = doc.get("executionBoundary") or {}
    for key in (
        "provisioningAuthorized","stagingDeploymentAuthorized",
        "productionMutationAuthorized","realOwnerMemoryAuthorized",
        "externalUsersAuthorized",
    ):
        if boundary.get(key) is not False:
            failures.append(f"BOUNDARY_MUST_BE_FALSE:{key}")

    serialized = json.dumps(doc)
    for marker in FORBIDDEN_LITERAL_MARKERS:
        if marker in serialized:
            failures.append("FORBIDDEN_SECRET_LIKE_LITERAL")
            break
    return failures

def validate_receipt_schema(doc: dict) -> list[str]:
    failures: list[str] = []
    if doc.get("schema") != "DOMI_P5_STAGING_REDACTED_RECEIPT_V0_1":
        failures.append("RECEIPT_SCHEMA_MISMATCH")
    flags = doc.get("privacyFlagsRequired") or {}
    required_flags = (
        "rawSecretsIncluded","credentialsIncluded","sessionTokensIncluded",
        "realOwnerMemoryIncluded","rawTranscriptIncluded","fullStateIncluded",
        "authorityIncluded",
    )
    for flag in required_flags:
        if flags.get(flag) is not False:
            failures.append(f"PRIVACY_FLAG_MUST_BE_FALSE:{flag}")
    decisions = set(doc.get("decisionEnum") or [])
    if decisions != {"HOLD_STAGING_CONFIGURATION","STAGING_CONFIGURATION_EVIDENCE_COMPLETE"}:
        failures.append("DECISION_ENUM_INVALID")
    return failures

def validate_receipt(receipt: dict, manifest: dict) -> list[str]:
    failures: list[str] = []
    if receipt.get("environment") != "staging":
        failures.append("RECEIPT_ENVIRONMENT_NOT_STAGING")
    if not SHA40_RE.fullmatch(str(receipt.get("candidateCommit",""))):
        failures.append("RECEIPT_CANDIDATE_SHA_INVALID")
    if not SHA256_RE.fullmatch(str(receipt.get("configDigest",""))):
        failures.append("RECEIPT_CONFIG_DIGEST_INVALID")

    allowed_resources = {r["id"] for r in manifest.get("resources",[]) if isinstance(r,dict) and "id" in r}
    for item in receipt.get("resourceStatuses",[]):
        if item.get("resourceId") not in allowed_resources:
            failures.append("RECEIPT_UNKNOWN_RESOURCE")
        if any(k in item for k in ("url","credential","secret","token","password")):
            failures.append("RECEIPT_RESOURCE_SECRET_FIELD_FORBIDDEN")

    env_map = {}
    for item in manifest.get("apiEnvironment",[]) + manifest.get("webEnvironment",[]):
        if isinstance(item,dict):
            env_map[item.get("key")] = item
    for check in receipt.get("environmentChecks",[]):
        key = check.get("key")
        spec = env_map.get(key)
        if not spec:
            failures.append("RECEIPT_UNKNOWN_ENV_KEY")
            continue
        if spec.get("classification") in {"SECRET","FORBIDDEN_PUBLIC"} and "value" in check:
            failures.append(f"RECEIPT_RAW_VALUE_FORBIDDEN:{key}")
        if spec.get("classification") == "SECRET" and check.get("present") is True:
            value_hash = check.get("valueHash")
            if value_hash and not SHA256_RE.fullmatch(str(value_hash)):
                failures.append(f"RECEIPT_SECRET_HASH_INVALID:{key}")

    flags = receipt.get("privacyFlags") or {}
    for flag in (
        "rawSecretsIncluded","credentialsIncluded","sessionTokensIncluded",
        "realOwnerMemoryIncluded","rawTranscriptIncluded","fullStateIncluded",
        "authorityIncluded",
    ):
        if flags.get(flag) is not False:
            failures.append(f"RECEIPT_PRIVACY_FLAG_FAIL:{flag}")
    if receipt.get("decision") not in {"HOLD_STAGING_CONFIGURATION","STAGING_CONFIGURATION_EVIDENCE_COMPLETE"}:
        failures.append("RECEIPT_DECISION_INVALID")
    return failures

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--receipt-schema", required=True)
    parser.add_argument("--receipt")
    args = parser.parse_args()
    manifest = _load(Path(args.manifest))
    schema = _load(Path(args.receipt_schema))
    failures = validate_manifest(manifest) + validate_receipt_schema(schema)
    if args.receipt:
        failures += validate_receipt(_load(Path(args.receipt)), manifest)
    result = {"ok": not failures, "failures": failures}
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ok"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
