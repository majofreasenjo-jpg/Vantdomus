"use client";

// OPS-1 (PWA) — Registra el service worker mínimo (habilita instalabilidad en
// Android/Chrome). En iPhone la instalación es manual ("Compartir → Agregar a
// pantalla de inicio") y no requiere SW, pero registrarlo no molesta.
import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* si falla el registro, la app sigue funcionando igual */
      });
    }
  }, []);
  return null;
}
