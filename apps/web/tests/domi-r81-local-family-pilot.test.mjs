import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {emptyPilot,restorePilot,planOverview,missingIngredients,insertMissingGroceries,createSyntheticExample,LOCAL_PILOT_KEY} from "../lib/domiLocalFamilyPilot.mjs";
const page=readFileSync(new URL("../app/family-local-pilot/page.tsx",import.meta.url),"utf8");
const ui=readFileSync(new URL("../app/family-local-pilot/FamilyLocalPilot.tsx",import.meta.url),"utf8");
test("Pilot only opens on expected Preview branch; no real backend or cloud memory",()=>{
 assert.match(page,/VERCEL_ENV !== "preview"/);
 assert.match(page,/VERCEL_GIT_COMMIT_REF/);
 assert.match(ui,/localStorage\.setItem/);
 assert.match(ui,/No hay cuentas, memoria real, sincronización/);
 assert.doesNotMatch(ui,/\bfetch\s*\(/);
});
test("Synthetic data restores with schema and rejects malformed payload",()=>{
 const state=emptyPilot();
 assert.equal(restorePilot(JSON.stringify(state)).schema,1);
 assert.deepEqual(restorePilot("invalid JSON"),emptyPilot());
 assert.deepEqual(restorePilot(JSON.stringify({schema:1,mode:"real",members:[],events:[],groceries:[],recipes:[]})),emptyPilot());
 assert.ok(LOCAL_PILOT_KEY.includes("synthetic"));
});
test("Separate members and identical-time events signal scheduling conflicts",()=>{
 const p=emptyPilot();
 p.members=[{id:"a",alias:"Alfa",studyWindow:"tarde"},{id:"b",alias:"Beta",studyWindow:"manana"}];
 p.events=[
  {id:"x",memberId:"a",title:"Prueba ficticia",kind:"prueba",date:"2026-11-10",time:"10:00",done:false},
  {id:"y",memberId:"a",title:"Consulta ficticia",kind:"actividad",date:"2026-11-10",time:"10:00",done:false},
  {id:"z",memberId:"b",title:"Ensayo B",kind:"prueba",date:"2026-11-10",time:"10:00",done:false},
 ];
 const result=planOverview(p,"2026-10-24");
 assert.equal(result.conflictPairs.length,1);
 assert.equal(result.upcomingTests.length,2);
});
test("Recipe ingredients are a proposal; state changes only on explicit action",()=>{
 const p=emptyPilot();
 p.recipes=[{id:"r",name:"Pasta ficticia",ingredients:["Tomate","Pasta"]}];
 p.groceries=[{id:"g",name:"tomate",quantity:"1",done:false}];
 assert.deepEqual(missingIngredients(p.recipes[0],p.groceries),["Pasta"]);
 const ids=()=> "new-one";
 const next=insertMissingGroceries(p,"r",ids);
 assert.equal(p.groceries.length,1);
 assert.equal(next.groceries.length,2);
 assert.equal(next.groceries[1].name,"Pasta");
});

test("R82 example is synthetic, catches schedule conflicts and proposes ingredients",()=>{
 const example=createSyntheticExample("2026-10-25");
 assert.equal(example.mode,"synthetic_only");
 assert.equal(example.members.length,2);
 assert.equal(planOverview(example,"2026-10-25").conflictPairs.length,1);
 assert.deepEqual(missingIngredients(example.recipes[0],example.groceries),["Zanahoria","Cebolla"]);
 assert.match(ui,/Cargar ejemplo ficticio/);
 assert.match(ui,/createSyntheticExample\(today\(\)\)/);
});
