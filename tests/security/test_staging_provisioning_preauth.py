from __future__ import annotations
import copy, importlib.util, json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("preauth",ROOT/"tools"/"staging_provisioning_preauth_validate.py")
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)
BASE=json.loads((ROOT/"docs"/"P5_STAGING_PROVISIONING_PREAUTH_PACKET_V0_1.json").read_text())

def ready_doc():
    d=copy.deepcopy(BASE)
    d["authorizationEnvelope"].update({"markerPresent":True,"markerValue":"P5_STAGING_PROVISIONING_EXECUTION_AUTHORIZATION_V0_1","monthlyRecurringCostCapUsd":100,"oneTimeCostCapUsd":25,"ownerCostUnderstandingConfirmed":True})
    d["supabase"].update({"selectedOrganizationId":"org-user-confirmed","organizationSelectionConfirmedByOwner":True,"costQuoteObtained":True,"costUnderstandingConfirmed":True,"createProjectReady":True})
    d["railway"].update({"connected":True,"planOrCostConfirmed":True,"createProjectReady":True})
    d["resend"].update({"connected":True,"planOrCostConfirmed":True,"createIdentityReady":True})
    d["vercel"].update({"isolatedStagingContextConfirmed":True,"incrementalCostConfirmed":True,"createOrDesignateReady":True})
    d["backups"].update({"primaryProviderSelected":True,"offsiteProviderSelected":True,"separateFailureDomainConfirmed":True,"provisioningReady":True})
    d["operations"].update({"primaryOperatorAssigned":True,"backupOperatorAssigned":True,"incidentEscalationOwnerAssigned":True})
    d["executionEligibility"]["provisioningEligible"]=True
    return d

class PreauthTests(unittest.TestCase):
    def test_base_packet_valid_but_held(self):
        self.assertEqual(mod.validate_packet(BASE),[])
        r=mod.evaluate_execution_eligibility(BASE)
        self.assertFalse(r["provisioningEligible"])
        self.assertEqual(r["decision"],"HOLD_STAGING_PROVISIONING")
    def test_generic_avancemos_never_counts_as_marker(self):
        d=ready_doc(); d["authorizationEnvelope"]["markerValue"]="AVANCEMOS"; d["executionEligibility"]["provisioningEligible"]=False
        self.assertIn("EXACT_AUTHORIZATION_MARKER_MISSING",mod.evaluate_execution_eligibility(d)["blockers"])
    def test_cost_cap_required(self):
        d=ready_doc(); d["authorizationEnvelope"]["monthlyRecurringCostCapUsd"]=None; d["executionEligibility"]["provisioningEligible"]=False
        self.assertIn("MONTHLY_COST_CAP_MISSING",mod.evaluate_execution_eligibility(d)["blockers"])
    def test_connections_required(self):
        d=ready_doc(); d["railway"]["connected"]=False; d["resend"]["connected"]=False; d["executionEligibility"]["provisioningEligible"]=False
        r=mod.evaluate_execution_eligibility(d)["blockers"]
        self.assertIn("RAILWAY_NOT_CONNECTED",r); self.assertIn("RESEND_NOT_CONNECTED",r)
    def test_full_preauth_never_authorizes_deployment(self):
        r=mod.evaluate_execution_eligibility(ready_doc())
        self.assertTrue(r["provisioningEligible"])
        self.assertFalse(r["stagingDeploymentAuthorized"])
        self.assertFalse(r["productionDeploymentAuthorized"])
    def test_hard_boundary_fail_closed(self):
        d=copy.deepcopy(BASE); d["hardBoundaries"]["productionMutationAuthorized"]=True
        self.assertIn("HARD_BOUNDARY_MUST_BE_FALSE:productionMutationAuthorized",mod.validate_packet(d))
    def test_raw_secret_boundary_fail_closed(self):
        d=copy.deepcopy(BASE); d["secrets"]["rawSecretsIncluded"]=True
        self.assertIn("SECRET_BOUNDARY_FAIL:rawSecretsIncluded",mod.validate_packet(d))

if __name__=="__main__":
    unittest.main()
