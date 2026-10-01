from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "staging_manifest_validate", ROOT / "tools" / "staging_manifest_validate.py"
)
mod = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(mod)

MANIFEST = json.loads((ROOT / "docs" / "P5_STAGING_CONFIGURATION_MANIFEST_V0_1.json").read_text())
SCHEMA = json.loads((ROOT / "docs" / "P5_STAGING_REDACTED_RECEIPT_SCHEMA_V0_1.json").read_text())

def receipt():
    return {
        "packageId":"test",
        "candidateCommit":"a"*40,
        "configDigest":"sha256:"+"b"*64,
        "observedAt":"2026-10-01T16:00:00Z",
        "environment":"staging",
        "resourceStatuses":[
            {"resourceId":"database","status":"PROVISIONED_UNVERIFIED","providerClass":"managed-db","resourceRef":"db:opaque"}
        ],
        "environmentChecks":[
            {"key":"DATABASE_URL","present":True,"classification":"SECRET","valueStatus":"EXPECTED","valueHash":"sha256:"+"c"*64},
            {"key":"APP_ENV","present":True,"classification":"NON_SECRET","valueStatus":"EXPECTED","value":"staging"},
            {"key":"NEXT_PUBLIC_ACCESS_TOKEN","present":False,"classification":"FORBIDDEN_PUBLIC","valueStatus":"EMPTY"}
        ],
        "gateReceipts":[],
        "privacyFlags":{
            "rawSecretsIncluded":False,
            "credentialsIncluded":False,
            "sessionTokensIncluded":False,
            "realOwnerMemoryIncluded":False,
            "rawTranscriptIncluded":False,
            "fullStateIncluded":False,
            "authorityIncluded":False
        },
        "decision":"HOLD_STAGING_CONFIGURATION"
    }

class StagingManifestTests(unittest.TestCase):
    def test_canonical_manifest_and_schema_pass(self):
        self.assertEqual(mod.validate_manifest(MANIFEST), [])
        self.assertEqual(mod.validate_receipt_schema(SCHEMA), [])

    def test_secret_key_must_use_presence_and_hash_only(self):
        doc=copy.deepcopy(MANIFEST)
        item=next(x for x in doc["apiEnvironment"] if x["key"]=="JWT_SECRET")
        item["receiptPolicy"]="VALUE_ALLOWED"
        self.assertIn("SECRET_RECEIPT_POLICY_INVALID:JWT_SECRET", mod.validate_manifest(doc))

    def test_forbidden_public_keys_must_be_absent_or_empty(self):
        doc=copy.deepcopy(MANIFEST)
        item=next(x for x in doc["webEnvironment"] if x["key"]=="NEXT_PUBLIC_ACCESS_TOKEN")
        item["expected"]="TBD"
        self.assertIn("FORBIDDEN_PUBLIC_EXPECTATION_INVALID:NEXT_PUBLIC_ACCESS_TOKEN", mod.validate_manifest(doc))

    def test_execution_boundaries_fail_closed(self):
        doc=copy.deepcopy(MANIFEST)
        doc["executionBoundary"]["stagingDeploymentAuthorized"]=True
        self.assertIn("BOUNDARY_MUST_BE_FALSE:stagingDeploymentAuthorized", mod.validate_manifest(doc))

    def test_receipt_rejects_raw_secret_values(self):
        r=receipt()
        secret=next(x for x in r["environmentChecks"] if x["key"]=="DATABASE_URL")
        secret["value"]="postgresql://user:password@host/db"
        self.assertIn("RECEIPT_RAW_VALUE_FORBIDDEN:DATABASE_URL", mod.validate_receipt(r, MANIFEST))

    def test_receipt_rejects_unknown_resources(self):
        r=receipt()
        r["resourceStatuses"][0]["resourceId"]="mystery"
        self.assertIn("RECEIPT_UNKNOWN_RESOURCE", mod.validate_receipt(r, MANIFEST))

    def test_receipt_requires_privacy_flags_false(self):
        r=receipt()
        r["privacyFlags"]["rawSecretsIncluded"]=True
        self.assertIn("RECEIPT_PRIVACY_FLAG_FAIL:rawSecretsIncluded", mod.validate_receipt(r, MANIFEST))

    def test_receipt_requires_exact_staging_environment(self):
        r=receipt()
        r["environment"]="production"
        self.assertIn("RECEIPT_ENVIRONMENT_NOT_STAGING", mod.validate_receipt(r, MANIFEST))

    def test_secret_hash_format_is_fail_closed(self):
        r=receipt()
        secret=next(x for x in r["environmentChecks"] if x["key"]=="DATABASE_URL")
        secret["valueHash"]="not-a-digest"
        self.assertIn("RECEIPT_SECRET_HASH_INVALID:DATABASE_URL", mod.validate_receipt(r, MANIFEST))

if __name__=="__main__":
    unittest.main()
