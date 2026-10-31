import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classifyDomiLoginFailure,safeDomiLoginMessage} from "../lib/domiLoginFailure.mjs";
const action=readFileSync(new URL("../app/login/actions.ts",import.meta.url),"utf8");
test("network outage is not silently misrepresented as wrong password",()=>{
 for(const error of [new Error("fetch failed"),new Error("ECONNREFUSED"),new Error("502 Bad Gateway"),new Error("503 Service Unavailable")]){
  assert.equal(classifyDomiLoginFailure(error),"service_unavailable");
  assert.match(safeDomiLoginMessage(error),/no puede conectarse/);
 }
 assert.match(action,/safeDomiLoginMessage\(error\)/);
});
test("MFA and rate limit remain distinguishable",()=>{
 assert.equal(classifyDomiLoginFailure(new Error("428 MFA required")),"mfa_required");
 assert.equal(classifyDomiLoginFailure(new Error("429 Too Many Requests")),"rate_limited");
 assert.equal(classifyDomiLoginFailure(new Error("401 Unauthorized")),"credentials_rejected");
});
