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
  const next = params.next || "/dashboard";

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
      </section>
    </main>
  );
}
