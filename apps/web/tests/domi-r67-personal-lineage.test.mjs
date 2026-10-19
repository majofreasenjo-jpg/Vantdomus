import test from "node:test";
import assert from "node:assert/strict";
import {
  createPersonalDomiState, openConversationSession, closeConversationSession,
  getLongitudinalAuditStatus, buildLongitudinalContext,
} from "../lib/domiLongitudinalConversationSpine.mjs";

test("each household member gets a distinct stable personal lineage", () => {
  const a=createPersonalDomiState({householdId:"H",lineageId:"DOMI-A",personId:"A"});
  const b=createPersonalDomiState({householdId:"H",lineageId:"DOMI-B",personId:"B"});
  assert.equal(a.personalPersonId,"A");
  assert.equal(b.personalPersonId,"B");
  assert.notEqual(a.lineageId,b.lineageId);
  assert.equal(a.audit[0].kind,"PERSONAL_DOMI_BOUND");
  assert.equal(getLongitudinalAuditStatus(a).pass,true);
  assert.equal(getLongitudinalAuditStatus(b).pass,true);
});

test("same Domi moves desktop to mobile but cannot be impersonated by another member", () => {
  let a=createPersonalDomiState({householdId:"H",lineageId:"DOMI-A",personId:"A"});
  a=openConversationSession(a,{sessionId:"desktop",personId:"A",surfaceClass:"PERSONAL_DESKTOP",startedAt:"2026-10-19T11:00:00Z"});
  a=closeConversationSession(a,{sessionId:"desktop",endedAt:"2026-10-19T11:10:00Z"});
  a=openConversationSession(a,{sessionId:"mobile",personId:"A",surfaceClass:"PERSONAL_MOBILE",startedAt:"2026-10-19T11:12:00Z"});
  assert.equal(a.lineageId,"DOMI-A");
  assert.equal(a.sessions.length,2);
  assert.throws(()=>openConversationSession(a,{sessionId:"intruder",personId:"B",surfaceClass:"PERSONAL_MOBILE",startedAt:"2026-10-19T11:15:00Z"}),/PERSONAL_DOMI_PERSON_MISMATCH/);
  assert.throws(()=>buildLongitudinalContext(a,{sessionId:"mobile",personId:"B",query:"hola",now:"2026-10-19T11:16:00Z",authorizedScopes:["private_self"]}),/PERSONAL_DOMI_PERSON_MISMATCH/);
});

test("the personal binding does not introduce a consciousness claim", () => {
  const a=createPersonalDomiState({householdId:"H",lineageId:"DOMI-A",personId:"A"});
  assert.equal(a.claimWall.consciousnessDemonstrated,false);
  assert.equal(a.claimWall.phenomenalConsciousness,"UNKNOWN");
});
