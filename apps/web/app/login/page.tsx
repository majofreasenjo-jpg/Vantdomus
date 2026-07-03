import { Inter, Space_Grotesk } from "next/font/google";
import { loginAction } from "./actions";

// Tipografías de Domi (mismas que la home companion) para coherencia visual.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--vdl-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--vdl-grotesk", display: "swap" });

/**
 * Login reskin (CP1c) — alineado al lenguaje visual de Domi (tema dawn: lavanda
 * → durazno → rosa cálido, acentos ámbar). Autocontenido: estilos scoped `vdl-*`
 * e inline, sin depender del tema oscuro global. Oculta el chrome antiguo en esta
 * ruta. NO toca la home congelada CP1b. Funcionalidad intacta (loginAction,
 * campos email/password/mfa_code/next, OAuth).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params.error || "";
  const email = params.email || "";
  const next = params.next || "/inicio";
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

  return (
    <div id="vantdomus-login" className={`${inter.variable} ${grotesk.variable}`}>
      {/* Oculta el navbar/chrome antiguo solo en esta ruta, como hace la home. */}
      <style>{`
        body:has(#vantdomus-login) .nav,
        body:has(#vantdomus-login) .bottomNav { display: none !important; }
        body:has(#vantdomus-login) .container { max-width: none !important; padding: 0 !important; }
        #vantdomus-login {
          --vdl-ink: #26224d; --vdl-muted: #6b6795;
          font-family: var(--vdl-inter), ui-sans-serif, system-ui, sans-serif;
          position: fixed; inset: 0; overflow: auto;
          display: flex; align-items: center; justify-content: center; padding: 24px;
          background:
            radial-gradient(1100px 640px at 18% 8%, rgba(255,176,136,.35), transparent 55%),
            radial-gradient(900px 620px at 88% 22%, rgba(255,136,176,.28), transparent 55%),
            radial-gradient(1000px 700px at 50% 100%, rgba(255,230,153,.30), transparent 55%),
            linear-gradient(135deg, #E2E9FF 0%, #FFF1E0 46%, #FFEBEA 100%);
        }
        #vantdomus-login .vdl-card {
          width: 100%; max-width: 440px;
          background: rgba(255,255,255,.72);
          -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,.75);
          border-radius: 28px; padding: 34px 30px 30px;
          box-shadow: 0 30px 70px -25px rgba(90,70,120,.45), 0 2px 8px rgba(90,70,120,.08);
        }
        #vantdomus-login .vdl-orb {
          width: 64px; height: 64px; border-radius: 50%; position: relative; margin: 0 auto 16px;
          background: radial-gradient(circle at 35% 30%, #FFF4D6 0%, #F8B84E 42%, #E58A1F 100%);
          box-shadow: 0 0 0 8px rgba(248,184,78,.12), 0 10px 26px rgba(229,138,31,.38);
        }
        #vantdomus-login .vdl-orb::after {
          content: ""; position: absolute; top: 12px; left: 15px; width: 16px; height: 12px;
          border-radius: 50%; background: rgba(255,255,255,.85); filter: blur(1px);
        }
        #vantdomus-login h1 {
          font-family: var(--vdl-grotesk), var(--vdl-inter), sans-serif;
          font-size: 26px; font-weight: 700; color: var(--vdl-ink); margin: 0; text-align: center;
        }
        #vantdomus-login .vdl-sub { text-align: center; color: var(--vdl-muted); font-size: 14px; margin: 6px 0 24px; }
        #vantdomus-login .vdl-input {
          width: 100%; box-sizing: border-box; margin-bottom: 12px;
          padding: 13px 15px; font-size: 15px; color: var(--vdl-ink);
          background: rgba(255,255,255,.78); border: 1px solid rgba(120,110,160,.22);
          border-radius: 14px; outline: none; transition: border-color .18s, box-shadow .18s, background .18s;
        }
        #vantdomus-login .vdl-input::placeholder { color: #9a95bd; }
        #vantdomus-login .vdl-input:focus {
          border-color: rgba(245,158,11,.65); background: #fff;
          box-shadow: 0 0 0 4px rgba(245,158,11,.16);
        }
        #vantdomus-login .vdl-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px 18px; border-radius: 14px; font-size: 15px; font-weight: 600;
          cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: all .18s;
        }
        #vantdomus-login .vdl-primary {
          flex: 1; color: #3b2a06; border: none;
          background: linear-gradient(135deg, #FFD27A 0%, #F8B84E 45%, #F59E0B 100%);
          box-shadow: 0 10px 22px -6px rgba(245,158,11,.55);
        }
        #vantdomus-login .vdl-primary:hover { filter: brightness(1.04); transform: translateY(-1px); }
        #vantdomus-login .vdl-ghost {
          color: var(--vdl-ink); background: rgba(255,255,255,.6);
          border: 1px solid rgba(120,110,160,.22);
        }
        #vantdomus-login .vdl-ghost:hover { background: #fff; }
        #vantdomus-login .vdl-row { display: flex; gap: 10px; margin-top: 4px; }
        #vantdomus-login .vdl-oauth {
          flex: 1; color: var(--vdl-ink); background: rgba(255,255,255,.62);
          border: 1px solid rgba(120,110,160,.20); font-weight: 500;
        }
        #vantdomus-login .vdl-oauth:hover { background: #fff; }
        #vantdomus-login .vdl-sep { display: flex; align-items: center; gap: 12px; margin: 20px 0 14px; color: var(--vdl-muted); font-size: 13px; }
        #vantdomus-login .vdl-sep span.line { flex: 1; height: 1px; background: rgba(120,110,160,.22); }
        #vantdomus-login .vdl-error {
          background: rgba(251,113,133,.14); color: #b1244a; border: 1px solid rgba(251,113,133,.35);
          border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 12px; text-align: center;
        }
        #vantdomus-login .vdl-safe { text-align: center; color: var(--vdl-muted); font-size: 12px; margin-top: 18px; }
      `}</style>

      <section className="vdl-card">
        <div className="vdl-orb" aria-hidden="true" />
        <h1>Entrar a VantDomus</h1>
        <p className="vdl-sub">Tu hogar, en calma y conexión 💛</p>

        <form action={loginAction}>
          <input type="hidden" name="next" value={next} />
          {error ? <div className="vdl-error">{error}</div> : null}
          <input className="vdl-input" name="email" type="email" autoComplete="email" placeholder="Correo" defaultValue={email} />
          <input className="vdl-input" name="password" type="password" autoComplete="current-password" placeholder="Contraseña" />
          <input className="vdl-input" name="mfa_code" inputMode="numeric" autoComplete="one-time-code" placeholder="Código MFA, si aplica" />
          <div className="vdl-row">
            <button className="vdl-btn vdl-primary" type="submit">Entrar</button>
            <a className="vdl-btn vdl-ghost" href="/reset-password">Recuperar acceso</a>
          </div>
        </form>

        <div className="vdl-sep"><span className="line" />o<span className="line" /></div>
        <div className="vdl-row">
          <a className="vdl-btn vdl-oauth" href={`${apiBase}/auth/oauth/google/start`}>Continuar con Google</a>
          <a className="vdl-btn vdl-oauth" href={`${apiBase}/auth/oauth/facebook/start`}>Continuar con Facebook</a>
        </div>

        <p className="vdl-safe">🔒 Acceso seguro · Tus datos son tuyos</p>
      </section>
    </div>
  );
}
