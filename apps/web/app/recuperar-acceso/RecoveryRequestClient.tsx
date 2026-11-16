"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { requestPasswordReset } from "../../lib/public-api";
import DomiFaceMark from "../components/domi/DomiFaceMark";

type RecoveryStatus = "idle" | "sending" | "sent" | "error";

/**
 * R95 — Self-service request only. Never receives or displays password-reset
 * tokens, account-existence data, raw provider output or private credentials.
 * Clicking "Enviar enlace" is the owner's explicit email action.
 */
export default function RecoveryRequestClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<RecoveryStatus>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending" || !email.trim()) return;

    setStatus("sending");
    setMessage("");
    try {
      // Existing same-origin public proxy; no query-string email or token.
      await requestPasswordReset(email.trim());
      // Deliberately identical for existing and unknown accounts.
      setStatus("sent");
      setEmail("");
      setMessage("Si existe una cuenta autorizada para ese correo y el envío está disponible, recibirás un enlace para recuperar el acceso. Revisa también la carpeta de spam.");
    } catch {
      // Do not reflect provider or backend account-existence details.
      setStatus("error");
      setMessage("No fue posible procesar la solicitud en este momento. Comprueba tu conexión o inténtalo nuevamente más tarde.");
    }
  }

  return (
    <main style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      padding: 24, fontFamily: "system-ui, sans-serif",
      background: "linear-gradient(135deg, #e2e9ff 0%, #fff1e0 46%, #ffebea 100%)",
    }}>
      <section style={{
        width: "100%", maxWidth: 450, padding: "34px 30px",
        borderRadius: 28, background: "rgba(255,255,255,.86)",
        boxShadow: "0 26px 65px -28px rgba(90,70,120,.45)",
        border: "1px solid rgba(255,255,255,.9)", color: "#26224d",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <DomiFaceMark size={72} />
        </div>
        <h1 style={{ fontSize: 26, margin: "0 0 8px", textAlign: "center" }}>
          Recuperar acceso
        </h1>
        <p style={{ color: "#6b6795", lineHeight: 1.5, textAlign: "center", margin: "0 0 22px" }}>
          Ingresa el correo de tu cuenta de VantDomus. Si está habilitada, recibirás instrucciones privadas para establecer una contraseña.
        </p>

        <form onSubmit={onSubmit}>
          <label htmlFor="domi-recovery-email" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Correo electrónico
          </label>
          <input
            id="domi-recovery-email" type="email" name="email"
            required autoComplete="email" spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={status === "sending"}
            placeholder="tu-correo@ejemplo.com"
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              padding: "13px 15px", borderRadius: 12, fontSize: 15,
              border: "1px solid #d9d4e5", background: "#fff", color: "#26224d",
            }}
          />
          <button type="submit" disabled={status === "sending" || status === "sent"}
            style={{
              width: "100%", marginTop: 15, padding: "13px 18px",
              borderRadius: 13, background: "#f5a623", border: 0,
              color: "#382600", fontSize: 15, fontWeight: 700,
              cursor: status === "sending" || status === "sent" ? "default" : "pointer",
              opacity: status === "sending" ? 0.7 : 1,
            }}>
            {status === "sending" ? "Solicitando..." : status === "sent" ? "Solicitud registrada" : "Enviar enlace de recuperación"}
          </button>
        </form>
        {message && (
          <p role="status" aria-live="polite"
            style={{ marginTop: 16, color: status === "error" ? "#a72b45" : "#355c45", lineHeight: 1.5 }}>
            {message}
          </p>
        )}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/login" style={{ color: "#514b81", fontWeight: 600 }}>
            Volver a iniciar sesión
          </a>
        </div>
        <p style={{ color: "#6b6795", fontSize: 12, textAlign: "center", margin: "22px 0 0" }}>
          No se muestra si una dirección tiene una cuenta registrada.
        </p>
      </section>
    </main>
  );
}
