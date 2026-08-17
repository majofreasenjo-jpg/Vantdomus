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

self.addEventListener("push", (event) => {
  /* Contenido GENÉRICO por defecto: la notificación se ve en la pantalla
   * bloqueada, así que el detalle del recordatorio vive dentro de la app (tras
   * la sesión), nunca en el aviso. */
  let data = { title: "VantDomus", body: "Tienes un recordatorio", url: "/" };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (_e) { /* payload no-JSON */ }
  const url = sameOriginPath(data.url);
  event.waitUntil(
    self.registration.showNotification(data.title || "VantDomus", {
      body: data.body || "",
      icon: "/pwa/icon-192",
      badge: "/pwa/icon-192",
      data: { url },
      /* `tag` (id del recordatorio): un reenvío del cron REEMPLAZA el aviso
       * anterior en vez de apilar duplicados en la pantalla. */
      tag: data.tag || undefined,
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
