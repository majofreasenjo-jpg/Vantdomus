import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classifyHouseholdData} from "../lib/domiHouseholdDataState.mjs";
const home=readFileSync(new URL("../app/hogar/[householdId]/page.tsx",import.meta.url),"utf8");
const ui=readFileSync(new URL("../app/components/domi/DomiCompanionHome.tsx",import.meta.url),"utf8");
test("legitimate authenticated empty family is real",()=>{
 assert.equal(classifyHouseholdData({dashboard:{persons:[]},shopping:{items:[]}}),"real");
 assert.match(home,/classifyHouseholdData/);
 assert.doesNotMatch(home,/const gotReal = persons.length > 0/);
});
test("one failed call or malformed data never becomes demo",()=>{
 assert.equal(classifyHouseholdData({dashboard:{persons:[]},shopping:null,shoppingError:new Error("fetch failed")}),"api");
 assert.equal(classifyHouseholdData({dashboard:null,shopping:{items:[]},dashboardError:new Error("401 unauthorized")}),"session");
 assert.equal(classifyHouseholdData({dashboard:{persons:[]},shopping:null}),"api");
 assert.equal(classifyHouseholdData({dashboard:{persons:[]},shopping:{items:null}}),"api");
});
test("real family does not receive seeded demo data when empty",()=>{
 assert.match(ui,/const isReal = dataState === "real"/);
 assert.match(ui,/\(isReal \? \[\] : \[/);
});
