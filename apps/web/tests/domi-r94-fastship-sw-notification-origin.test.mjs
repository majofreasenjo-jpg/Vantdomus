/**
 * DOMI R94-FastShip — Pruebas ADVERSARIALES de conducta del service worker.
 *
 * La prueba 21 de web-hardening comprueba que el CÓDIGO FUENTE contiene
 * `sameOriginPath`. Eso no demuestra que el handler se comporte bien. Aquí se
 * ejecuta `public/sw.js` de verdad dentro de un sandbox `node:vm` con un `self`
 * simulado, se disparan los eventos `push` y `notificationclick` reales y se
 * comprueban dos invariantes de seguridad y privacidad:
 *
 *   1. PRIVACIDAD EN PANTALLA BLOQUEADA — ni el título ni el cuerpo por defecto
 *      pueden revelar información familiar; el detalle vive dentro de la app.
 *   2. NAVEGACIÓN DEL MISMO ORIGEN — un payload manipulado no puede llevar al
 *      usuario fuera de la aplicación al tocar la notificación.
 *
 * No abre sockets, no registra un service worker real y no usa datos reales.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://domi.lab.example.invalid";

/** Carga sw.js en un sandbox y devuelve los handlers + lo que capturó. */
function loadServiceWorker() {
  const source = readFileSync(join(WEB_ROOT, "public", "sw.js"), "utf-8");
  const handlers = {};
  const captured = { notifications: [], navigated: [], opened: [] };

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => {},
    registration: {
      showNotification: (title, options) => {
        captured.notifications.push({ title, options });
        return Promise.resolve();
      },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve([{
        focus: () => Promise.resolve("focused"),
        navigate: url => { captured.navigated.push(url); return Promise.resolve(); },
      }]),
      openWindow: url => { captured.opened.push(url); return Promise.resolve(); },
    },
  };

  const context = vm.createContext({ self, URL, console, Promise });
  new vm.Script(source).runInContext(context);
  return { handlers, captured };
}

/** Dispara el evento `push` con el payload indicado. */
async function dispatchPush(sw, payload) {
  const event = {
    data: payload === undefined ? null : { json: () => payload },
    waitUntil: p => p,
  };
  await sw.handlers.push(event);
  return sw.captured.notifications.at(-1);
}

/** Dispara `notificationclick` con la url almacenada en la notificación. */
async function dispatchClick(sw, storedUrl) {
  const event = {
    notification: { close: () => {}, data: { url: storedUrl } },
    waitUntil: p => p,
  };
  await sw.handlers.notificationclick(event);
  return sw.captured;
}

test("el sw.js se carga y registra los handlers push y notificationclick", () => {
  const sw = loadServiceWorker();
  assert.equal(typeof sw.handlers.push, "function");
  assert.equal(typeof sw.handlers.notificationclick, "function");
});

test("privacidad: sin payload, la notificación es genérica y no revela nada", async () => {
  const sw = loadServiceWorker();
  const n = await dispatchPush(sw, undefined);
  assert.equal(n.title, "VantDomus");
  assert.equal(n.options.body, "Tienes un recordatorio");
  // Nada del contenido por defecto puede parecerse a un dato familiar.
  const visible = `${n.title} ${n.options.body}`;
  for (const leak of ["recordatorio de", "cita", "médico", "colegio", "psicólogo"]) {
    assert.ok(!visible.toLowerCase().includes(leak),
      `el contenido visible no debe incluir "${leak}"`);
  }
});

test("privacidad: el servidor manda contenido genérico y el detalle no viaja", async () => {
  const sw = loadServiceWorker();
  // Lo que el tick endurecido envía realmente.
  const n = await dispatchPush(sw, {
    title: "VantDomus",
    body: "Tienes un recordatorio",
    url: "/recordatorios/hogar-sintetico",
    tag: "reminder-abc123",
  });
  assert.equal(n.title, "VantDomus");
  assert.equal(n.options.body, "Tienes un recordatorio");
  assert.equal(n.options.tag, "reminder-abc123", "tag para deduplicar reenvíos del cron");
  assert.equal(n.options.renotify, false);
});

test("privacidad: un payload con título y cuerpo SENSIBLES nunca llega a la pantalla", async () => {
  // Defensa en profundidad: el backend ya manda genérico, pero el service
  // worker es la última capa antes de la pantalla bloqueada. Un payload
  // manipulado —o un emisor futuro descuidado— no puede filtrar nada.
  const sw = loadServiceWorker();
  const sensible = {
    title: "Cita con el psicólogo de Diego",
    body: "Resultado del examen de Elena: hablar del tratamiento",
    url: "/recordatorios/h1",
    tag: "reminder-xyz",
  };
  const n = await dispatchPush(sw, sensible);
  assert.equal(n.title, "VantDomus", "el título del payload NO puede mostrarse");
  assert.equal(n.options.body, "Tienes un recordatorio", "el cuerpo del payload NO puede mostrarse");
  const visible = JSON.stringify({ title: n.title, body: n.options.body });
  for (const secreto of ["psicólogo", "Diego", "Elena", "examen", "tratamiento"]) {
    assert.ok(!visible.includes(secreto), `no debe filtrarse "${secreto}"`);
  }
  // Lo legítimo del payload se conserva: navegación interna y deduplicación.
  assert.equal(n.options.data.url, "/recordatorios/h1");
  assert.equal(n.options.tag, "reminder-xyz");
});

test("privacidad: un tag no textual se descarta en vez de contaminar la notificación", async () => {
  const sw = loadServiceWorker();
  const n = await dispatchPush(sw, { tag: { secreto: "Elena" }, url: "/x" });
  assert.equal(n.options.tag, undefined);
  assert.equal(n.title, "VantDomus");
  assert.equal(n.options.body, "Tienes un recordatorio");
});

test("navegación: un destino EXTERNO en el payload se degrada a la raíz", async () => {
  const hostiles = [
    "https://evil.example/phish",
    "//evil.example/phish",
    "http://evil.example",
    "https://domi.lab.example.invalid.evil.example/x",
  ];
  for (const hostile of hostiles) {
    const sw = loadServiceWorker();
    const n = await dispatchPush(sw, { url: hostile });
    assert.equal(n.options.data.url, "/", `payload hostil degradado: ${hostile}`);
  }
});

test("navegación: una ruta interna legítima se conserva con query y fragmento", async () => {
  const sw = loadServiceWorker();
  const n = await dispatchPush(sw, { url: "/recordatorios/h1?x=1#y" });
  assert.equal(n.options.data.url, "/recordatorios/h1?x=1#y");
});

test("clic: aunque la notificación guarde un destino externo, se navega a la raíz", async () => {
  const sw = loadServiceWorker();
  const captured = await dispatchClick(sw, "https://evil.example/steal");
  const destinos = [...captured.navigated, ...captured.opened];
  assert.ok(destinos.length > 0, "debe haber intentado navegar");
  for (const d of destinos) {
    assert.equal(d, "/", "el clic nunca puede salir del propio origen");
  }
});

test("clic: una ruta interna se respeta tal cual", async () => {
  const sw = loadServiceWorker();
  const captured = await dispatchClick(sw, "/recordatorios/h1");
  const destinos = [...captured.navigated, ...captured.opened];
  assert.ok(destinos.includes("/recordatorios/h1"));
});
