import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { r87LocalFirstRunEnabled, r87AliasToEmail, r87ValidFictionalPassword } from "../lib/domiR87LocalFirstRun.mjs";
const page=readFileSync(new URL("../app/local-first-run/page.tsx",import.meta.url),"utf8");
const action=readFileSync(new URL("../app/local-first-run/actions.ts",import.meta.url),"utf8");
const launcher=readFileSync(new URL("../../../tools/windows/Start-DOMI-R86-Local.ps1",import.meta.url),"utf8");

test("R87 local first-run is unreachable in deployed and nonloopback environments",()=>{
 const ok={NODE_ENV:"development",APP_ENV:"local",NEXT_PUBLIC_API_BASE:"http://127.0.0.1:8001"};
 assert.equal(r87LocalFirstRunEnabled(ok),true);
 for(const rejected of [
  {...ok,NODE_ENV:"production"},
  {...ok,APP_ENV:"family-pilot"},
  {...ok,VERCEL_ENV:"preview"},
  {...ok,NEXT_PUBLIC_API_BASE:"https://api.example.invalid"},
  {...ok,NEXT_PUBLIC_API_BASE:"http://localhost:8001"},
  {...ok,NEXT_PUBLIC_API_BASE:"http://127.0.0.1:9001"},
 ]){
  assert.equal(r87LocalFirstRunEnabled(rejected),false);
 }
 assert.match(page,/notFound\(\)/);
 assert.match(action,/r87LocalFirstRunEnabled\(\)/);
});
test("R87 fictional alias normalization, password validation and affirmative gate",()=>{
 assert.equal(r87AliasToEmail("  Alex-2026  "),"alex-2026@example.invalid");
 for(const name of ["xx","al@example.com","real person","a_234","a".repeat(21),"0alex"]){
  assert.equal(r87AliasToEmail(name),null);
 }
 assert.equal(r87ValidFictionalPassword("Long+Fictional+Password42","alex"),true);
 assert.equal(r87ValidFictionalPassword("short","alex"),false);
 assert.equal(r87ValidFictionalPassword("alex+Password2026","alex"),false);
 assert.match(page,/name="fictional" value="yes" required/);
 assert.match(action,/formData.get\("fictional"\) === "yes"/);
 assert.match(launcher,/\/local-first-run/);
});
test("R87 server-only onboarding never ships auth secrets to client or allows external auth",()=>{
 assert.match(action,/"use server"/);
 assert.match(action,/R87_LOOPBACK_API/);
 assert.match(action,/session\.access_token/);
 assert.match(action,/httpOnly:true/);
 assert.match(action,/CSRF_COOKIE/);
 assert.doesNotMatch(action,/"use client"/);
 assert.doesNotMatch(action,/NEXT_PUBLIC_ACCESS_TOKEN/);
 assert.doesNotMatch(page,/\bfetch\s*\(/);
 assert.doesNotMatch(page,/\bpassword.*value=\{/);
});
