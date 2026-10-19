import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/owner-beta/page.tsx",import.meta.url),"utf8");
test("synthetic owner beta renders without access to a real family or provider",()=>{
  assert.match(page,/demoSafe=\{true\}/);
  assert.match(page,/dataState="demo"/);
  assert.doesNotMatch(page,/\bhid=/);
});
test("strict synthetic shopping is proposed, never auto-inserted",()=>{
  assert.match(src,/const demoProposal: DomiProposal \| null/);
  assert.match(src,/status: "pending"/);
  assert.match(src,/!demoProposal\) \{/);
  assert.match(src,/proposals: demoProposal \? \[demoProposal\]/);
});
test("owner decision performs local change only after confirm",()=>{
  const region=src.split("// R66: the Owner Beta can validate human confirmation LOCAL ONLY.")[1]
    ?.split("    if (isSending) return;\n    setIsSending(true);")[0] || "";
  assert.match(region,/if \(accept\) \{/);
  assert.match(region,/setShoppingItems\(prev =>/);
  assert.match(region,/status: accept \? "executed" : "rejected"/);
  assert.doesNotMatch(region,/await domiConfirmProposal/);
  assert.doesNotMatch(region,/await assistantChat/);
});
test("live backend failure never falls through to fake success",()=>{
  const live=src.split("    // --- Camino REAL: orquestador seguro")[1]?.split("// --- DEMO LOCAL")[0]||"";
  assert.match(live,/No he guardado ni ejecutado nada/);
  assert.match(live,/setIsSending\(false\);\s*return;/);
});
