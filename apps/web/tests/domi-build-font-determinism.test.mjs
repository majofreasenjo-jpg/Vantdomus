import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read = (path) => readFileSync(join(process.cwd(),path),"utf8");
test("No Google font compilation dependency", () => {
 for (const file of ["app/layout.tsx","app/owner-alpha/page.tsx","app/login/page.tsx","app/finance/[householdId]/page.tsx"]) {
  assert.doesNotMatch(read(file), /next\/font\/google/);
  assert.doesNotMatch(read(file), /fonts\.(?:googleapis|gstatic)\.com/);
 }
});
test("All DOMI CSS font variables are defined", () => {
 const css=read("app/globals.css");
 for (const v of ["--font-nunito","--domi-font-inter","--domi-font-grotesk","--domi-font-jetbrains"]) {
  assert.ok(css.includes(v+": "),v);
 }
 assert.ok(read("app/owner-alpha/page.tsx").includes("owner-alpha-fonts"));
});

test("Login and Finance keep local DOMI font variables, no remote compiler requests", () => {
 for (const file of ["app/login/page.tsx","app/finance/[householdId]/page.tsx"]) {
  const source=read(file);
  assert.doesNotMatch(source,/next\/font\/google/);
  assert.match(source,/var\(--domi-font-inter\)/);
  assert.match(source,/var\(--domi-font-grotesk\)/);
 }
});
