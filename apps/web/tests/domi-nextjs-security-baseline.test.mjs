import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url),"utf8"));
const workflow = readFileSync(new URL("../../../.github/workflows/security-gate.yml",import.meta.url),"utf8");
const VERSION="16.2.6";
const names=[
  "next","@next/env","@next/swc-darwin-arm64","@next/swc-darwin-x64",
  "@next/swc-linux-arm64-gnu","@next/swc-linux-arm64-musl",
  "@next/swc-linux-x64-gnu","@next/swc-linux-x64-musl",
  "@next/swc-win32-arm64-msvc","@next/swc-win32-x64-msvc"
];

test("Owner Beta web pins the security-patched Next.js baseline",()=>{
  assert.equal(manifest.dependencies.next,VERSION);
  assert.equal(lock.packages[""].dependencies.next,VERSION);
  assert.equal(lock.packages["node_modules/next"].version,VERSION);
});

test("All Next.js runtime and optional compiler binaries share the patched release",()=>{
  for(const name of names){
    const row=lock.packages["node_modules/"+name];
    assert.ok(row,"missing "+name);
    assert.equal(row.version,VERSION,name);
    assert.ok(row.resolved.startsWith("https://registry.npmjs.org/"),name);
    assert.match(row.integrity,/^sha512-[A-Za-z0-9+/]+={0,2}$/,name);
  }
  assert.equal(lock.packages["node_modules/next"].dependencies["@next/env"],VERSION);
  for(const name of names.filter(n=>n.startsWith("@next/swc-")))
    assert.equal(lock.packages["node_modules/next"].optionalDependencies[name],VERSION,name);
});

test("High and critical npm audit is a required web CI gate, not advisory",()=>{
  const web = workflow.split("\n  web:\n")[1]?.split("\n  # ----------------------------------------------------------------------\n  # Mobile")[0];
  assert.ok(web,"missing web CI job");
  assert.match(web,/npm audit --omit=dev --audit-level=high/);
  const step=web.split("- name: npm audit (high & critical)")[1];
  assert.ok(step,"missing web audit step");
  assert.doesNotMatch(step,/continue-on-error:\s*true/);
});
