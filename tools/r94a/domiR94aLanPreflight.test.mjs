import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {assessR94aLanDesign,R94A_SCHEMA} from "./domiR94aLanPreflight.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const example=JSON.parse(readFileSync(path.join(here,"example.plan.json"),"utf8"));
function assess(delta){return assessR94aLanDesign({...structuredClone(example),...delta})}
function rejects(delta,code){
 const result=assess(delta);
 assert.equal(result.status,"REJECTED",JSON.stringify(delta));
 assert.ok(result.errors.includes(code),JSON.stringify(result));
 assert.equal(result.canInstall,false);
 assert.equal(result.canDeploy,false);
 assert.equal(result.physicalDeviceCertified,false);
}
test("R94-A baseline is design-only and never certifies physical devices",()=>{
 const result=assessR94aLanDesign(example);
 assert.equal(result.schema,R94A_SCHEMA);
 assert.equal(result.status,"DESIGN_ONLY_VALID");
 assert.deepEqual(result.errors,[]);
 assert.equal(result.canInstall,false);
 assert.equal(result.canDeploy,false);
 assert.equal(result.physicalDeviceCertified,false);
 assert.ok(result.unresolved.includes("SERVER_TO_API_HOST_ROUTING_UNRESOLVED"));
 assert.ok(result.unresolved.includes("TLS_TRUST_UNVERIFIED"));
 assert.ok(result.unresolved.includes("INITIAL_INVITATION_BOOTSTRAP_UNRESOLVED"));
 assert.ok(result.unresolved.includes("PHYSICAL_PHONE_E2E_NOT_RUN"));
});
test("R94-A exact HTTPS host and origin; no IP, wildcard or LAN HTTP",()=>{
 for(const origin of [
   "http://domi.lab.example.invalid",
   "https://192.168.1.50",
   "http://192.168.1.50",
   "https://127.0.0.1",
   "https://localhost",
   "https://domi.lab.example.invalid:3000",
   "https://domi.lab.example.invalid/",
   "https://domi.lab.example.invalid/path",
   "https://domi.lab.example.invalid?auth=1",
   "https://user:pass@domi.lab.example.invalid",
   "https://*.lab.example.invalid",
   "https://domi.lab.example.invalid.evil.example.invalid/"
 ]) rejects({familyOrigin:origin},"PUBLIC_ORIGIN_NOT_EXACT_HTTPS_DNS");
});
test("R94-A domain binding must be strict on both Host and CORS",()=>{
 rejects({allowedHosts:["*"]},"HOST_ALLOWLIST_NOT_EXACT");
 rejects({allowedHosts:["domi.lab.example.invalid","localhost"]},"HOST_ALLOWLIST_NOT_EXACT");
 rejects({allowedHosts:["evil.lab.example.invalid"]},"HOST_ALLOWLIST_NOT_EXACT");
 rejects({corsOrigins:["*"]},"CORS_ORIGINS_NOT_EXACT");
 rejects({corsOrigins:["https://evil.lab.example.invalid"]},"CORS_ORIGINS_NOT_EXACT");
 rejects({corsOrigins:["https://domi.lab.example.invalid","https://evil.lab.example.invalid"]},"CORS_ORIGINS_NOT_EXACT");
});
test("R94-A never lets a design claim network deployment or installation",()=>{
 const bad=[
  ["intent","DEPLOY_NOW","LIVE_EXECUTION_NOT_AUTHORIZED"],
  ["tlsTrust","INSTALLED","TLS_TRUST_CANNOT_BE_ASSERTED"],
  ["privateDns","CONFIGURED","DNS_CANNOT_BE_ASSERTED"],
  ["apiHostRouting","VERIFIED","API_HOST_ROUTING_CANNOT_BE_ASSERTED"],
  ["invitationBootstrap","CREATED","INVITATION_CANNOT_BE_ASSERTED"],
  ["physicalPhoneTest","PASS","PHYSICAL_TEST_CANNOT_BE_ASSERTED"],
  ["firewallState","ENABLED","FIREWALL_CHANGE_NOT_AUTHORIZED"],
  ["caInstallState","INSTALLED","CA_INSTALL_NOT_AUTHORIZED"],
  ["listenerState","RUNNING","LISTENER_START_NOT_AUTHORIZED"],
  ["wanExposure",true,"WAN_EXPOSURE_FORBIDDEN"],
  ["mutationsApplied",["installed root CA"],"INFRASTRUCTURE_MUTATION_NOT_AUTHORIZED"],
 ];
 for(const [key,value,code] of bad)rejects({[key]:value},code);
});
test("R94-A requires backend/private routing and denies public auth/data",()=>{
 rejects({webUpstream:"http://0.0.0.0:3000"},"WEB_UPSTREAM_NOT_LOOPBACK");
 rejects({apiUpstream:"http://0.0.0.0:8001"},"API_UPSTREAM_NOT_LOOPBACK");
 rejects({apiUpstream:"https://domi.lab.example.invalid/api"},"API_UPSTREAM_NOT_LOOPBACK");
 rejects({apiReachableFromLan:true},"DIRECT_API_LAN_ACCESS_FORBIDDEN");
 rejects({publicRegistration:true},"PUBLIC_REGISTRATION_FORBIDDEN");
 rejects({secureCookies:false},"SECURE_COOKIES_REQUIRED");
 rejects({mockAiOnly:false},"EXTERNAL_AI_NOT_AUTHORIZED");
 rejects({familyProfile:"local"},"FAMILY_PILOT_REQUIRED");
});
test("R94-A fails closed on extra fields and invalid schema",()=>{
 rejects({schema:"OTHER"},"SCHEMA_MISMATCH");
 rejects({allowAllNetworks:true},"UNKNOWN_PLAN_FIELD");
 assert.equal(assessR94aLanDesign(null).status,"REJECTED");
 assert.equal(assessR94aLanDesign([]).status,"REJECTED");
 assert.equal(assessR94aLanDesign(new Date()).status,"REJECTED");
});
test("R94-A example CLI yields only design result, never mutates network",()=>{
 const output=execFileSync(process.execPath,[
  path.join(here,"domiR94aLanPreflight.mjs"),
  path.join(here,"example.plan.json")
 ],{encoding:"utf8",timeout:5000});
 const result=JSON.parse(output);
 assert.equal(result.status,"DESIGN_ONLY_VALID");
 assert.equal(result.canDeploy,false);
 assert.equal(result.physicalDeviceCertified,false);
 assert.doesNotMatch(output,/BEGIN CERTIFICATE|PRIVATE KEY|password|bearer|access_token/i);
});
