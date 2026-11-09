import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeBrowserHeaderForApiHop } from "../lib/domiProxyHeaderPolicy.mjs";

const authenticated = readFileSync(
  new URL("../app/api/proxy/[...path]/route.ts", import.meta.url), "utf8",
);
const publicProxy = readFileSync(
  new URL("../app/api/public/[...path]/route.ts", import.meta.url), "utf8",
);

test("R94-G both proxies invoke the same browser-header trust boundary", () => {
  for (const [name, source] of [
    ["authenticated", authenticated],
    ["public", publicProxy],
  ]) {
    assert.match(source, /import \{ safeBrowserHeaderForApiHop \} from/);
    assert.match(source, /if \(safeBrowserHeaderForApiHop\(lowered\)\)/);
    assert.match(source, /headers\.set\(key, value\)/);
    assert.match(source, /request\.headers\.forEach/);
    assert.match(source, /const HOP_BY_HOP_HEADERS/);
  }
  assert.match(authenticated, /headers\.set\("Authorization", `Bearer \$\{token\}`\)/);
  assert.doesNotMatch(publicProxy, /headers\.set\("Authorization"/);
});

test("R94-G rejects caller-supplied forwarding, host, authorization and rewrites", () => {
  const forbidden = [
    "forwarded", "Forwarded", "FORWARDED",
    "x-forwarded-for", "X-Forwarded-Host", "X-Forwarded-Proto",
    "x-forwarded-port", "x-forwarded-prefix", "X-Forwarded-Server",
    "X-Forwarded-Uri", "X-Forwarded-Client-Cert",
    "x-real-ip", "X-Original-Host", "X-Original-URL",
    "x-original-proto", "x-rewrite-url",
    "Host", "cookie", "Authorization", "Proxy-Authorization",
    "connection", "content-length", "transfer-encoding", "upgrade",
    "te", "trailer", "keep-alive", "proxy-authenticate",
  ];
  for (const header of forbidden) {
    assert.equal(safeBrowserHeaderForApiHop(header), false, header);
  }
});

test("R94-G preserves safe application headers used by public and private paths", () => {
  for (const header of [
    "content-type", "accept", "accept-language", "origin",
    "user-agent", "x-csrf-token", "if-none-match", "x-request-id",
  ]) {
    assert.equal(safeBrowserHeaderForApiHop(header), true, header);
  }
});

test("R94-G filters a malicious simulated browser header collection", () => {
  const browserHeaders = new Headers({
    "X-Forwarded-Host": "attacker.example.invalid",
    "X-Forwarded-Proto": "http",
    "Forwarded": "for=203.0.113.12;host=attacker.example.invalid",
    "X-Real-IP": "203.0.113.12",
    "X-Original-URL": "/auth/admin",
    "Host": "attacker.example.invalid",
    "Cookie": "private-cookie=fictional",
    "Authorization": "Bearer fake",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://domi.lab.example.invalid",
  });
  const out = new Headers();
  browserHeaders.forEach((value, key) => {
    if (safeBrowserHeaderForApiHop(key)) out.set(key, value);
  });
  assert.deepEqual(
    [...out.keys()].sort(),
    ["accept", "content-type", "origin"],
  );
  assert.equal(out.get("x-forwarded-host"), null);
  assert.equal(out.get("forwarded"), null);
  assert.equal(out.get("authorization"), null);
  assert.equal(out.get("cookie"), null);
});

test("R94-G policy does not accept non-string name objects", () => {
  for (const name of [null, undefined, 1, {}, [], false]) {
    assert.equal(safeBrowserHeaderForApiHop(name), false);
  }
});
