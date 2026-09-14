"use client";

/**
 * DomiCompanion — la pantalla ÚNICA viva del hogar (companion-first).
 *
 * Domi al centro + entrada universal (voz/texto/documento) + tarjetas dinámicas
 * que aparecen según la conversación. No es dashboard: no hay módulos como
 * experiencia principal. Acciones sensibles piden confirmación humana.
 *
 * CP1: voz con Web Speech (si el navegador lo soporta) + entrada texto + subir
 * documento (preview). Interpretación por reglas locales (sin LLM, sin red).
 */
import { useEffect, useRef, useState } from "react";
import DomiCore from "./DomiCore";
import type { DomiState } from "./DomiCore";
import DomiCalm from "./DomiCalm";
import DomiIcon from "./domiIcons";
import { interpret } from "../../lib/domiIntents";
import type { DomiCard, DomiCtx } from "../../lib/domiIntents";
import { DOMI_TOKENS, DOMI_STATES } from "../../lib/domiStateTokens";

type Block =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "domi"; text: string }
  | ({ id: number; role: "card" } & { card: DomiCard });

// Frases demo para "hablarle" a Domi (Opción B mock premium del brief).
const DEMO_PHRASES = [
  "¿Qué falta hoy?",
  "Agrega leche, pan y paracetamol",
  "Recuérdame la medicina de Elena",
  "Prepara estudio para Diego",
  "Pon música tranquila",
  "¿Qué documentos faltan revisar?",
];

