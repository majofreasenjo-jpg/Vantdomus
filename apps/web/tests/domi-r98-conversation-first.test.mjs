import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const home = readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx",import.meta.url),"utf8");
const orb = readFileSync(new URL("../app/components/domi/DomiOrb.tsx",import.meta.url),"utf8");
const route = readFileSync(new URL("../app/hogar/[householdId]/page.tsx",import.meta.url),"utf8");

test("R98 conversation is first and full dashboard remains accessible on demand", () => {
  assert.match(home,/useState<"inicio" \| "panel" \| "hoy" \| "documentos" \| "mas">\("inicio"\)/);
  assert.match(home,/id="tab-inicio-conversacion"/);
  assert.match(home,/activeTab === "panel"/);
  assert.match(home,/Panel completo/);
  assert.match(home,/setActiveTab\("panel"\)/);
  assert.ok(home.indexOf('id="tab-inicio-conversacion"') < home.indexOf('id="tab-inicio-main"'));
  assert.match(home,/aria-label="Conversar con Domi"/);
});
test("R98 the central start keeps actual chat API and denies permanent orbit nodes", () => {
  const start = home.split('id="tab-inicio-conversacion"')[1].split('activeTab === "panel"')[0];
  assert.match(start,/showOrbitNodes=\{false\}/);
  assert.match(start,/<DomiChat/);
  assert.match(start,/onSendMessage=\{sendMessageToDomi\}/);
  assert.match(start,/onDecideProposal=\{decideProposal\}/);
  assert.doesNotMatch(start,/<StatusCards/);
  assert.match(orb,/showOrbitNodes\?: boolean/);
  assert.match(orb,/showOrbitNodes && nodes\.map/);
});
test("R98 existing real-hogar routing and memory navigation survive", () => {
  assert.match(route,/<DomiCompanionHome/);
  assert.match(home,/isReal && !isStrictSynthetic && hid/);
  assert.match(home,/Memoria y perfiles/);
  assert.match(home,/activeTab === "hoy"/);
});
