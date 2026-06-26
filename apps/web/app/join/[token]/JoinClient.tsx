"use client";

/**
 * JoinClient — acepta una invitación al hogar (requiere sesión iniciada).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptHouseholdInvitation } from "../../../lib/api";
import DomiOrb from "../../components/DomiOrb";

export default function JoinClient({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function accept() {
    setBusy(true); setMsg(null);
    try {
      const res = await acceptHouseholdInvitation(token);
      const hid = res?.household_id;
      setMsg("¡Listo! Te uniste al hogar.");
      router.push(hid ? `/hogar/${hid}` : "/dashboard");
    } catch {
      setMsg("No se pudo aceptar la invitación. Verifica que iniciaste sesión y que el enlace siga vigente.");
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <div className="row" style={{ justifyContent: "center", marginBottom: 12 }}>
          <DomiOrb state="cariñoso" size={88} showChips={false} />
        </div>
        <div className="big" style={{ fontSize: 24 }}>Te invitaron a un hogar en VantDomus</div>
        <p className="small" style={{ marginTop: 8 }}>
          Acepta para unirte y ver lo que la familia comparte contigo. Si no iniciaste sesión, hazlo primero.
        </p>
        {msg ? <div className="small" style={{ margin: "10px 0", color: "var(--muted)" }}>{msg}</div> : null}
        <div className="formRow" style={{ justifyContent: "center", marginTop: 14 }}>
          <a className="btn" href="/login">Iniciar sesión</a>
          <button className="btn btnPrimary" onClick={accept} disabled={busy}>Unirme al hogar</button>
        </div>
      </div>
    </div>
  );
}
