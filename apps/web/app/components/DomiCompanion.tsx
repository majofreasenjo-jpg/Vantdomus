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
import { interpret } from "../../lib/domiIntents";
import type { DomiCard, DomiCtx } from "../../lib/domiIntents";

type Block =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "domi"; text: string }
  | ({ id: number; role: "card" } & { card: DomiCard });

const STATE_LABEL: Record<DomiState, string> = {
  listo: "listo", escuchando: "escuchando", pensando: "pensando",
  acompanando: "acompañando", proponiendo: "proponiendo",
  esperando: "esperando confirmación", calma: "en calma", alerta: "atento",
};

export default function DomiCompanion({
  userName, greeting, summary, suggestions,
}: {
  userName?: string;
  greeting: string;
  summary: { title: string; lines: string[] };
  suggestions: { label: string; send: string }[];
}) {
  const [state, setState] = useState<DomiState>("listo");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [feed, setFeed] = useState<Block[]>([]);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const ctx: DomiCtx = { summary, userName };

  // Tarjetas iniciales: resumen del día + acciones sugeridas
  useEffect(() => {
    setFeed([
      { id: idRef.current++, role: "card", card: { kind: "summary", title: summary.title, lines: summary.lines } },
      { id: idRef.current++, role: "card", card: { kind: "suggestions", items: suggestions } },
    ]);
  }, []); // eslint-disable-line

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [feed]);

  function push(b: Omit<Block, "id">) { setFeed((f) => [...f, { ...(b as any), id: idRef.current++ }]); }

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

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      push({ role: "domi", text: "Tu navegador no permite hablarme por ahora. Escríbeme aquí abajo y te ayudo igual." });
      return;
    }
    if (listening) { try { recRef.current?.stop(); } catch {} return; }
    const rec = new SR();
    rec.lang = "es-CL"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => { setListening(true); setState("escuchando"); push({ role: "domi", text: "Te escucho… dime qué necesitas." }); };
    rec.onerror = (ev: any) => {
      setListening(false); setState("listo");
      push({ role: "domi", text: ev?.error === "not-allowed" || ev?.error === "service-not-allowed"
        ? "Necesito permiso del micrófono para escucharte. Actívalo en el navegador o escríbeme aquí abajo."
        : "No alcancé a escucharte. ¿Me lo escribes?" });
    };
    rec.onend = () => { setListening(false); setState((s) => (s === "escuchando" ? "listo" : s)); };
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      if (text) handle(text);
      else push({ role: "domi", text: "No te entendí bien. ¿Me lo escribes?" });
    };
    recRef.current = rec;
    try { rec.start(); } catch { setListening(false); push({ role: "domi", text: "No pude abrir el micrófono. Escríbeme aquí abajo." }); }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    push({ role: "user", text: `📎 ${f.name}` });
    setState("proponiendo");
    push({ role: "domi", text: "Recibí tu documento. Lo revisaré y te propondré qué hacer." });
    push({ role: "card", card: { kind: "info", title: "Documento recibido", text: `“${f.name}”. Si detecto un medicamento o una cuenta, quedará pendiente de confirmación humana antes de actuar.` } });
    e.target.value = "";
  }

  return (
    <div className="companion">
      {/* DOMI CENTRAL — fijo arriba (sticky) para que siempre se vea */}
      <div className="companionStage">
        <DomiCore state={state} size={132} />
        <div className="companionGreet">{greeting}{userName ? `, ${userName}` : ""}. Estoy atento a tu hogar.</div>
        <div className="companionState">{STATE_LABEL[state]}</div>
      </div>

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
        <div className="composerBar">
          <button className={`composerBtn mic${listening ? " on" : ""}`} title="Hablar con Domi" aria-label="Hablar con Domi" onClick={toggleMic}>
            <MicIcon />
          </button>
          <button className="composerBtn" title="Subir documento" aria-label="Subir documento" onClick={() => fileRef.current?.click()}>
            <ClipIcon />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handle(input); }}
            placeholder="Dile a Domi qué necesitas…"
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
