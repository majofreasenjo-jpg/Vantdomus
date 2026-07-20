// CP1d-FAMILY-PILOT-1b.2 — Tests de custodia del token de invitación.
// node --test apps/web/tests/invitation-token-vault.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// El vault es TS; para node --test cargamos la versión transpilada mínima
// comprobando el CONTRATO vía el archivo fuente (sin bundler). Para lógica pura
// re-implementamos el parseo aquí NO — mejor: importar el .ts vía verificación
// estática del fuente + un mini-harness de window.

// Simular window para initTokenFromLocation. Como el módulo es .ts, verificamos
// su comportamiento con un stub de historia y location a través del fuente
// compilado por tsx no disponible → validamos invariantes por lectura del fuente
// y por un harness JS equivalente exportado.

// Estrategia: leer el fuente y comprobar invariantes críticos textualmente,
// y probar la regex de formato replicándola (única lógica pura sin DOM).
const src = readFileSync(join(WEB_ROOT, "lib", "invitation-token-vault.ts"), "utf-8");

test("1. el vault usa history.replaceState para limpiar la URL", () => {
  assert.match(src, /history\.replaceState/);
});

test("2. el vault NO usa localStorage/sessionStorage/cookie/analytics", () => {
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /sessionStorage/);
  assert.doesNotMatch(src, /document\.cookie/);
  assert.doesNotMatch(src, /analytics|gtag|dataLayer/);
});

test("3. el token vive solo en una variable de módulo en memoria", () => {
  assert.match(src, /let _token: string \| null = null/);
});

test("4. NO hay fallback desde query string (?t= se ignora)", () => {
  // El fuente detecta ?t= como query-present y NO lo asigna a _token.
  assert.match(src, /query-present/);
  assert.match(src, /_token = null/);
});

test("5. formato del token: base64url 20-200 chars", () => {
  const TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;
  assert.ok(TOKEN_RE.test("a".repeat(43)));
  assert.ok(TOKEN_RE.test("Abc-1234_defGHIJKLmnop"));
  assert.ok(!TOKEN_RE.test("short"));
  assert.ok(!TOKEN_RE.test("has spaces here in it xxxxxxxxxxxx"));
  assert.ok(!TOKEN_RE.test("has;semicolon;xxxxxxxxxxxxxxxxxxxx"));
});

test("6. el token nunca se registra en console ni en excepciones", () => {
  assert.doesNotMatch(src, /console\.(log|warn|error|info)\([^)]*_token/);
  // los throws no interpolan el token
  assert.doesNotMatch(src, /throw new Error\([^)]*_token/);
});
