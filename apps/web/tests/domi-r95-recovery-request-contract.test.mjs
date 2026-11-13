import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const login = read("../app/login/page.tsx");
const request = read("../app/recuperar-acceso/RecoveryRequestClient.tsx");
const page = read("../app/recuperar-acceso/page.tsx");
const confirmation = read("../app/reset-password/ResetPasswordClient.tsx");
const api = read("../lib/public-api.ts");
const proxy = read("../app/api/public/[...path]/route.ts");

test("login links to request page, while confirmation remains available", () => {
  assert.ok(login.includes('href="/recuperar-acceso"'));
  assert.ok(!login.includes('href="/reset-password"'));
  assert.ok(page.includes("<RecoveryRequestClient"));
  assert.ok(confirmation.includes("confirmPasswordReset(token, password)"));
});

test("recovery request uses existing JSON same-origin public proxy", () => {
  assert.ok(request.includes("requestPasswordReset(email.trim())"));
  assert.ok(api.includes("publicApiFetch(`/auth/password/reset/request`"));
  assert.ok(api.includes("JSON.stringify({ email })"));
  assert.ok(proxy.includes('"auth/password/reset/request"'));
});

test("no account enumeration, automatic send or token disclosure by UI", () => {
  assert.ok(request.includes("onSubmit={onSubmit}"));
  assert.ok(request.includes("Si existe una cuenta autorizada"));
  assert.ok(!request.includes("email_delivery"));
  assert.ok(!request.includes(".token"));
  assert.ok(!request.includes("raw_token"));
  assert.ok(request.includes("No fue posible procesar la solicitud"));
});
