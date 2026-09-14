"use client";

/**
 * DomiPremiumHome — réplica target-first de la referencia oficial (Referencia A).
 *
 * Shell azul noche premium + header pill + bloque emocional izq + Domi central
 * con nodos orbitando + panel "Tu hogar, en equilibrio" + 4 cards de dominio +
 * dock de voz inferior (micrófono protagonista) + mini-cards. Theme-aware
 * (dawn/day/sunset/night) y estados emocionales de Domi. 100% CSS/SVG.
 *
 * Primero fidelidad visual; los datos reales llegan por props. Voz/intención por
 * reglas locales (sin LLM, sin red). Acciones sensibles → confirmación humana.
 */
import { useEffect, useRef, useState } from "react";
import DomiCore from "./DomiCore";
import type { DomiState } from "./DomiCore";
import DomiCalm from "./DomiCalm";
import DomiIcon, { ModuleKey, MODULE_COLOR } from "./domiIcons";
import { interpret } from "../../lib/domiIntents";
import type { DomiCard, DomiCtx } from "../../lib/domiIntents";
import { DOMI_TOKENS, DOMI_STATES } from "../../lib/domiStateTokens";

type Block =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "domi"; text: string }
  | { id: number; role: "card"; card: DomiCard };

const NODES: { icon: ModuleKey; label: string; sub: string; send: string }[] = [
  { icon: "health", label: "Salud", sub: "Todo bien", send: "medicamento de Elena" },
  { icon: "message", label: "Mensajes", sub: "3 sin leer", send: "qué hay hoy" },
  { icon: "guide", label: "Servicios", sub: "Activos", send: "qué falta hoy" },
  { icon: "calm", label: "Bienestar", sub: "Respirar 1 min", send: "pon música tranquila" },
  { icon: "shopping", label: "Compras", sub: "9 por organizar", send: "agrega leche y pan" },
  { icon: "clipboard", label: "Estudio", sub: "Pendiente hoy", send: "prepara estudio para Diego" },
];

const DEMO_PHRASES = [
  "¿Qué falta hoy?", "Agrega leche, pan y paracetamol", "Recuérdame la medicina de Elena",
  "Prepara estudio para Diego", "Pon música tranquila", "¿Qué documentos faltan revisar?",
];

