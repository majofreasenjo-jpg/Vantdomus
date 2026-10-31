import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const c=readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx",import.meta.url),"utf8");
const p=readFileSync(new URL("../app/perfiles/[householdId]/page.tsx",import.meta.url),"utf8");
test("R90 authentic home links to existing household-scoped memory and profiles",()=>{
 assert.match(c,/isReal && !isStrictSynthetic && hid/);
 assert.match(c,/\/perfiles\/\$\{encodeURIComponent\(hid\)\}/);
 assert.match(c,/Memoria y perfiles/);
 assert.match(p,/<DomiMemory/);
 assert.match(p,/<MemoryLibrary/);
 assert.doesNotMatch(c,/localStorage\.setItem\(["']domi.*memory/);
});
