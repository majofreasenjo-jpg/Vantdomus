import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx", import.meta.url),"utf8");
const projection = readFileSync(new URL("../lib/domiShoppingProjection.ts", import.meta.url),"utf8");
test("real shopping handlers use authenticated API and server GET refresh", () => {
  assert.match(ui,/shoppingCreate\(hid!/);
  assert.match(ui,/shoppingMarkPurchased\(hid!/);
  assert.match(ui,/shoppingCancel\(hid!/);
  assert.match(ui,/await shoppingList\(hid\)/);
  assert.match(ui,/setShoppingItems\(projectDomiShoppingResponse\(response\)\)/);
  assert.match(ui,/shoppingBusyRef\.current/);
});
test("assistant confirmation re-reads server records, never makes local ids", () => {
  const p = ui.split("// R70: refresh verified server-side rows after proposal execution.")[1]?.split('setDomiState(accept ? "alegre"')[0] || "";
  assert.match(p,/await refreshShopping\(\)/);
  assert.doesNotMatch(p,/domi-prop-|setShoppingItems/);
});
test("demo fallback cannot write or pretend to persist real data", () => {
  const block = ui.split("// R70: household shopping is persisted and then re-read, not simulated.")[1]?.split("const handlePrepareStudy")[0] || "";
  assert.match(block,/if \(dataState !== "demo"\)/);
  assert.match(block,/if \(realShopping\)/);
  assert.match(block,/runShoppingAction/);
  assert.match(block,/setShoppingItems/);
});
test("server status is canonical and canceled rows disappear", () => {
  assert.match(projection,/isExcluded\(row.status\)/);
  assert.match(projection,/isPurchased\(row.status\)/);
  assert.match(projection,/INVALID_SHOPPING_API_RESPONSE/);
});
