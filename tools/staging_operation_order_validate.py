#!/usr/bin/env python3
from __future__ import annotations

import argparse, json
from pathlib import Path

VERSION="DOMI_P5_STAGING_PROVISIONING_OPERATION_ORDER_V0_1"
MARKER="P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1"
EXPECTED_NAMES={
    "web":"domi-staging-web",
    "database":"domi-staging",
    "api":"domi-staging-api",
    "redis":"domi-staging-redis",
    "clamav":"domi-staging-clamav",
    "smtp":"domi-staging-mail",
    "alerts":"domi-staging-security-alerts",
    "backupPrimary":"domi-staging-backup-primary",
    "backupOffsite":"domi-staging-backup-offsite",
}
BOUNDARY_KEYS=(
    "deleteExistingResource","renameExistingResource","repurposeExistingResource",
    "productionMutation","useExistingEdisGocDatabases","realOwnerMemory",
    "externalUsers","productionPromotion","r3r4Execution","iosSupportClaim"
)

def validate(doc: dict) -> list[str]:
    f=[]
    if doc.get("version") != VERSION: f.append("VERSION_MISMATCH")
    if doc.get("requiredExecutionMarker") != MARKER: f.append("MARKER_MISMATCH")
    if doc.get("status") not in {"DRAFT_NOT_EXECUTED","READY_PENDING_EXACT_AUTHORIZATION"}:
        f.append("STATUS_INVALID")
    if doc.get("resourceNames") != EXPECTED_NAMES: f.append("RESOURCE_NAME_DRIFT")
    if doc.get("executed") is not False: f.append("EXECUTED_MUST_REMAIN_FALSE_IN_ORDER")
    if doc.get("approvalDecision") != "HOLD_STAGING_PROVISIONING":
        f.append("ORDER_MUST_DEFAULT_HOLD")
    b=doc.get("hardBoundaries") or {}
    for k in BOUNDARY_KEYS:
        if b.get(k) is not False: f.append(f"HARD_BOUNDARY_MUST_BE_FALSE:{k}")
    p=doc.get("preconditions") or {}
    if p.get("authorizationMarkerPresent") is True:
        f.append("AUTHORIZATION_MARKER_MUST_NOT_BE_EMBEDDED_IN_DRAFT_ORDER")
    return f

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--order",required=True)
    args=ap.parse_args()
    doc=json.loads(Path(args.order).read_text(encoding="utf-8"))
    failures=validate(doc)
    print(json.dumps({"ok":not failures,"failures":failures},indent=2,sort_keys=True))
    raise SystemExit(0 if not failures else 1)

if __name__=="__main__": main()
