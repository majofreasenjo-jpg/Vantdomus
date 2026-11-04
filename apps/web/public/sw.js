/* OPS-1 (PWA) — Service worker MÍNIMO.
 *
 * Su único propósito es habilitar la instalabilidad de la PWA. NO cachea páginas
 * ni respuestas: el `fetch` es passthrough (el navegador maneja todo normal), así
 * que NUNCA sirve contenido autenticado/obsoleto ni interfiere con la sesión.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* passthrough: sin caché */
});

/* OPS-2 M7.B — Web Push. Muestra la notificación cuando llega un recordatorio
 * (aunque la app esté cerrada) y, al tocarla, abre/enfoca la app. */
/* M7.B hardening — La navegación que dispara una notificación queda RESTRINGIDA
 * al propio origen. Resuelve la ruta contra self.location.origin y descarta
 * cualquier destino externo: aunque un payload viniera manipulado, el clic nunca
 * puede sacar al usuario de la app. Ante cualquier duda, "/" (fail-safe). */
function sameOriginPath(raw) {
  try {
    const resolved = new URL(String(raw || "/"), self.location.origin);
    if (resolved.origin !== self.location.origin) return "/";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch (_e) {
    return "/";
  }
}

/* PRIVACIDAD EN PANTALLA BLOQUEADA — el texto visible es CONSTANTE y no se
 * puede sobrescribir desde el payload. El backend ya envía contenido genérico,
 * pero esta es la última capa antes de la pantalla: si un payload llegara con
 * título o cuerpo sensibles (manipulado, o un emisor futuro descuidado), NO
 * pueden mostrarse. El detalle del recordatorio vive dentro de la app, tras la
 * sesión. Del payload solo se honran `url` (saneada) y `tag` (deduplicación). */
const NOTIFICATION_TITLE = "VantDomus";
const NOTIFICATION_BODY = "Tienes un recordatorio";

self.addEventListener("push", (event) => {
  let payload = {};
  try { if (event.data) payload = event.data.json() || {}; } catch (_e) { payload = {}; }
  const url = sameOriginPath(payload.url);
  /* `tag` (id del recordatorio): un reenvío del cron REEMPLAZA el aviso
   * anterior en vez de apilar duplicados en la pantalla. */
  const tag = typeof payload.tag === "string" && payload.tag ? payload.tag : undefined;
  event.waitUntil(
    self.registration.showNotification(NOTIFICATION_TITLE, {
      body: NOTIFICATION_BODY,
      icon: "/pwa/icon-192",
      badge: "/pwa/icon-192",
      data: { url },
      tag,
      renotify: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = sameOriginPath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