export default function DomiCompanion({
  userName, greeting, summary, suggestions, cards,
}: {
  userName?: string;
  greeting: string;
  summary: { title: string; lines: string[] };
  suggestions: { label: string; send: string }[];
  cards: DomiCard[];
}) {
  const [state, setState] = useState<DomiState>("atento");
  const [visualQa, setVisualQa] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [feed, setFeed] = useState<Block[]>([]);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const ctx: DomiCtx = { summary, userName, cards };

  // Inspección manual: ?domiState= fija el estado; ?visualQa=1 muestra el panel QA.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const ds = q.get("domiState");
      if (ds && (DOMI_STATES as string[]).includes(ds)) setState(ds as DomiState);
      if (q.get("visualQa") === "1") setVisualQa(true);
    } catch {}
  }, []);

  // Feed inicial: tarjetas de acción (propuestas de Domi) + acciones sugeridas
  useEffect(() => {
    setFeed([
      ...cards.map((card) => ({ id: idRef.current++, role: "card" as const, card })),
      { id: idRef.current++, role: "card", card: { kind: "suggestions", items: suggestions } },
    ]);
  }, []); // eslint-disable-line

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [feed]);

  function push(b: { role: "user"; text: string } | { role: "domi"; text: string } | { role: "card"; card: DomiCard }) { setFeed((f) => [...f, { ...(b as any), id: idRef.current++ } as Block]); }

  function handle(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    push({ role: "user", text: q });
    setState("pensando");
    // pequeño delay para que se sienta "pensando" (no es red real)
    setTimeout(() => {
      const r = interpret(q, ctx);
      push({ role: "domi", text: r.speech });
      r.cards.forEach((card) => push({ role: "card", card }));
      setState(r.state);
    }, 420);
  }

  function closeVoice() {
    try { recRef.current?.stop(); } catch {}
    setListening(false); setVoiceOpen(false);
    setState((s) => (s === "escuchando" ? "atento" : s));
  }

  function speakDemo(text: string) { closeVoice(); handle(text); }

  function startRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceNote("Tu navegador no permite voz. Toca una frase o escribe."); return; }
    const rec = new SR();
    rec.lang = "es-CL"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => { setListening(true); setVoiceNote(""); };
    rec.onerror = (ev: any) => {
      setListening(false);
      setVoiceNote(ev?.error === "not-allowed" || ev?.error === "service-not-allowed"
        ? "El micrófono está bloqueado. Toca el candado 🔒 de la barra → Micrófono → Permitir, y recarga."
        : "No te escuché bien. Toca una frase o escribe.");
    };
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      if (text) speakDemo(text);
      else setVoiceNote("No te entendí. Toca una frase o escribe.");
    };
    recRef.current = rec;
    try { rec.start(); } catch { setListening(false); setVoiceNote("No pude abrir el micrófono. Toca una frase o escribe."); }
  }

  // Abre el panel de voz: pide permiso de micrófono EXPLÍCITAMENTE (provoca el
  // cuadro del navegador), luego escucha de verdad. Si no hay permiso/soporte,
  // SIEMPRE quedan las frases demo (Opción B "mock premium").
  async function openVoice() {
    if (voiceOpen) { closeVoice(); return; }
    setVoiceOpen(true); setVoiceNote("Pidiendo permiso del micrófono…"); setState("escuchando");
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceNote("Tu navegador no permite voz. Toca una frase o escribe."); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceNote("Este contexto no permite micrófono (¿no es localhost/https?). Toca una frase o escríbeme.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // soltar el mic; el reconocedor lo reabre
      startRecognition();
    } catch (err: any) {
      const name = err?.name || "error";
      setVoiceNote(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Micrófono BLOQUEADO. Toca el 🔒 de la barra → Micrófono → Permitir, y recarga."
          : name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "No detecté ningún micrófono conectado. Conéctalo o toca una frase."
          : name === "NotReadableError"
          ? "El micrófono está en uso por otra app. Ciérrala e intenta de nuevo."
          : `No pude abrir el micrófono (${name}). Toca una frase o escríbeme.`
      );
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    push({ role: "user", text: `📎 ${f.name}` });
    setState("pensando");
    push({ role: "domi", text: "Recibí tu documento. Lo revisaré y te propondré qué hacer." });
    push({ role: "card", card: { kind: "info", title: "Documento recibido", text: `“${f.name}”. Si detecto un medicamento o una cuenta, quedará pendiente de confirmación humana antes de actuar.` } });
    e.target.value = "";
  }

  return (
    <div className="companion">
      {/* DOMI CENTRAL — fijo arriba (sticky) para que siempre se vea */}
      <div className="companionStage">
        <DomiCore state={state} size={150} />
        <div className="companionGreet">{greeting}{userName ? `, ${userName}` : ""}. Estoy contigo.</div>
        <div className="companionSub">{DOMI_TOKENS[state].shortMessage}</div>
        <div className="companionState">{DOMI_TOKENS[state].label}</div>
      </div>

      {visualQa ? (
        <div className="vdQaPanel">
          <div className="vdQaTitle">QA visual · estado de Domi</div>
          <div className="suggRow">
            {DOMI_STATES.map((s) => (
              <button key={s} className={`suggChip${state === s ? " on" : ""}`} onClick={() => setState(s)}>{DOMI_TOKENS[s].label}</button>
            ))}
          </div>
        </div>
      ) : null}

      {/* FEED DE TARJETAS */}
      <div className="cardFeed">
        {feed.map((b) => {
          if (b.role === "user") return <div key={b.id} className="dcard" style={{ alignSelf: "flex-end", background: "#4A7A6B", color: "#fff", maxWidth: "85%" }}>{b.text}</div>;
          if (b.role === "domi") return <div key={b.id} className="dcard dcard--domi"><div className="dcardText">{b.text}</div></div>;
          return <CardView key={b.id} card={(b as any).card} onSend={handle} onUpload={() => fileRef.current?.click()} />;
        })}
        <div ref={endRef} />
      </div>

      {/* ENTRADA UNIVERSAL */}
      <div className="composer">
        {voiceOpen ? (
          <div className="voicePanel">
            <div className="voicePanelHead">
              <span className={`voiceMic${listening ? " on" : ""}`}><MicIcon /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{listening ? "Te escucho…" : "Hablar con Domi"}</div>
                <div className="dcardMuted">{voiceNote || "Di algo, o toca una frase:"}</div>
              </div>
              <button className="composerBtn" aria-label="Cerrar" onClick={closeVoice}>✕</button>
            </div>
            <div className="suggRow" style={{ marginTop: 10 }}>
              {DEMO_PHRASES.map((p) => <button key={p} className="suggChip" onClick={() => speakDemo(p)}>{p}</button>)}
            </div>
          </div>
        ) : null}
        <div className="composerBar">
          <button className={`composerBtn mic${voiceOpen ? " on" : ""}`} title="Hablar con Domi" aria-label="Hablar con Domi" onClick={openVoice}>
            <MicIcon />
          </button>
          <button className="composerBtn" title="Subir documento" aria-label="Subir documento" onClick={() => fileRef.current?.click()}>
            <ClipIcon />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handle(input); }}
            placeholder="Habla con Domi o cuéntale qué necesitas…"
            aria-label="Escribir a Domi"
          />
          <button className="composerBtn send" title="Enviar" aria-label="Enviar" onClick={() => handle(input)}>
            <SendIcon />
          </button>
        </div>
        <div className="composerHint">Domi propone y resume. Salud, medicamentos y finanzas los confirmas tú.</div>
        <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/*,.pdf,.txt" />
      </div>
    </div>
  );
}

function CardView({ card, onSend, onUpload }: { card: DomiCard; onSend: (t: string) => void; onUpload: () => void }) {
  const [done, setDone] = useState(false);
  if (card.kind === "action") {
    return (
      <div className="dcard acard" style={{ ["--cat" as any]: card.color }}>
        <span className="acardIcon"><DomiIcon name={card.icon} size={21} color={card.color} strokeWidth={2} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="acardKicker">{card.kicker}</div>
          <div className="dcardTitle">{card.title}</div>
          <div className="dcardText">{card.text}</div>
          <div className="dcardActions">
            <button className="dbtn dbtnPrimary" onClick={() => onSend(card.primary.send)}>{card.primary.label}</button>
            {card.secondary ? <button className="dbtn dbtnGhost" onClick={() => onSend(card.secondary!.send)}>{card.secondary.label}</button> : null}
          </div>
        </div>
      </div>
    );
  }
  if (card.kind === "summary") {
    return (
      <div className="dcard">
        <div className="dcardTitle">{card.title}</div>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          {card.lines.map((l, i) => <li key={i} className="dcardText">{l}</li>)}
        </ul>
      </div>
    );
  }
  if (card.kind === "suggestions") {
    return (
      <div className="dcard">
        <div className="dcardMuted" style={{ marginBottom: 8 }}>Puedo ayudarte con:</div>
        <div className="suggRow">
          {card.items.map((s) => <button key={s.label} className="suggChip" onClick={() => onSend(s.send)}>{s.label}</button>)}
        </div>
      </div>
    );
  }
  if (card.kind === "proposal") {
    return (
      <div className="dcard dcard--proposal">
        <div className="dcardTitle">{card.title}</div>
        <div className="dcardText">{card.text}</div>
        {card.lines?.length ? (
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
            {card.lines.map((l, i) => <li key={i} className="dcardText">{l}</li>)}
          </ul>
        ) : null}
        {card.sensitive ? <div className="confirmNote">🛡️ Esto requiere tu confirmación. Domi no lo hace solo.</div> : null}
        {done ? (
          <div className="confirmNote" style={{ color: "#2E7D55" }}>✓ Confirmado. Lo dejé anotado.</div>
        ) : (
          <div className="dcardActions">
            <button className="btn" style={{ background: "#4A7A6B", color: "#fff" }} onClick={() => setDone(true)}>{card.confirmLabel || "Confirmar"}</button>
            <button className="btn" onClick={() => setDone(true)}>Ahora no</button>
          </div>
        )}
      </div>
    );
  }
  if (card.kind === "music") return <div className="dcard"><DomiCalm title={card.title} /></div>;
  if (card.kind === "breathing") {
    return (
      <div className="dcard">
        <div className="dcardTitle">{card.title}</div>
        <div className="breathDot" />
        <div className="breathLabel">Inhala al crecer… exhala al achicar.</div>
      </div>
    );
  }
  if (card.kind === "info") return <div className="dcard"><div className="dcardTitle">{card.title}</div><div className="dcardText">{card.text}</div></div>;
  if (card.kind === "domi") return <div className="dcard dcard--domi"><div className="dcardText">{card.text}</div></div>;
  return null;
}

function MicIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>); }
function ClipIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5 12.5 20a4.5 4.5 0 0 1-6.4-6.4l8.5-8.5a3 3 0 0 1 4.2 4.2l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1L16 9" /></svg>); }
function SendIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>); }
