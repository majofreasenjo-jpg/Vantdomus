import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sameOriginForProxy} from "../lib/domiSameOrigin.mjs";

const source=readFileSync(new URL("../app/api/public/[...path]/route.ts",import.meta.url),"utf8");

test("R94-B public login/invitation proxy uses exact Host-Origin validation behind TLS",()=>{
  assert.match(source,/sameOriginForProxy\(origin, request\.headers\.get\("host"\), request\.nextUrl\.origin\)/);
  assert.doesNotMatch(source,/origin === request\.nextUrl\.origin/);
  assert.match(source,/auth\/register-with-invitation/);
  assert.match(source,/if \(request\.method\.toUpperCase\(\) !== "GET" && !sameOrigin\(request\)\)/);
  assert.match(source,/lowered !== "cookie" && lowered !== "authorization"/);
});
test("R94-B accepts controlled public host even if internal Next URL uses localhost",()=>{
  assert.equal(sameOriginForProxy("https://domi.lab.example.invalid","domi.lab.example.invalid","http://localhost:3000"),true);
  assert.equal(sameOriginForProxy("http://127.0.0.1:3000","127.0.0.1:3000","http://localhost:3000"),true);
});
test("R94-B rejects cross-domain, fallback-origin bypass and insecure LAN",()=>{
  const host="domi.lab.example.invalid";
  const attacks=[
    ["https://evil.example.invalid",host,"http://localhost:3000"],
    ["https://evil.example.invalid",host,"https://evil.example.invalid"],
    ["https://domi.lab.example.invalid.evil.invalid",host,"http://localhost:3000"],
    ["http://domi.lab.example.invalid",host,"http://localhost:3000"],
    ["http://192.168.1.20:3000","192.168.1.20:3000","http://localhost:3000"],
    ["https://domi.lab.example.invalid:444",host,"http://localhost:3000"],
    ["https://user:pass@domi.lab.example.invalid",host,"http://localhost:3000"],
    ["https://domi.lab.example.invalid/path",host,"http://localhost:3000"],
    ["https://domi.lab.example.invalid?token=abc",host,"http://localhost:3000"],
  ];
  for(const [origin,actualHost,nextOrigin] of attacks){
    assert.equal(sameOriginForProxy(origin,actualHost,nextOrigin),false,origin);
  }
});
