// OPS-1 (PWA) — Manifest de VantDomus Hogar. Next lo sirve en /manifest.webmanifest
// e inyecta <link rel="manifest">. Hace la app instalable en iPhone y Android
// ("Agregar a pantalla de inicio"), en pantalla completa.
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VantDomus Hogar",
    short_name: "VantDomus",
    description:
      "Tu hogar, en calma y conexión. Domi organiza el estudio, las compras y los documentos, y mantiene conectada a la familia.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a1330",
    theme_color: "#F59E3C",
    lang: "es",
    icons: [
      { src: "/pwa/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
