"use client";

// CP1d-FAMILY-PILOT-1b.2 — Cliente de la página /invitacion.
// Custodia del token por fragmento (ver lib/invitation-token-vault). Estados
// anti-enumeración. Sin exponer hogar/persona/banda/rol/guardián antes de
// aceptar. Alta de cuenta nueva vía proxy público; aceptación con cuenta
// existente vía proxy autenticado con el token en el BODY.

import { useEffect, useState } from "react";
import DomiFaceMark from "../components/domi/DomiFaceMark";
import { CSRF_HEADER, browserCsrfToken } from "../../lib/csrf";
import { clearToken, hasToken, initTokenFromLocation, withToken } from "../../lib/invitation-token-vault";

type Stage =
  | "init"
  | "no-link"
  | "ready-new"
  | "submitting"
  | "unusable"
  | "account-exists"
  | "rate-limited"
  | "network"
  | "done-new"
  | "done-existing"
  | "has-session";

// Mensaje público ÚNICO para expirado/revocado/usado/inválido/email-mismatch/
// política denegada: no distingue la causa (anti-enumeración).
const UNUSABLE_MSG =
  "Este enlace no puede utilizarse. Pide una nueva invitación a la persona que administra tu hogar.";

export default function InvitationClient() {
  const [stage, setStage] = useState<Stage>("init");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [supervisedOk, setSupervisedOk] = useState(false);
  const [formError, setFormError] = useState("");

  // 1) Al montar: extraer token del fragmento y limpiar la URL antes de todo.
  useEffect(() => {
    const state = initTokenFromLocation();
    if (state === "ready") {
      // Comprobar si ya hay sesión (llamada autenticada sin token).
      checkSession();
    } else {
      setStage("no-link"); // query-present o absent → enlace no utilizable
    }
    return () => clearToken(); // desmontaje: borrar token de memoria
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSession() {
    try {
      const res = await fetch("/api/proxy/households", { cache: "no-store" });
      if (res.ok) {
        setStage("has-session");
      } else {
        setStage("ready-new");
      }
    } catch {
      setStage("ready-new");
    }
  }

  function mapStatusToStage(status: number): Stage {
    if (status === 409) return "account-exists";
    if (status === 429) return "rate-limited";
    // 400/403/404/410 y política denegada → mensaje único anti-enumeración.
    return "unusable";
  }

  async function submitNewAccount(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!email.trim() || !password || !confirm) {
      setFormError("Completa todos los campos.");
      return;
    }
    if (password !== confirm) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 10) {
      setFormError("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    if (!hasToken()) {
      setStage("no-link");
      return;
    }
    setStage("submitting");
    try {
      const status = await withToken(async (token) => {
        const res = await fetch("/api/public/auth/register-with-invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ token, email: email.trim(), password }),
        });
        return res.status;
      });
      if (status === 200) {
        clearToken();
        setPassword("");
        setConfirm("");
        setStage("done-new");
      } else {
        setStage(mapStatusToStage(status));
      }
    } catch {
      setStage("network");
    }
  }

  async function acceptWithSession() {
    if (!hasToken()) {
      setStage("no-link");
      return;
    }
    setStage("submitting");
    try {
      const status = await withToken(async (token) => {
        const res = await fetch("/api/proxy/households/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json", [CSRF_HEADER]: browserCsrfToken() },
          cache: "no-store",
          body: JSON.stringify({ token }),
        });
        return res.status;
      }, { clearAfter: true });
      if (status === 200) {
        setStage("done-existing");
      } else {
        setStage(mapStatusToStage(status));
      }
    } catch {
      setStage("network");
    }
  }

  return (
    <div id="vantdomus-invite">
      <style>{styles}</style>
      <section className="vdi-card" role="main" aria-live="polite">
        <div className="vdi-orb" aria-hidden="true"><DomiFaceMark size={82} /></div>
        <h1>Te dieron la bienvenida a tu hogar</h1>

        {stage === "init" && <p className="vdi-sub">Un momento…</p>}

        {(stage === "no-link" || stage === "unusable") && (
          <p className="vdi-msg vdi-warn">{UNUSABLE_MSG}</p>
        )}

        {stage === "account-exists" && (
          <>
            <p className="vdi-msg">Ya tienes una cuenta con ese correo.</p>
            <p className="vdi-sub">Inicia sesión y acepta la invitación desde tu cuenta.</p>
            <a className="vdi-btn vdi-primary" href="/login">Ir a iniciar sesión</a>
          </>
        )}

        {stage === "rate-limited" && (
          <p className="vdi-msg vdi-warn">Demasiados intentos. Espera unos minutos e inténtalo de nuevo.</p>
        )}

        {stage === "network" && (
          <>
            <p className="vdi-msg vdi-warn">No pudimos completarlo ahora. Revisa tu conexión.</p>
            <button className="vdi-btn vdi-ghost" onClick={() => setStage("ready-new")}>Reintentar</button>
          </>
        )}

        {stage === "ready-new" && (
          <form onSubmit={submitNewAccount} noValidate>
            <p className="vdi-sub">Crea tu acceso personal. Solo tú conocerás tu contraseña.</p>
            {formError ? <div className="vdi-error" role="alert">{formError}</div> : null}
            <label className="vdi-label" htmlFor="vdi-email">Correo</label>
            <input id="vdi-email" className="vdi-input" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="vdi-label" htmlFor="vdi-pass">Contraseña</label>
            <input id="vdi-pass" className="vdi-input" type="password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <label className="vdi-label" htmlFor="vdi-conf">Confirmar contraseña</label>
            <input id="vdi-conf" className="vdi-input" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <label className="vdi-check">
              <input type="checkbox" checked={supervisedOk} onChange={(e) => setSupervisedOk(e.target.checked)} />
              <span>Acepto que este acceso puede estar acompañado por un adulto del hogar.</span>
            </label>
            <button className="vdi-btn vdi-primary" type="submit" disabled={!supervisedOk}>Crear mi acceso</button>
            <p className="vdi-hint">
              ¿Ya tienes cuenta?{" "}
              <a href="/login" target="_blank" rel="noopener noreferrer">Inicia sesión en otra pestaña</a>{" "}
              y vuelve aquí.
            </p>
            <button type="button" className="vdi-btn vdi-ghost" onClick={checkSession}>Ya inicié sesión</button>
          </form>
        )}

        {stage === "has-session" && (
          <>
            <p className="vdi-sub">Ya tienes una sesión abierta.</p>
            <button className="vdi-btn vdi-primary" onClick={acceptWithSession}>Aceptar invitación con mi cuenta</button>
            <p className="vdi-hint">
              ¿No eres tú? Cierra sesión e ingresa con tu propia cuenta antes de aceptar.
            </p>
          </>
        )}

        {stage === "submitting" && <p className="vdi-sub">Enviando…</p>}

        {stage === "done-new" && (
          <>
            <p className="vdi-msg vdi-ok">¡Tu acceso quedó creado! 💛</p>
            <p className="vdi-sub">Ya puedes entrar a tu hogar.</p>
            <a className="vdi-btn vdi-primary" href="/login">Entrar</a>
          </>
        )}

        {stage === "done-existing" && (
          <>
            <p className="vdi-msg vdi-ok">¡Listo! Te uniste a tu hogar. 💛</p>
            <a className="vdi-btn vdi-primary" href="/inicio">Ir a mi hogar</a>
          </>
        )}

        <p className="vdi-safe">🔒 Acceso seguro · Tus datos son tuyos</p>
      </section>
    </div>
  );
}

