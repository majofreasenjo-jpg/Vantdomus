import { ShieldCheck } from "lucide-react";
import { loginAction } from "./actions";

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
    <main className="grid" style={{ maxWidth: 680, margin: "48px auto" }}>
      <section className="card">
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <ShieldCheck size={30} color="var(--good)" />
          <div>
            <div className="cardTitle">Acceso seguro</div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Entrar a VantDomus</h1>
          </div>
        </div>
        <form className="grid" action={loginAction} style={{ marginTop: 18 }}>
          <input type="hidden" name="next" value={next} />
          <input className="input" name="email" type="email" autoComplete="email" placeholder="Email" defaultValue={email} />
          <input className="input" name="password" type="password" autoComplete="current-password" placeholder="Contrasena" />
          <input className="input" name="mfa_code" inputMode="numeric" autoComplete="one-time-code" placeholder="Codigo MFA, si aplica" />
          {error ? <div className="pill bad" style={{ width: "fit-content" }}>{error}</div> : null}
          <div className="formRow">
            <button className="btn btnPrimary" type="submit">Entrar</button>
            <a className="btn" href="/reset-password">Recuperar acceso</a>
          </div>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px", color: "var(--muted)" }}>
          <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span className="small">o</span>
          <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>
        <div className="formRow">
          <a className="btn" href={`${apiBase}/auth/oauth/google/start`} style={{ flex: 1, justifyContent: "center" }}>
            Continuar con Google
          </a>
          <a className="btn" href={`${apiBase}/auth/oauth/facebook/start`} style={{ flex: 1, justifyContent: "center" }}>
            Continuar con Facebook
          </a>
        </div>
      </section>
    </main>
  );
}
