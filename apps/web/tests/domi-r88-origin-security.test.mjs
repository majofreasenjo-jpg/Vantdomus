import test from "node:test";
import assert from "node:assert/strict";
import {sameOriginForProxy} from "../lib/domiSameOrigin.mjs";

test("exact browser Host, localhost rewriting and strict rejection",()=>{
 assert.equal(sameOriginForProxy("http://127.0.0.1:3000","127.0.0.1:3000","http://localhost:3000"),true);
 assert.equal(sameOriginForProxy("https://familia.example.invalid","familia.example.invalid","http://localhost:3000"),true);
 assert.equal(sameOriginForProxy("https://evil.example.invalid","familia.example.invalid","https://evil.example.invalid"),false);
 assert.equal(sameOriginForProxy("http://familia.example.invalid","familia.example.invalid",null),false);
 for(const attack of [
   "https://evil.example.invalid","https://familia.example.invalid.evil.invalid",
   "http://127.0.0.1:3001","https://127.0.0.1:3000",
   "https://familia.example.invalid@evil.invalid","data:text/html,evil",
   "https://familia.example.invalid/path","https://familia.example.invalid?x=y"
 ]) assert.equal(sameOriginForProxy(attack,"familia.example.invalid","http://localhost:3000"),false,attack);
 assert.equal(sameOriginForProxy(null,"familia.example.invalid","http://localhost:3000"),true);
 assert.equal(sameOriginForProxy("https://test.invalid",null,"http://localhost:3000"),false);
});
