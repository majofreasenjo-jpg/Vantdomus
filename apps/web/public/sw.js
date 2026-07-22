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
self.addEventListener("push", (event) => {
  let data = { title: "VantDomus", body: "Tienes un recordatorio", url: "/" };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (_e) { /* payload no-JSON */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "VantDomus", {
      body: data.body || "",
      icon: "/pwa/icon-192",
      badge: "/pwa/icon-192",
      data: { url: data.url || "/" },
      tag: data.tag || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
