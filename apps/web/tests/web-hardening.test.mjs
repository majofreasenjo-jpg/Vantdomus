// CP1d-FAMILY-PILOT-WEB-HARDENING — noindex global + puerta de entrada.
// Ejecutar con: node --test apps/web/tests/  (sin red, sin build)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("1. next.config aplica X-Robots-Tag noindex a TODA la superficie (/:path*)", async () => {
  const module_ = await import(pathToFileURL(join(WEB_ROOT, "next.config.js")).href);
  const config = module_.default;
  const headerGroups = await config.headers();
  const global = headerGroups.find((g) => g.source === "/:path*");
  assert.ok(global, "debe existir el grupo global /:path*");
  const robots = global.headers.find((h) => h.key === "X-Robots-Tag");
  assert.ok(robots, "el grupo global debe incluir X-Robots-Tag");
  assert.equal(robots.value, "noindex, nofollow, noarchive");
});

test("2. layout raíz declara metadata robots noindex (incluye googleBot)", () => {
  const layout = readFileSync(join(WEB_ROOT, "app", "layout.tsx"), "utf-8");
  assert.match(layout, /export const metadata/, "layout debe exportar metadata");
  assert.match(layout, /robots:\s*\{/, "metadata debe declarar robots");
  assert.match(layout, /index:\s*false/, "robots.index debe ser false");
  assert.match(layout, /follow:\s*false/, "robots.follow debe ser false");
  assert.match(layout, /nocache:\s*true/, "robots.nocache debe ser true");
  assert.match(layout, /googleBot:\s*\{/, "debe declarar googleBot");
  assert.match(layout, /noimageindex:\s*true/, "googleBot.noimageindex debe ser true");
});

test("3. robots.txt mantiene Disallow total", () => {
  const robots = readFileSync(join(WEB_ROOT, "public", "robots.txt"), "utf-8");
  assert.match(robots, /User-agent:\s*\*/);
  assert.match(robots, /Disallow:\s*\/\s*$/m);
});

test("4-5. / ya no entrega la portada legacy y redirige a /login", () => {
  const page = readFileSync(join(WEB_ROOT, "app", "page.tsx"), "utf-8");
  assert.doesNotMatch(page, /VantDomus v0\.4/, "sin titulo legacy");
  assert.doesNotMatch(page, /Planificador de Unidades/, "sin subtitulo legacy");
  assert.doesNotMatch(page, /Abrir Dashboard/, "sin boton legacy de dashboard");
  assert.match(page, /redirect\("\/login"\)/, "la raiz debe redirigir a /login");
});

test("6. /login sigue existiendo con su formulario", () => {
  const login = readFileSync(join(WEB_ROOT, "app", "login", "page.tsx"), "utf-8");
  assert.ok(login.length > 0);
  assert.match(login, /login/i);
});

test("7. cookies y proxy NO se modificaron en este bloque", () => {
  const runtimeEnv = readFileSync(join(WEB_ROOT, "lib", "runtimeEnv.js"), "utf-8");
  assert.match(runtimeEnv, /family-pilot/, "cookieSecure conserva family-pilot");
  const actions = readFileSync(join(WEB_ROOT, "app", "login", "actions.ts"), "utf-8");
  assert.match(actions, /secure:\s*cookieSecure\(\)/, "login sigue usando cookieSecure");
  const proxy = readFileSync(join(WEB_ROOT, "app", "api", "public", "[...path]", "route.ts"), "utf-8");
  assert.match(proxy, /ALLOWED_PUBLIC_PATHS/, "proxy publico conserva su allowlist");
});