const styles = `
  body:has(#vantdomus-invite) .nav,
  body:has(#vantdomus-invite) .bottomNav { display: none !important; }
  body:has(#vantdomus-invite) .container { max-width: none !important; padding: 0 !important; }
  #vantdomus-invite {
    --vdi-ink: #26224d; --vdi-muted: #6b6795;
    font-family: ui-sans-serif, system-ui, sans-serif;
    position: fixed; inset: 0; overflow: auto;
    display: flex; align-items: center; justify-content: center; padding: 24px;
    background:
      radial-gradient(1100px 640px at 18% 8%, rgba(255,176,136,.35), transparent 55%),
      radial-gradient(900px 620px at 88% 22%, rgba(255,136,176,.28), transparent 55%),
      radial-gradient(1000px 700px at 50% 100%, rgba(255,230,153,.30), transparent 55%),
      linear-gradient(135deg, #E2E9FF 0%, #FFF1E0 46%, #FFEBEA 100%);
  }
  #vantdomus-invite .vdi-card {
    width: 100%; max-width: 440px;
    background: rgba(255,255,255,.74);
    -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,.75);
    border-radius: 28px; padding: 32px 28px 26px;
    box-shadow: 0 30px 70px -25px rgba(90,70,120,.45), 0 2px 8px rgba(90,70,120,.08);
    text-align: center;
  }
  #vantdomus-invite .vdi-orb { display: flex; justify-content: center; margin-bottom: 12px; }
  #vantdomus-invite h1 { font-size: 22px; font-weight: 700; color: var(--vdi-ink); margin: 0 0 6px; }
  #vantdomus-invite .vdi-sub { color: var(--vdi-muted); font-size: 14px; margin: 6px 0 18px; }
  #vantdomus-invite .vdi-msg { color: var(--vdi-ink); font-size: 15px; font-weight: 600; margin: 10px 0; }
  #vantdomus-invite .vdi-warn { color: #b1244a; }
  #vantdomus-invite .vdi-ok { color: #1c7a4a; }
  #vantdomus-invite .vdi-hint { color: var(--vdi-muted); font-size: 12px; margin-top: 12px; }
  #vantdomus-invite form { text-align: left; }
  #vantdomus-invite .vdi-label { display: block; font-size: 13px; color: var(--vdi-muted); margin: 10px 0 4px; }
  #vantdomus-invite .vdi-input {
    width: 100%; box-sizing: border-box; padding: 12px 14px; font-size: 15px; color: var(--vdi-ink);
    background: rgba(255,255,255,.82); border: 1px solid rgba(120,110,160,.22);
    border-radius: 13px; outline: none; transition: border-color .18s, box-shadow .18s;
  }
  #vantdomus-invite .vdi-input:focus { border-color: rgba(245,158,11,.65); box-shadow: 0 0 0 4px rgba(245,158,11,.16); background:#fff; }
  #vantdomus-invite .vdi-check { display: flex; gap: 9px; align-items: flex-start; margin: 16px 0 8px; font-size: 13px; color: var(--vdi-ink); }
  #vantdomus-invite .vdi-check input { margin-top: 2px; }
  #vantdomus-invite .vdi-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 100%; box-sizing: border-box; margin-top: 12px;
    padding: 13px 18px; border-radius: 14px; font-size: 15px; font-weight: 600;
    cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: all .18s;
  }
  #vantdomus-invite .vdi-primary { color: #3b2a06; border: none;
    background: linear-gradient(135deg, #FFD27A 0%, #F8B84E 45%, #F59E0B 100%);
    box-shadow: 0 10px 22px -6px rgba(245,158,11,.55); }
  #vantdomus-invite .vdi-primary:disabled { opacity: .55; cursor: not-allowed; }
  #vantdomus-invite .vdi-ghost { color: var(--vdi-ink); background: rgba(255,255,255,.6); border: 1px solid rgba(120,110,160,.22); }
  #vantdomus-invite .vdi-error { background: rgba(251,113,133,.14); color: #b1244a; border: 1px solid rgba(251,113,133,.35); border-radius: 12px; padding: 10px 14px; font-size: 13px; margin: 8px 0; }
  #vantdomus-invite .vdi-safe { color: var(--vdi-muted); font-size: 12px; margin-top: 18px; }
`;
