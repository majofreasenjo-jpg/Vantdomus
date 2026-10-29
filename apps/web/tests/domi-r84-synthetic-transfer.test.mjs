import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {emptyPilot,createSyntheticExample,LOCAL_PILOT_LIMIT} from "../lib/domiLocalFamilyPilot.mjs";
import {encodeSyntheticTransfer,decodeSyntheticTransfer,SYNTHETIC_TRANSFER_FORMAT} from "../lib/domiSyntheticTransfer.mjs";

test("R84 roundtrip is synthetic-only, lossless and preserves proposals without execution",()=>{
 const state=createSyntheticExample("2026-10-29");
 const raw=encodeSyntheticTransfer(state);
 assert.equal(JSON.parse(raw).format,SYNTHETIC_TRANSFER_FORMAT);
 assert.deepEqual(decodeSyntheticTransfer(raw),state);
 assert.deepEqual(decodeSyntheticTransfer(encodeSyntheticTransfer(emptyPilot())),emptyPilot());
});
test("R84 rejects real mode, unexpected memory and authority fields",()=>{
 const s=createSyntheticExample("2026-10-29");
 for(const invalid of [
  {...s,mode:"real"},
  {...s,ownerMemory:"personal-data"},
  {...s,members:[{...s.members[0],email:"real@example.com"}]},
  {...s,events:[{...s.events[0],authority:"owner"}]},
 ]){
  assert.throws(()=>encodeSyntheticTransfer(invalid),/INVALID_SYNTHETIC_TRANSFER/);
 }
});
test("R84 rejects fabricated envelopes, duplicates, oversized and invalid references",()=>{
 const s=createSyntheticExample("2026-10-29");
 const good=JSON.parse(encodeSyntheticTransfer(s));
 for(const invalid of [
  {...good, extra:true},
  {...good,format:"domi-real-family-transfer"},
  {...good,payload:{...s,members:[s.members[0],s.members[0]]}},
  {...good,payload:{...s,events:[{...s.events[0],memberId:"missing"}]}},
  {...good,payload:{...s,recipes:[{...s.recipes[0],ingredients:["A".repeat(1000)]}]}},
 ]){
  assert.throws(()=>decodeSyntheticTransfer(JSON.stringify(invalid)),/INVALID_SYNTHETIC_TRANSFER/);
 }
 assert.throws(()=>decodeSyntheticTransfer("X".repeat(LOCAL_PILOT_LIMIT+1)),/INVALID_SYNTHETIC_TRANSFER/);
 assert.throws(()=>decodeSyntheticTransfer("{"),/INVALID_SYNTHETIC_TRANSFER/);
});
test("R84 UI requires explicit fictional confirmation and no network calls",()=>{
 const ui=readFileSync(new URL("../app/family-local-pilot/FamilyLocalPilot.tsx",import.meta.url),"utf8");
 assert.match(ui,/fictionConfirmed/);
 assert.match(ui,/window.confirm\("¿Reemplazar los datos ficticios/);
 assert.match(ui,/decodeSyntheticTransfer/);
 assert.match(ui,/encodeSyntheticTransfer/);
 assert.match(ui,/exclusivamente ficticios/);
 assert.doesNotMatch(ui,/\bfetch\s*\(/);
});
