import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const comp = readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx",import.meta.url),"utf8");
const page = readFileSync(new URL("../app/owner-beta/page.tsx",import.meta.url),"utf8");

test("Owner Beta explicitly opts into strict synthetic mode",()=>{
  assert.match(page,/dataState="demo"/);
  assert.match(page,/demoSafe=\{true\}/);
  assert.doesNotMatch(page,/\bhid=/);
});
test("Strict synthetic mode blocks geolocation and remote weather lookup",()=>{
  assert.match(comp,/const isStrictSynthetic = dataState === "demo" && demoSafe/);
  assert.match(comp,/if \(!isStrictSynthetic && typeof navigator !== "undefined" && navigator\.geolocation\)/);
  assert.match(comp,/fetch\(\x60\/api\/weather/);
});
test("Strict synthetic mode returns before microphone recording and Whisper upload",()=>{
  const voice=comp.split("const triggerListeningSimulation = async () => {")[1];
  assert.ok(voice);
  const beforeCapture=voice.split("const r = await startRecording()")[0];
  assert.match(beforeCapture,/if \(isStrictSynthetic\)/);
  assert.match(beforeCapture,/return;/);
  assert.match(comp,/await transcribeAudio\(hid,/);
});
test("Strict synthetic mode rejects live proposals and real login/logout actions",()=>{
  const proposal=comp.split("const decideProposal = async (")[1];
  assert.ok(proposal);
  assert.match(proposal.split("if (accept) await domiConfirmProposal")[0],/if \(isStrictSynthetic\)/);
  assert.match(comp,/\{!isStrictSynthetic && dataState !== "api"/);
  assert.match(comp,/\{!isStrictSynthetic && \(\s*<form action=\{logoutAction\}>/);
});