export default function DomiPremiumHome({
  userName, greeting, cards, suggestions, hid,
}: {
  userName?: string;
  greeting: string;
  cards: DomiCard[];
  suggestions: { label: string; send: string }[];
  hid: string;
}) {
  const [state, setState] = useState<DomiState>("atento");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [visualQa, setVisualQa] = useState(false);
  const [feed, setFeed] = useState<Block[]>([]);
  const idRef = useRef(2);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const ctx: DomiCtx = { userName, cards };
  const tk = DOMI_TOKENS[state];

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const ds = q.get("domiState");
      if (ds && (DOMI_STATES as string[]).includes(ds)) setState(ds as DomiState);
      if (q.get("visualQa") === "1") setVisualQa(true);
    } catch {}
  }, []);
  useEffect(() => { if (feed.length) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [feed]);

  function push(b: { role: "user"; text: string } | { role: "domi"; text: string } | { role: "card"; card: DomiCard }) { setFeed((f) => [...f, { ...(b as any), id: idRef.current++ } as Block]); }

  function handle(text: string) {
    const q = text.trim(); if (!q) return;
    setInput(""); push({ role: "user", text: q }); setState("pensando");
    setTimeout(() => {
      const r = interpret(q, ctx);
      push({ role: "domi", text: r.speech });
      r.cards.forEach((card) => push({ role: "card", card }));
      setState(r.state);
    }, 420);
  }

  function closeVoice() { try { recRef.current?.stop(); } catch {} setListening(false); setVoiceOpen(false); setState((s) => (s === "escuchando" ? "atento" : s)); }
  function speakDemo(t: string) { closeVoice(); handle(t); }
  function startRec() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceNote("Tu navegador no permite voz. Toca una frase o escribe."); return; }
    const rec = new SR(); rec.lang = "es-CL"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => { setListening(true); setVoiceNote(""); };
    rec.onerror = (e: any) => { setListening(false); setVoiceNote(e?.error === "not-allowed" || e?.error === "service-not-allowed" ? "Micrófono bloqueado. Toca el 🔒 → Micrófono → Permitir y recarga." : "No te escuché. Toca una frase o escribe."); };
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript || ""; if (t) speakDemo(t); else setVoiceNote("No te entendí. Toca una frase."); };
    recRef.current = rec; try { rec.start(); } catch { setVoiceNote("No pude abrir el micrófono. Toca una frase."); }
  }
  async function toggleVoice() {
    if (voiceOpen) { closeVoice(); return; }
    setVoiceOpen(true); setVoiceNote("Pidiendo permiso del micrófono…"); setState("escuchando");
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !navigator.mediaDevices?.getUserMedia) { setVoiceNote("Tu navegador no permite voz. Toca una frase o escribe."); return; }
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); startRec(); }
    catch (e: any) { setVoiceNote(e?.name === "NotAllowedError" ? "Micrófono bloqueado. Toca el 🔒 → Micrófono → Permitir y recarga." : "No pude abrir el micrófono. Toca una frase o escribe."); }
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    push({ role: "user", text: `📎 ${f.name}` }); setState("pensando");
    push({ role: "domi", text: "Recibí tu documento. Lo revisaré y te propondré qué hacer." });
    push({ role: "card", card: { kind: "info", title: "Documento recibido", text: `“${f.name}”. Si detecto un medicamento o una cuenta, quedará pendiente de confirmación humana.` } });
    e.target.value = "";
  }

  return (
    <div className="vdHome">
      <div className="vdShell">
        {/* HEADER */}
        <header className="vdHeader">
          <div className="vdBrand"><span className="vdLogo" /><div><div className="vdBrandName">VantDomus Hogar</div><div className="vdBrandSub">Tu hogar, en calma</div></div></div>
          <nav className="vdNavPill">
            <a className="on" href={`/hogar/${hid}`}>Inicio</a>
            <a href={`/recordatorios/${hid}`}>Hoy</a>
            <a href={`/documents/${hid}`}>Documentos</a>
            <a href={`/guia`}>Más</a>
          </nav>
          <div className="vdFamily"><span className="vdAva a1" /><span className="vdAva a2" /><span className="vdAva a3" /><span className="vdFamilyTag">Núcleo familiar</span></div>
        </header>

        {/* HERO: emocional + Domi + equilibrio */}
        <section className="vdHero">
          <div className="vdEmotion">
            <div className="vdHello">{greeting}.</div>
            <div className="vdHelloBig">Estoy <span>contigo</span>.</div>
            <p className="vdEmotionText">Domi orquesta tu hogar para que vivas en calma, conexión y bienestar.</p>
            <div className="vdStatusBadge"><span className="vdStatusDot" />{tk.label.toUpperCase()}<span className="vdStatusMsg">{tk.shortMessage}</span></div>
          </div>

          <div className="vdStage">
            <div className="vdStageGlow" />
            <DomiCore state={state} size={210} constellation={false} />
            <div className="vdPedestal" />
            {NODES.map((n, i) => {
              const a = (-90 + i * 60) * (Math.PI / 180);
              const x = 50 + Math.cos(a) * 44, y = 50 + Math.sin(a) * 40;
              return (
                <button key={n.label} className="vdNode" style={{ left: `${x}%`, top: `${y}%`, ["--nc" as any]: MODULE_COLOR[n.icon] }} onClick={() => handle(n.send)} title={n.label}>
                  <DomiIcon name={n.icon} size={17} color={MODULE_COLOR[n.icon]} strokeWidth={2} />
                  <span className="vdNodeLabel">{n.label}</span>
                  <span className="vdNodeSub">{n.sub}</span>
                </button>
              );
            })}
          </div>

          <aside className="vdEquilibrio">
            <div className="vdEqTitle">Tu hogar, en equilibrio</div>
            <svg className="vdSpark" viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M2 30 L20 24 L38 28 L56 16 L74 20 L92 10 L118 14" /></svg>
            <div className="vdEqText">Todo fluye en calma.</div>
            <button className="vdEqCta" onClick={() => handle("ordenar mi día")}>Ver resumen del día →</button>
          </aside>
        </section>

        {/* CARDS de dominio */}
        <section className="vdCards">
          {cards.filter((c) => c.kind === "action").slice(0, 4).map((c: any, i) => (
            <article key={i} className="vdCard" style={{ ["--cat" as any]: c.color }}>
              <span className="vdCardIcon"><DomiIcon name={c.icon} size={20} color={c.color} strokeWidth={2} /></span>
              <div className="vdCardKicker">{c.kicker}</div>
              <div className="vdCardTitle">{c.title}</div>
              <div className="vdCardText">{c.text}</div>
              <div className="vdCardActions">
                <button className="vdBtnPrimary" onClick={() => handle(c.primary.send)}>{c.primary.label}</button>
                {c.secondary ? <button className="vdBtnGhost" onClick={() => handle(c.secondary.send)}>{c.secondary.label}</button> : null}
              </div>
            </article>
          ))}
        </section>

        {/* Conversación (aparece al interactuar) */}
        {feed.length > 0 ? (
          <section className="vdFeed">
            {feed.map((b) => {
              if (b.role === "user") return <div key={b.id} className="vdMsg vdMsgUser">{b.text}</div>;
              if (b.role === "domi") return <div key={b.id} className="vdMsg vdMsgDomi">{b.text}</div>;
              return <FeedCard key={b.id} card={b.card} onSend={handle} />;
            })}
            <div ref={endRef} />
          </section>
        ) : null}

        {/* Mini cards + dock de voz */}
        <section className="vdBottom">
          <div className="vdMiniCard"><span className="vdMiniIco" style={{ ["--cat" as any]: "#8B6DFF" }}><DomiIcon name="calm" size={15} color="#8B6DFF" strokeWidth={2} /></span><div><div className="vdMiniK">Ambiente sugerido</div><div className="vdMiniT">Noche tranquila</div><div className="vdMiniMeta">22:30 · 21°</div></div></div>

          <div className="vdDock">
            {voiceOpen ? (
              <div className="vdVoicePanel">
                <div className="vdVoiceHead"><span className={`vdVoiceMic${listening ? " on" : ""}`}><Mic /></span><div style={{ flex: 1 }}><b>{listening ? "Te escucho…" : "Hablar con Domi"}</b><div className="vdMuted">{voiceNote || "Di algo, o toca una frase:"}</div></div><button className="vdDockBtn" onClick={closeVoice}>✕</button></div>
                <div className="vdChips">{DEMO_PHRASES.map((p) => <button key={p} className="vdChip" onClick={() => speakDemo(p)}>{p}</button>)}</div>
              </div>
            ) : null}
            <div className="vdDockBar">
              <button className={`vdMicBtn${voiceOpen ? " on" : ""}`} onClick={toggleVoice} aria-label="Hablar con Domi"><Mic /></button>
              <button className="vdDockBtn" onClick={() => fileRef.current?.click()} aria-label="Adjuntar"><Clip /></button>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handle(input); }} placeholder="Habla con Domi o cuéntale qué necesitas…" aria-label="Escribir a Domi" />
              <button className="vdSendBtn" onClick={() => handle(input)} aria-label="Enviar"><Send /></button>
            </div>
            <div className={`vdListening${state === "escuchando" || listening ? " on" : ""}`}><span className="vdWave" /><span className="vdWave" /><span className="vdWave" /> ESCUCHANDO</div>
            <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/*,.pdf,.txt" />
          </div>

          <div className="vdMiniCard vdMiniRight"><span className="vdMiniIco" style={{ ["--cat" as any]: "#5FB98F" }}><DomiIcon name="shield" size={15} color="#5FB98F" strokeWidth={2} /></span><div><div className="vdMiniK">Protección del hogar</div><div className="vdMiniT">Todo en orden</div><div className="vdMiniMeta">Seguridad activa</div></div></div>
        </section>
      </div>

      {visualQa ? (
        <div className="vdQaPanel">
          <div className="vdQaTitle">QA visual · estado de Domi</div>
          <div className="vdChips">{DOMI_STATES.map((s) => <button key={s} className={`vdChip${state === s ? " on" : ""}`} onClick={() => setState(s)}>{DOMI_TOKENS[s].label}</button>)}</div>
        </div>
      ) : null}
    </div>
  );
}

function FeedCard({ card, onSend }: { card: DomiCard; onSend: (t: string) => void }) {
  const [done, setDone] = useState(false);
  if (card.kind === "proposal") return (
    <div className="vdCard vdCardFull"><div className="vdCardTitle">{card.title}</div><div className="vdCardText">{card.text}</div>
      {card.lines?.length ? <ul className="vdCardList">{card.lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
      {card.sensitive ? <div className="vdConfirmNote">🛡️ Esto requiere tu confirmación. Domi no lo hace solo.</div> : null}
      {done ? <div className="vdConfirmNote ok">✓ Confirmado. Lo dejé anotado.</div> : <div className="vdCardActions"><button className="vdBtnPrimary" onClick={() => setDone(true)}>{card.confirmLabel || "Confirmar"}</button><button className="vdBtnGhost" onClick={() => setDone(true)}>Ahora no</button></div>}
    </div>
  );
  if (card.kind === "music") return <div className="vdCard vdCardFull"><DomiCalm title={card.title} /></div>;
  if (card.kind === "breathing") return <div className="vdCard vdCardFull"><div className="vdCardTitle">{card.title}</div><div className="breathDot" /><div className="breathLabel">Inhala al crecer… exhala al achicar.</div></div>;
  if (card.kind === "info") return <div className="vdCard vdCardFull"><div className="vdCardTitle">{card.title}</div><div className="vdCardText">{card.text}</div></div>;
  if (card.kind === "suggestions") return <div className="vdCard vdCardFull"><div className="vdMuted" style={{ marginBottom: 8 }}>Puedo ayudarte con:</div><div className="vdChips">{card.items.map((s) => <button key={s.label} className="vdChip" onClick={() => onSend(s.send)}>{s.label}</button>)}</div></div>;
  if (card.kind === "domi") return <div className="vdMsg vdMsgDomi">{card.text}</div>;
  return null;
}

function Mic() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>); }
function Clip() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5 12.5 20a4.5 4.5 0 0 1-6.4-6.4l8.5-8.5a3 3 0 0 1 4.2 4.2l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1L16 9" /></svg>); }
function Send() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>); }
