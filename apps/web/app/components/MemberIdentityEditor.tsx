"use client";

/**
 * MemberIdentityEditor — elegir avatar (set ilustrado o foto) + estado del hogar.
 *
 * - Avatar: galería estilo Netflix (emoji curado) o subir foto (estilo WhatsApp).
 *   La foto se redimensiona a 128px en el navegador antes de guardarla como
 *   data-url, para no inflar la base de datos.
 * - Estado: estilo WhatsApp pero nativo y privado para la familia (En casa,
 *   En camino, Llegué, Ocupado, Necesito ayuda, o personalizado).
 */

import { useRef, useState } from "react";
import { AVATAR_PRESETS, emojiAvatar, parseAvatar } from "../../lib/avatars";
import { memberColor, initials } from "../../lib/memberColor";
import { personUpdate, personSetStatus, personClearStatus } from "../../lib/api";

const STATUS_PRESETS: { emoji: string; text: string }[] = [
  { emoji: "🏠", text: "En casa" },
  { emoji: "🚗", text: "En camino" },
  { emoji: "✅", text: "Llegué" },
  { emoji: "💼", text: "En el trabajo" },
  { emoji: "🎒", text: "En el colegio" },
  { emoji: "⛔", text: "Ocupado/a" },
  { emoji: "🆘", text: "Necesito ayuda" },
];

async function fileToResizedDataUrl(file: File, max = 128): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function MemberIdentityEditor({
  personId,
  name,
  avatar,
  statusEmoji,
  statusText,
}: {
  personId: string;
  name: string;
  avatar?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [curAvatar, setCurAvatar] = useState<string | null>(avatar || null);
  const [curStatusE, setCurStatusE] = useState<string>(statusEmoji || "");
  const [curStatusT, setCurStatusT] = useState<string>(statusText || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const c = memberColor(personId || name);
  const av = parseAvatar(curAvatar);

  async function saveAvatar(value: string | null) {
    setBusy(true); setMsg(null);
    try {
      await personUpdate(personId, { avatar: value ?? "" });
      setCurAvatar(value);
      setMsg("Avatar actualizado.");
    } catch {
      setMsg("No se pudo guardar el avatar.");
    } finally { setBusy(false); }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const data = await fileToResizedDataUrl(f);
      await personUpdate(personId, { avatar: data });
      setCurAvatar(data);
      setMsg("Foto actualizada.");
    } catch {
      setMsg("No se pudo subir la foto.");
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function saveStatus(emoji: string, text: string) {
    setBusy(true); setMsg(null);
    try {
      if (!emoji && !text) { await personClearStatus(personId); }
      else { await personSetStatus(personId, emoji, text); }
      setCurStatusE(emoji); setCurStatusT(text);
      setMsg("Estado actualizado.");
    } catch {
      setMsg("No se pudo guardar el estado.");
    } finally { setBusy(false); }
  }

  const preview = av.kind === "photo"
    ? <img src={av.src} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
    : av.kind === "emoji"
      ? <span style={{ width: 48, height: 48, borderRadius: "50%", background: c.soft, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{av.char}</span>
      : <span style={{ width: 48, height: 48, borderRadius: "50%", background: c.bg, color: c.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>{initials(name)}</span>;

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {preview}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{name}</div>
          <div className="small" style={{ color: "var(--muted)" }}>
            {curStatusE || curStatusT ? `${curStatusE} ${curStatusT}` : "Sin estado"}
          </div>
        </div>
        <button className="btn" onClick={() => setOpen((v) => !v)}>{open ? "Cerrar" : "Editar"}</button>
      </div>

      {open ? (
        <div style={{ marginTop: 14 }}>
          {msg ? <div className="small" style={{ marginBottom: 8, color: "var(--muted)" }}>{msg}</div> : null}

          <div className="cardTitle">Elegí un avatar</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 6px" }}>
            {AVATAR_PRESETS.map((em) => (
              <button
                key={em}
                disabled={busy}
                onClick={() => saveAvatar(emojiAvatar(em))}
                title={`Usar ${em}`}
                style={{
                  width: 40, height: 40, borderRadius: "50%", fontSize: 22, cursor: "pointer",
                  border: curAvatar === emojiAvatar(em) ? `2px solid ${c.bg}` : "1px solid var(--line)",
                  background: c.soft,
                }}
              >{em}</button>
            ))}
          </div>
          <div className="formRow" style={{ gap: 8, alignItems: "center", marginTop: 6 }}>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>📷 Subir foto</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
            {curAvatar ? <button className="btn" disabled={busy} onClick={() => saveAvatar(null)}>Quitar avatar</button> : null}
          </div>

          <div className="cardTitle" style={{ marginTop: 16 }}>Estado del hogar</div>
          <div className="small" style={{ color: "var(--muted)", marginBottom: 6 }}>
            Visible solo para tu familia. Lo pones y lo sacas cuando quieras (sin ubicación en segundo plano).
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {STATUS_PRESETS.map((s) => (
              <button
                key={s.text}
                disabled={busy}
                onClick={() => saveStatus(s.emoji, s.text)}
                className="pill"
                style={{ cursor: "pointer", borderColor: curStatusT === s.text ? c.bg : "var(--line)" }}
              >{s.emoji} {s.text}</button>
            ))}
          </div>
          <div className="formRow" style={{ gap: 8 }}>
            <input className="input" placeholder="😀" value={curStatusE} maxLength={4}
              onChange={(e) => setCurStatusE(e.target.value)} style={{ width: 64, textAlign: "center" }} />
            <input className="input" placeholder="Estado personalizado…" value={curStatusT}
              onChange={(e) => setCurStatusT(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <button className="btn btnPrimary" disabled={busy} onClick={() => saveStatus(curStatusE, curStatusT)}>Guardar</button>
            {curStatusE || curStatusT ? <button className="btn" disabled={busy} onClick={() => saveStatus("", "")}>Quitar</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
