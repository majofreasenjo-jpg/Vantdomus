// CP1d-FAMILY-PILOT-1a-DEPLOY-PREFLIGHT — cookies Secure por entorno.
// Ejecutar con: node --test apps/web/tests/  (sin red, sin Next, sin build)
import test from "node:test";
import assert from "node:assert/strict";
import { cookieSecure, resolveAppEnv } from "../lib/runtimeEnv.js";

test("entornos de desarrollo local NO fuerzan Secure (http://localhost)", () => {
  for (const env of ["local", "dev", "development", "demo", "test"]) {
    assert.equal(cookieSecure(env), false, `esperaba Secure=false en ${env}`);
  }
});

test("family-pilot ES online: cookies Secure obligatorias", () => {
  assert.equal(cookieSecure("family-pilot"), true);
  assert.equal(cookieSecure("FAMILY-PILOT"), true);
  assert.equal(cookieSecure(" family-pilot "), true);
  assert.equal(cookieSecure("family_pilot"), true);
});

test("production/staging conservan Secure (sin debilitar)", () => {
  for (const env of ["production", "prod", "staging"]) {
    assert.equal(cookieSecure(env), true, `esperaba Secure=true en ${env}`);
  }
});

test("resolveAppEnv usa process.env y default local", () => {
  const prev = process.env.APP_ENV;
  try {
    delete process.env.APP_ENV;
    delete process.env.VANTDOMUS_DEPLOY_ENV;
    assert.equal(resolveAppEnv(), "local");
    process.env.APP_ENV = "family-pilot";
    assert.equal(resolveAppEnv(), "family-pilot");
    assert.equal(cookieSecure(), true);
  } finally {
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  }
});
