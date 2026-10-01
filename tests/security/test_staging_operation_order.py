from __future__ import annotations
import copy, importlib.util, json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("order_validate",ROOT/"tools"/"staging_operation_order_validate.py")
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)
BASE=json.loads((ROOT/"docs"/"P5_STAGING_PROVISIONING_OPERATION_ORDER_V0_1.json").read_text())

class OrderTests(unittest.TestCase):
    def test_canonical_order_passes(self):
        self.assertEqual(mod.validate(BASE),[])
    def test_resource_name_drift_fails(self):
        d=copy.deepcopy(BASE); d["resourceNames"]["database"]="shared-db"
        self.assertIn("RESOURCE_NAME_DRIFT",mod.validate(d))
    def test_production_mutation_cannot_be_relaxed(self):
        d=copy.deepcopy(BASE); d["hardBoundaries"]["productionMutation"]=True
        self.assertIn("HARD_BOUNDARY_MUST_BE_FALSE:productionMutation",mod.validate(d))
    def test_repurpose_existing_resource_cannot_be_relaxed(self):
        d=copy.deepcopy(BASE); d["hardBoundaries"]["repurposeExistingResource"]=True
        self.assertIn("HARD_BOUNDARY_MUST_BE_FALSE:repurposeExistingResource",mod.validate(d))
    def test_real_owner_memory_cannot_be_relaxed(self):
        d=copy.deepcopy(BASE); d["hardBoundaries"]["realOwnerMemory"]=True
        self.assertIn("HARD_BOUNDARY_MUST_BE_FALSE:realOwnerMemory",mod.validate(d))
    def test_draft_cannot_embed_authorization_marker(self):
        d=copy.deepcopy(BASE); d["preconditions"]["authorizationMarkerPresent"]=True
        self.assertIn("AUTHORIZATION_MARKER_MUST_NOT_BE_EMBEDDED_IN_DRAFT_ORDER",mod.validate(d))
    def test_order_cannot_claim_execution(self):
        d=copy.deepcopy(BASE); d["executed"]=True
        self.assertIn("EXECUTED_MUST_REMAIN_FALSE_IN_ORDER",mod.validate(d))

if __name__=="__main__": unittest.main()
