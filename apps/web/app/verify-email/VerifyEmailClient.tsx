"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { verifyEmail } from "../../lib/public-api";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Validando enlace seguro...");

  useEffect(() => {
    let active = true;
    if (!token) {
      setState("error");
      setMessage("El enlace no contiene un token de verificacion.");
      return;
    }
    verifyEmail(token)
      .then(() => {
        if (!active) return;
        setState("ok");
        setMessage("Email verificado. Las acciones sensibles quedan habilitadas para esta cuenta.");
      })
      .catch((error) => {
        if (!active) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "No se pudo verificar el email.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const Icon = state === "ok" ? CheckCircle2 : state === "error" ? ShieldAlert : Loader2;

  return (
    <main className="grid" style={{ maxWidth: 680, margin: "48px auto" }}>
      <section className="card">
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <Icon
            size={28}
            color={state === "ok" ? "var(--good)" : state === "error" ? "var(--bad)" : "var(--warn)"}
            style={state === "loading" ? { animation: "spin 1s linear infinite" } : undefined}
          />
          <div>
            <div className="cardTitle">Verificacion de identidad</div>
            <h1 style={{ margin: 0, fontSize: 26 }}>Confirmar email</h1>
          </div>
        </div>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>{message}</p>
        <a className="btn btnPrimary" href="/">
          Volver a VantDomus
        </a>
      </section>
    </main>
  );
}
