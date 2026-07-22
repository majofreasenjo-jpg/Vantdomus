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


// CP1d-1b.2 — proxy público: allowlist exacta y register-with-invitation.
test("8. proxy público allowlist incluye register-with-invitation y NADA de wildcard", () => {
  const route = readFileSync(join(WEB_ROOT, "app", "api", "public", "[...path]", "route.ts"), "utf-8");
  assert.match(route, /auth\/register-with-invitation/);
  // No agregar rutas peligrosas
  assert.doesNotMatch(route, /ALLOWED_PUBLIC_PATHS[\s\S]*households/);
  assert.doesNotMatch(route, /ALLOWED_PUBLIC_PATHS[\s\S]*"\*"/);
  assert.doesNotMatch(route, /ALLOWED_PUBLIC_PATHS[\s\S]*guardians/);
  assert.doesNotMatch(route, /ALLOWED_PUBLIC_PATHS[\s\S]*"auth\/register"[,\s]/);
});

test("9. /invitacion page declara noindex + dynamic no-cache", () => {
  const page = readFileSync(join(WEB_ROOT, "app", "invitacion", "page.tsx"), "utf-8");
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
  assert.match(page, /force-dynamic/);
});

test("10. login oculta OAuth en cualquier perfil familiar (pilot o live)", () => {
  const login = readFileSync(join(WEB_ROOT, "app", "login", "page.tsx"), "utf-8");
  assert.match(login, /oauthVisible/);
  assert.match(login, /isFamilyProfileEnv/);
});

// OPS-1 — family-live hereda blindaje: cookies Secure + perfil familiar cerrado.
test("11. runtimeEnv: family-live lleva cookies Secure y es perfil familiar", async () => {
  const mod = await import(pathToFileURL(join(WEB_ROOT, "lib", "runtimeEnv.js")).href);
  for (const env of ["family-live", "family_live", "familylive"]) {
    assert.equal(mod.cookieSecure(env), true, `${env} debe llevar cookies Secure`);
    assert.equal(mod.isFamilyProfileEnv(env), true, `${env} debe ser perfil familiar`);
  }
  // family-pilot sigue siéndolo; local NO.
  assert.equal(mod.isFamilyProfileEnv("family-pilot"), true);
  assert.equal(mod.isFamilyProfileEnv("local"), false);
  assert.equal(mod.cookieSecure("local"), false);
});

// OPS-1 (PWA) — instalable en móvil + geolocalización habilitada para el clima.
test("12. PWA: manifest standalone + iconos 192/512, sw.js y apple-web-app", () => {
  const manifest = readFileSync(join(WEB_ROOT, "app", "manifest.ts"), "utf-8");
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /icon-192/);
  assert.match(manifest, /icon-512/);
  assert.match(manifest, /maskable/);
  const sw = readFileSync(join(WEB_ROOT, "public", "sw.js"), "utf-8");
  assert.match(sw, /addEventListener\("fetch"/);
  const layout = readFileSync(join(WEB_ROOT, "app", "layout.tsx"), "utf-8");
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /themeColor/);
  assert.match(layout, /PwaRegister/);
  // El robots noindex NO se pierde al agregar la PWA.
  assert.match(layout, /index:\s*false/);
});

test("13. Permissions-Policy: geolocation y microphone=(self); cámara off", () => {
  const cfg = readFileSync(join(WEB_ROOT, "next.config.js"), "utf-8");
  assert.match(cfg, /geolocation=\(self\)/);
  assert.match(cfg, /microphone=\(self\)/); // M4 voz
  assert.match(cfg, /camera=\(\)/);         // cámara sigue off
});

// OPS-2 M5 — Modos de Domi con gate Senior real.
test("14. Modos: setDomiModeAction + DOMI_MODES(senior) + CSS Senior + ModeSwitcher", () => {
  const actions = readFileSync(join(WEB_ROOT, "app", "login", "actions.ts"), "utf-8");
  assert.match(actions, /setDomiModeAction/);
  assert.match(actions, /DOMI_MODES/);
  assert.match(actions, /"senior"/);
  const css = readFileSync(join(WEB_ROOT, "app", "globals.css"), "utf-8");
  assert.match(css, /\[data-mode="senior"\]/);   // gate de accesibilidad real
  assert.match(css, /min-height:\s*48px/);        // objetivo táctil grande
  const layout = readFileSync(join(WEB_ROOT, "app", "layout.tsx"), "utf-8");
  assert.match(layout, /data-mode/);
  assert.match(layout, /ModeSwitcher/);
});

// OPS-2 M7.A — Recordatorios programables + campana in-app (entrega pull).
test("15. Recordatorios: cliente API + componente + integración en /recordatorios", () => {
  const api = readFileSync(join(WEB_ROOT, "lib", "api.ts"), "utf-8");
  assert.match(api, /listReminders/);
  assert.match(api, /createReminder/);
  assert.match(api, /dismissReminder/);
  assert.match(api, /\/assistant\/reminders/);
  const comp = readFileSync(join(WEB_ROOT, "app", "components", "Recordatorios.tsx"), "utf-8");
  assert.match(comp, /createReminder/);
  assert.match(comp, /dismissReminder/);
  const page = readFileSync(join(WEB_ROOT, "app", "recordatorios", "[householdId]", "page.tsx"), "utf-8");
  assert.match(page, /Recordatorios/);
});

// OPS-2 M7.B — Web Push: service worker con handlers + cliente + toggle fail-closed.
test("16. Web Push: sw.js push/notificationclick + cliente + PushToggle", () => {
  const sw = readFileSync(join(WEB_ROOT, "public", "sw.js"), "utf-8");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.match(sw, /showNotification/);
  const api = readFileSync(join(WEB_ROOT, "lib", "api.ts"), "utf-8");
  assert.match(api, /getPushConfig/);
  assert.match(api, /subscribePush/);
  assert.match(api, /unsubscribePush/);
  const toggle = readFileSync(join(WEB_ROOT, "app", "components", "PushToggle.tsx"), "utf-8");
  assert.match(toggle, /applicationServerKey/);
  assert.match(toggle, /if \(!supported\(\) \|\| !enabled\) return null/); // fail-closed
});
