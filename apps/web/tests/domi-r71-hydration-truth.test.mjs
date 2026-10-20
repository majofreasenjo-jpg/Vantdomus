import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/hogar/[householdId]/page.tsx",import.meta.url),"utf8");
const ui=readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx",import.meta.url),"utf8");
test("initial shopping render and post-confirm refresh share canonical mapper",()=>{
 assert.match(page,/projectDomiShoppingResponse\(shopping\)/);
 assert.match(ui,/projectDomiShoppingResponse\(response\)/);
 assert.doesNotMatch(page,/s\.place_hint \|\| s\.category/);
});
test("failed session or backend does not create simulated people or groceries",()=>{
 assert.match(page,/if \(dataState === "real"\)/);
 assert.equal(ui.includes("isReal ? [] : ["),false);
 assert.ok((ui.match(/dataState !== "demo" \? \[\] : \[/g)||[]).length>=3);
});
