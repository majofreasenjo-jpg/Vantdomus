import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base=new URL("../app/owner-private/",import.meta.url);
const page=readFileSync(new URL("page.tsx",base),"utf8");
const client=readFileSync(new URL("OwnerPrivateClient.tsx",base),"utf8");
const preview=readFileSync(new URL("../app/owner-beta/page.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../lib/api.ts",import.meta.url),"utf8");

test("Private Owner UI never replaces synthetic preview or runs in production",()=>{
  assert.match(page,/process.env.VERCEL_ENV === "preview"/);
  assert.match(page,/DOMI_OWNER_PRIVATE_UI_ENABLED/);
  assert.match(page,/if \(!allowed\) notFound\(\)/);
  assert.match(page,/vantdomus_access_token/);
  assert.match(page,/robots: \{ index:false, follow:false \}/);
  assert.match(preview,/dataState="demo"/);
  assert.match(preview,/demoSafe=\{true\}/);
});
test("Private Owner UI only uses authenticated same-origin API helpers",()=>{
  assert.match(api,/ownerBetaListPersons/);
  assert.match(api,/ownerBetaSaveMemory/);
  assert.match(api,/ownerBetaChatWithMemory/);
  assert.match(api,/apiFetch\("\/owner-beta\/memory\/chat"/);
  assert.doesNotMatch(client,/localStorage|sessionStorage|NEXT_PUBLIC_ACCESS_TOKEN|document.cookie|Bearer /);
  assert.doesNotMatch(client,/fetch\(/);
});
test("External processing needs explicit checkbox per message",()=>{
  assert.match(client,/setConsent\(false\)/);
  // Check the exact consent path rather than an English word: the UI is in Spanish.
  assert.match(client,/if \(!question\.trim\(\) \|\| busy \|\| !consent\) return/);
  assert.match(client,/ownerBetaChatWithMemory\(text,true\)/);
  assert.match(client,/checked=\{consent\}/);
  assert.match(client,/disabled=\{!ready\|\|busy\|\|!question.trim\(\)\|\|!consent\}/);
});
