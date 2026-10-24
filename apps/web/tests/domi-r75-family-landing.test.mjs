import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveDomiFamilyLanding} from "../lib/domiFamilyLanding.mjs";
const login=readFileSync(new URL("../app/login/actions.ts",import.meta.url),"utf8");
const start=readFileSync(new URL("../app/inicio/page.tsx",import.meta.url),"utf8");
const access=readFileSync(new URL("../app/family-access/page.tsx",import.meta.url),"utf8");
test("valid family resolves to home, zero homes to invitation not dashboard",()=>{
 assert.deepEqual(resolveDomiFamilyLanding({items:[{id:"home_1"}]}),{state:"home",householdId:"home_1"});
 assert.deepEqual(resolveDomiFamilyLanding({items:[]}),{state:"not_assigned"});
 assert.deepEqual(resolveDomiFamilyLanding({items:null}),{state:"service_unavailable"});
 assert.deepEqual(resolveDomiFamilyLanding({items:[{id:"//other.example"}]}),{state:"service_unavailable"});
});
test("backend and auth failures cannot silently downgrade to dashboard",()=>{
 assert.deepEqual(resolveDomiFamilyLanding(null,new Error("401 Unauthorized")),{state:"session"});
 assert.deepEqual(resolveDomiFamilyLanding(null,new Error("503 Service Unavailable")),{state:"service_unavailable"});
 assert.match(login,/redirect\("\/family-access"\)/);
 assert.match(start,/redirect\("\/family-access"\)/);
 assert.doesNotMatch(access,/redirect\("\/dashboard"\)/);
});
