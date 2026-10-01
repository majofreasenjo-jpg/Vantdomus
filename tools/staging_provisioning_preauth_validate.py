#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

VERSION="DOMI_P5_STAGING_PROVISIONING_PREAUTH_PACKET_V0_1"
MARKER="P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1"

REQUIRED_HARD_FALSE=(
    "stagingDeploymentAuthorized",
    "productionDeploymentAuthorized",
    "productionMutationAuthorized",
    "realOwnerMemoryAuthorized",
    "externalUsersAuthorized",
    "iosSupportClaimAuthorized",
    "r3G11Authorized",
)

def evaluate_execution_eligibility(doc: dict) -> dict:
    blockers=[]
    auth=doc.get("authorizationEnvelope") or {}
    if auth.get("markerPresent") is not True or auth.get("markerValue") != MARKER:
        blockers.append("EXACT_AUTHORIZATION_MARKER_MISSING")
    monthly=auth.get("monthlyRecurringCostCapUsd")
    if not isinstance(monthly,(int,float)) or monthly <= 0:
        blockers.append("MONTHLY_COST_CAP_MISSING")
    if auth.get("ownerCostUnderstandingConfirmed") is not True:
        blockers.append("OWNER_COST_CONFIRMATION_MISSING")

    s=doc.get("supabase") or {}
    if not s.get("selectedOrganizationId") or s.get("organizationSelectionConfirmedByOwner") is not True:
        blockers.append("SUPABASE_ORGANIZATION_SELECTION_NOT_CONFIRMED")
    if s.get("costQuoteObtained") is not True or s.get("costUnderstandingConfirmed") is not True:
        blockers.append("SUPABASE_COST_CONFIRMATION_MISSING")
    if s.get("createProjectReady") is not True:
        blockers.append("SUPABASE_CREATE_NOT_READY")

    r=doc.get("railway") or {}
    if r.get("connected") is not True:
        blockers.append("RAILWAY_NOT_CONNECTED")
    if r.get("planOrCostConfirmed") is not True:
        blockers.append("RAILWAY_COST_CONFIRMATION_MISSING")
    if r.get("createProjectReady") is not True:
        blockers.append("RAILWAY_CREATE_NOT_READY")

    m=doc.get("resend") or {}
    if m.get("connected") is not True:
        blockers.append("RESEND_NOT_CONNECTED")
    if m.get("planOrCostConfirmed") is not True:
        blockers.append("RESEND_COST_CONFIRMATION_MISSING")
    if m.get("createIdentityReady") is not True:
        blockers.append("RESEND_CREATE_NOT_READY")

    v=doc.get("vercel") or {}
    if v.get("isolatedStagingContextConfirmed") is not True:
        blockers.append("VERCEL_ISOLATED_STAGING_CONTEXT_NOT_CONFIRMED")
    if v.get("incrementalCostConfirmed") is not True:
        blockers.append("VERCEL_COST_CONFIRMATION_MISSING")
    if v.get("createOrDesignateReady") is not True:
        blockers.append("VERCEL_CREATE_OR_DESIGNATE_NOT_READY")

    b=doc.get("backups") or {}
    if not (b.get("primaryProviderSelected") and b.get("offsiteProviderSelected") and b.get("separateFailureDomainConfirmed")):
        blockers.append("BACKUP_PROVIDERS_NOT_SELECTED")
    if b.get("provisioningReady") is not True:
        blockers.append("BACKUP_PROVISIONING_NOT_READY")

    o=doc.get("operations") or {}
    if not (o.get("primaryOperatorAssigned") and o.get("backupOperatorAssigned") and o.get("incidentEscalationOwnerAssigned")):
        blockers.append("OPERATOR_OWNERSHIP_NOT_ASSIGNED")

    return {
        "provisioningEligible": not blockers,
        "decision":"P5_STAGING_PROVISIONING_ELIGIBLE" if not blockers else "HOLD_STAGING_PROVISIONING",
        "blockers":blockers,
        "stagingDeploymentAuthorized":False,
        "productionDeploymentAuthorized":False,
    }

def validate_packet(doc: dict) -> list[str]:
    failures=[]
    if doc.get("version") != VERSION:
        failures.append("VERSION_MISMATCH")
    if doc.get("requiredAuthorizationMarker") != MARKER:
        failures.append("AUTHORIZATION_MARKER_CONTRACT_MISMATCH")
    if doc.get("status") not in {"PREAUTH_HOLD","PREAUTH_READY_PENDING_EXACT_AUTHORIZATION"}:
        failures.append("STATUS_INVALID")

    secrets=doc.get("secrets") or {}
    for key in ("rawSecretsIncluded","credentialsIncluded","tokensIncluded"):
        if secrets.get(key) is not False:
            failures.append(f"SECRET_BOUNDARY_FAIL:{key}")

    boundaries=doc.get("hardBoundaries") or {}
    for key in REQUIRED_HARD_FALSE:
        if boundaries.get(key) is not False:
            failures.append(f"HARD_BOUNDARY_MUST_BE_FALSE:{key}")

    supabase=doc.get("supabase") or {}
    if supabase.get("projectName") != "domi-staging":
        failures.append("SUPABASE_PROJECT_NAME_MISMATCH")
    if supabase.get("preferredRegion") != "sa-east-1":
        failures.append("SUPABASE_REGION_PLAN_MISMATCH")

    railway=doc.get("railway") or {}
    required_services={"domi-staging-api","domi-staging-redis","domi-staging-clamav"}
    if set(railway.get("targetServices") or []) != required_services:
        failures.append("RAILWAY_SERVICE_SET_MISMATCH")

    auth=doc.get("authorizationEnvelope") or {}
    if auth.get("markerPresent") is True and auth.get("markerValue") != MARKER:
        failures.append("WRONG_AUTHORIZATION_MARKER")

    declared=(doc.get("executionEligibility") or {}).get("provisioningEligible")
    actual=evaluate_execution_eligibility(doc)["provisioningEligible"]
    if declared is not actual:
        failures.append("DECLARED_ELIGIBILITY_DRIFT")
    return failures

def main() -> int:
    p=argparse.ArgumentParser()
    p.add_argument("--packet",required=True)
    args=p.parse_args()
    doc=json.loads(Path(args.packet).read_text(encoding="utf-8"))
    failures=validate_packet(doc)
    result={"ok":not failures,"failures":failures,"execution":evaluate_execution_eligibility(doc)}
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0 if not failures else 1

if __name__=="__main__":
    raise SystemExit(main())
