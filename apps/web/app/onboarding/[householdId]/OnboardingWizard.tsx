"use client";

/**
 * OnboardingWizard — primer arranque cálido que termina en invitar a la familia.
 * Pasos: bienvenida + nombre del hogar → agregar integrantes (con avatar) →
 * qué organiza VantDomus → invitar / abrir el hogar. Escape: familia de muestra.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateHouseholdProfile, createPerson, personUpdate,
  seedDemoHomeV2, createHouseholdInvitation,
} from "../../../lib/api";
import DomiOrb from "../../components/DomiOrb";
import { AVATAR_PRESETS, emojiAvatar } from "../../../lib/avatars";
import { memberColor, initials } from "../../../lib/memberColor";

type NewMember = { name: string; relation: string; avatar: string };

const RELATIONS = ["Madre", "Padre", "Hijo", "Hija", "Abuela", "Abuelo", "Cuidador/a", "Otro"];

export default function OnboardingWizard({ hid, initialName }: { hid: string; initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState(initialName || "");
  const [members, setMembers] = useState<NewMember[]>([]);
  const [mName, setMName] = useState("");
  const [mRel, setMRel] = useState("Madre");
  const [mAvatar, setMAvatar] = useState(AVATAR_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  async function saveName() {
    const n = familyName.trim();
    if (!n) { setStep(2); return; }
    setBusy(true);
    try { await updateHouseholdProfile(hid, { family_name: n, industry_preset: "family" }); } catch {}
    setBusy(false); setStep(2);
  }

  function addMemberLocal() {
    const n = mName.trim();
    if (!n) return;
    setMembers((prev) => [...prev, { name: n, relation: mRel, avatar: mAvatar }]);
    setMName(""); setMAvatar(AVATAR_PRESETS[(members.length + 1) % AVATAR_PRESETS.length]);
  }

  async function saveMembers() {
    setBusy(true); setMsg(null);
    try {
      for (const m of members) {
        const res = await createPerson(hid, m.name, m.relation);
        const pid = res?.id;
        if (pid && m.avatar) {
          try { await personUpdate(pid, { avatar: emojiAvatar(m.avatar) }); } catch {}
        }
      }
      setStep(3);
    } catch {
      setMsg("No se pudieron guardar todos los integrantes. Puedes seguir y agregarlos luego en Perfiles.");
      setStep(3);
    } finally { setBusy(false); }
  }

  async function useSample() {
    setBusy(true); setMsg(null);
    try {
      await updateHouseholdProfile(hid, { industry_preset: "family" });
      await seedDemoHomeV2(hid);
      router.push(`/hogar/${hid}`);
    } catch {
      setMsg("No se pudo cargar la familia de muestra.");
      setBusy(false);
    }
  }

  async function makeInvite() {
    const email = inviteEmail.trim();
    if (!email) { setMsg("Escribe el correo de quien quieres invitar."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await createHouseholdInvitation(hid, { email, role: "member", ttl_hours: 168 });
      const token = res?.token;
      if (token) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setInviteLink(`${origin}/join/${token}`);
      } else {
        setMsg("Invitación creada. Revisa Ajustes → Integrantes para el enlace.");
      }
    } catch {
      setMsg("Las invitaciones por correo requieren verificar tu email primero (Ajustes → Seguridad). Por ahora puedes seguir y agregar integrantes manualmente.");
    } finally { setBusy(false); }
  }

  const finish = () => router.push(`/hogar/${hid}`);

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="row" style={{ justifyContent: "center", marginBottom: 6 }}>
        <DomiOrb state={step >= 4 ? "logro" : "sereno"} size={96} showChips={false} />
      </div>
      <div className="small" style={{ textAlign: "center", color: "var(--muted)", marginBottom: 18 }}>
        Paso {Math.min(step, 4)} de 4
      </div>

      {step === 1 ? (
        <div className="card" style={{ padding: 22 }}>
          <div className="big" style={{ fontSize: 26 }}>¡Bienvenido a VantDomus Hogar! 👋</div>
          <p className="small" style={{ marginTop: 8 }}>
            Soy Domi. Te ayudo a ordenar la vida del hogar: avisos, compras, salud, documentos y más.
            Empecemos: ¿cómo se llama tu hogar?
          </p>
          <input className="input" style={{ width: "100%", marginTop: 12 }} placeholder="Ej: Familia Pérez Soto"
            value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
          <div className="formRow" style={{ marginTop: 14, justifyContent: "space-between" }}>
            <button className="btn" onClick={useSample} disabled={busy}>Probar con familia de muestra</button>
            <button className="btn btnPrimary" onClick={saveName} disabled={busy}>Continuar →</button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="card" style={{ padding: 22 }}>
          <div className="big" style={{ fontSize: 24 }}>¿Quiénes viven en {familyName || "tu hogar"}?</div>
          <p className="small" style={{ marginTop: 6 }}>Agrega a los integrantes. Elige un avatar para cada uno.</p>

          <div className="formRow" style={{ flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
            <input className="input" placeholder="Nombre" value={mName} onChange={(e) => setMName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <select className="input" value={mRel} onChange={(e) => setMRel(e.target.value)}>
              {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn" onClick={addMemberLocal} type="button">Agregar</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {AVATAR_PRESETS.slice(0, 12).map((em) => (
              <button key={em} type="button" onClick={() => setMAvatar(em)}
                style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 20, cursor: "pointer",
                  border: mAvatar === em ? "2px solid #4A7A6B" : "1px solid var(--line)", background: "#FFF8EE" }}>{em}</button>
            ))}
          </div>

          {members.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {members.map((m, i) => {
                const c = memberColor(m.name);
                return (
                  <span key={i} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: c.soft, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{m.avatar}</span>
                    {m.name} · {m.relation}
                    <button onClick={() => setMembers((p) => p.filter((_, j) => j !== i))} style={{ border: 0, background: "transparent", cursor: "pointer" }} aria-label="Quitar">✕</button>
                  </span>
                );
              })}
            </div>
          ) : null}

          <div className="formRow" style={{ marginTop: 16, justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setStep(1)}>← Atrás</button>
            <button className="btn btnPrimary" onClick={saveMembers} disabled={busy}>
              {members.length ? "Guardar y continuar →" : "Saltar por ahora →"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="card" style={{ padding: 22 }}>
          <div className="big" style={{ fontSize: 24 }}>Esto es lo que Domi organiza por ti</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
            {[
              { i: "📣", t: "Mural", d: "Avisos de la familia" },
              { i: "🛒", t: "Compras", d: "Lista y carro tentativo" },
              { i: "🌞", t: "Actividades", d: "El día de cada integrante" },
              { i: "❤️", t: "Salud", d: "Medicamentos y controles" },
              { i: "📄", t: "Documentos", d: "Recetas, boletas, circulares" },
              { i: "💰", t: "Presupuesto", d: "Gastos y vencimientos" },
            ].map((x) => (
              <div key={x.t} className="card" style={{ padding: 12, background: "var(--bg)" }}>
                <div style={{ fontWeight: 700 }}>{x.i} {x.t}</div>
                <div className="small" style={{ color: "var(--muted)" }}>{x.d}</div>
              </div>
            ))}
          </div>
          {msg ? <div className="small" style={{ marginTop: 10, color: "var(--muted)" }}>{msg}</div> : null}
          <div className="formRow" style={{ marginTop: 16, justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setStep(2)}>← Atrás</button>
            <button className="btn btnPrimary" onClick={() => setStep(4)}>Continuar →</button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="card" style={{ padding: 22 }}>
          <div className="big" style={{ fontSize: 24 }}>¡Listo! Invita al resto de la familia 🎉</div>
          <p className="small" style={{ marginTop: 6 }}>
            Comparte el acceso para que cada integrante vea lo suyo y aporte. (Opcional, puedes hacerlo después.)
          </p>
          <div className="formRow" style={{ marginTop: 12, gap: 8 }}>
            <input className="input" type="email" placeholder="correo@ejemplo.com" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button className="btn" onClick={makeInvite} disabled={busy}>Crear invitación</button>
          </div>
          {inviteLink ? (
            <div className="card" style={{ padding: 12, marginTop: 10, background: "var(--bg)" }}>
              <div className="small" style={{ marginBottom: 6 }}>Comparte este enlace:</div>
              <code style={{ wordBreak: "break-all", fontSize: 12 }}>{inviteLink}</code>
              <div>
                <button className="btn" style={{ marginTop: 8 }} onClick={() => navigator.clipboard?.writeText(inviteLink)}>Copiar enlace</button>
              </div>
            </div>
          ) : null}
          {msg ? <div className="small" style={{ marginTop: 10, color: "var(--muted)" }}>{msg}</div> : null}
          <div className="formRow" style={{ marginTop: 16, justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setStep(3)}>← Atrás</button>
            <button className="btn btnPrimary" onClick={finish}>Entrar a mi hogar →</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
