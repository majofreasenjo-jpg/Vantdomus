import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const s=readFileSync(new URL("../app/api/domi-family-backend-check/route.ts",import.meta.url),"utf8");
test("read-only probe is Preview-branch restricted and not production",()=>{
 assert.match(s,/VERCEL_ENV !== "preview"/);
 assert.match(s,/VERCEL_GIT_COMMIT_REF !== PREVIEW_BRANCH/);
 assert.match(s,/method: "GET"/);
 assert.match(s,/new URL\("\/health", base\)/);
 assert.match(s,/AbortSignal\.timeout\(7000\)/);
});
test("probe cannot reflect raw health body or secrets",()=>{
 assert.match(s,/authenticatedJourneyVerified: false/);
 assert.match(s,/databasePersistenceVerified: false/);
 assert.match(s,/redirect: "error"/);
 assert.doesNotMatch(s,/headers:\s*\{[^}]*Authorization/);
 assert.doesNotMatch(s,/return NextResponse\.json\(body/);
});
