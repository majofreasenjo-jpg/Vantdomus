"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { confirmPasswordReset } from "../../lib/public-api";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [message, setMessage] = useState(token ? "" : "El enlace no contiene un token de recuperacion.");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setStatus("error");
      setMessage("El enlace no contiene un token de recuperacion.");
      return;
    }
    if (password.length < 10) {
      setStatus("error");
      setMessage("Usa una contrasena de al menos 10 caracteres.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("Las contrasenas no coinciden.");
      return;
    }
    setStatus("saving");
    setMessage("Actualizando credenciales...");
    try {
      await confirmPasswordReset(token, password);
      setStatus("ok");
      setPassword("");
      setConfirm("");
      setMessage("Contrasena actualizada. Las sesiones previas fueron revocadas.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la contrasena.");
    }
  }

  const Icon = status === "saving" ? Loader2 : status === "error" ? ShieldAlert : KeyRound;

  return (
    <main className="grid" style={{ maxWidth: 680, margin: "48px auto" }}>
      <section className="card">
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <Icon
            size={28}
            color={status === "error" ? "var(--bad)" : status === "ok" ? "var(--good)" : "var(--warn)"}
            style={status === "saving" ? { animation: "spin 1s linear infinite" } : undefined}
          />
          <div>
            <div className="cardTitle">Recuperacion de acceso</div>
            <h1 style={{ margin: 0, fontSize: 26 }}>Nueva contrasena</h1>
          </div>
        </div>
        <form className="grid" style={{ marginTop: 18 }} onSubmit={onSubmit}>
          <input
            className="input"
            type="password"
            minLength={10}
            autoComplete="new-password"
            placeholder="Nueva contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <input
            className="input"
            type="password"
            minLength={10}
            autoComplete="new-password"
            placeholder="Confirmar contrasena"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {message ? <p className="small" style={{ color: status === "error" ? "var(--bad)" : "var(--muted)" }}>{message}</p> : null}
          <div className="formRow">
            <button className="btn btnPrimary" type="submit" disabled={status === "saving"}>
              Guardar contrasena
            </button>
            <a className="btn" href="/">
              Volver
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
