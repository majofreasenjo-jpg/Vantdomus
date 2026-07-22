"use client";

/**
 * OPS-2 M7.B — Activar avisos push en ESTE dispositivo.
 *
 * Solo aparece si el backend reporta el push habilitado (llaves VAPID puestas).
 * Pide permiso al navegador, se suscribe con la clave pública VAPID y registra
 * la suscripción en el backend. Si algo falta, no muestra nada (fail-closed):
 * los recordatorios siguen avisando dentro de la app (M7.A).
 */
import { useEffect, useState } from "react";
import { getPushConfig, subscribePush, unsubscribePush } from "../../lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function supported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export default function PushToggle({ hid }: { hid: string }) {
  const [enabled, setEnabled] = useState(false);   // backend habilitado
  const [publicKey, setPublicKey] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported()) return;
      try {
        const cfg = (await getPushConfig(hid)) as { enabled?: boolean; public_key?: string };
        if (!alive) return;
        setEnabled(!!cfg?.enabled && !!cfg?.public_key);
        setPublicKey(cfg?.public_key || "");
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (alive) setSubscribed(!!sub);
      } catch { /* silencioso */ }
    })();
    return () => { alive = false; };
  }, [hid]);

  async function enable() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setNote("Necesito tu permiso para enviarte avisos."); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await subscribePush({
        household_id: hid,
        endpoint: json.endpoint || "",
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
      });
      setSubscribed(true);
      setNote("Listo. Este dispositivo recibirá tus recordatorios.");
    } catch {
      setNote("No se pudo activar el aviso en este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await unsubscribePush({ household_id: hid, endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setNote("Ya no recibirás avisos en este dispositivo.");
    } catch {
      setNote("No se pudo desactivar.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported() || !enabled) return null; // fail-closed: nada que mostrar

  return (
    <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 20 }}>📲</span>
      <span style={{ flex: 1, minWidth: 160 }}>
        <span style={{ fontWeight: 700 }}>Avisos en este dispositivo</span>
        <span className="small" style={{ display: "block", color: "var(--muted)" }}>
          {subscribed ? "Activados: te avisaré aunque la app esté cerrada." : "Recibe tus recordatorios como notificación."}
        </span>
      </span>
      {subscribed ? (
        <button className="btn" style={{ cursor: "pointer" }} disabled={busy} onClick={disable}>Desactivar</button>
      ) : (
        <button className="btn primary" style={{ cursor: "pointer" }} disabled={busy} onClick={enable}>
          {busy ? "Activando…" : "Activar avisos"}
        </button>
      )}
      {note ? <div className="small" style={{ width: "100%", color: "var(--muted)" }}>{note}</div> : null}
    </div>
  );
}
