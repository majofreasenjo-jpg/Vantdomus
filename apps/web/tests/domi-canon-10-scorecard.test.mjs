import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const scorecard=JSON.parse(readFileSync(new URL("../../../docs/governance/DOMI_CANON_10_SCORECARD_BASELINE_20261019.json",import.meta.url),"utf8"));
const weights=Object.freeze({C:10,I:15,T:20,E:25,A:30});
const expected=new Map([["D01",45],["D02",45],["D03",25],["D04",45],["D05",45],["D06",10],["D07",10],["D08",10],["D09",25],["D10",25]]);
function axisPct(row){
  assert.ok(Array.isArray(row.gates));
  assert.equal(new Set(row.gates).size,row.gates.length);
  for(const gate of row.gates) assert.ok(Object.hasOwn(weights,gate),`Unknown evidence gate: ${gate}`);
  return row.gates.reduce((acc,gate)=>acc+weights[gate],0);
}
test("ten canonical axes always included once, immutable measured baseline",()=>{
  assert.equal(scorecard.axes.length,10);
  assert.deepEqual(new Set(scorecard.axes.map(x=>x.id)),new Set(expected.keys()));
  for(const row of scorecard.axes){
    assert.ok(row.next && row.next.length>20,"Each axis must have closure obligation");
    assert.equal(axisPct(row),expected.get(row.id));
  }
});
test("canonical scorecard aggregates all ten axes, not Family only",()=>{
 const sum=scorecard.axes.reduce((n,a)=>n+axisPct(a),0);
 assert.equal(sum/10,28.5);
 assert.equal(scorecard.real_family_e2e,"NOT_VERIFIED");
 assert.equal(scorecard.production_usable,"NOT_CERTIFIED");
});
test("unsupported scientific or OEM claims cannot count as operational gates",()=>{
 for(const id of ["D03","D06","D07","D08","D09","D10"]){
  const axis=scorecard.axes.find(x=>x.id===id);
  assert.equal(axis.gates.includes("E"),false);
  assert.equal(axis.gates.includes("A"),false);
 }
 assert.equal(scorecard.scientific_consciousness,"NOT_DEMONSTRATED");
 assert.equal(scorecard.evidence.length,10);
});
