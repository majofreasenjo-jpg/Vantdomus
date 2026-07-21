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
