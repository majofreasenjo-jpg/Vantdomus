"use client";

import { useEffect, useState } from "react";
import {
  ownerBetaChatWithMemory, ownerBetaListMemories, ownerBetaListPersons,
  ownerBetaSaveMemory, type DomiOwnerMemory, type DomiOwnerPerson,
} from "../../lib/api";
import "./owner-private.css";

type Message = { sender: "domi"|"me"; text: string };

export default function OwnerPrivateClient() {
  const [people,setPeople] = useState<DomiOwnerPerson[]>([]);
  const [personId,setPersonId] = useState("");
  const [memories,setMemories] = useState<DomiOwnerMemory[]>([]);
  const [newMemory,setNewMemory] = useState("");
  const [question,setQuestion] = useState("");
  const [consent,setConsent] = useState(false);
  const [messages,setMessages] = useState<Message[]>([]);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [ready,setReady] = useState(false);

  async function refresh() {
    const [p,m] = await Promise.all([ownerBetaListPersons(),ownerBetaListMemories()]);
    setPeople(p.items);
    setPersonId(current => p.items.some(x=>x.id===current) ? current : p.items[0]?.id || "");
    setMemories(m.items);
    setReady(true);
  }

  useEffect(()=>{
    let active=true;
    Promise.all([ownerBetaListPersons(),ownerBetaListMemories()]).then(([p,m])=>{
      if(!active)return;
      setPeople(p.items);
      setPersonId(p.items[0]?.id || "");
      setMemories(m.items);
      setReady(true);
    }).catch(()=>{ if(active)setError("Conexión privada no habilitada. No ingreses datos personales."); });
    return ()=>{active=false};
  },[]);

  async function save() {
    if (!personId || !newMemory.trim() || busy) return;
    setBusy(true);setError("");
    try {
      await ownerBetaSaveMemory(personId,newMemory.trim());
      setNewMemory("");
      await refresh();
    } catch {
      setError("No se pudo guardar el recuerdo. No se almacenó localmente.");
    } finally { setBusy(false); }
  }

  async function talk() {
    if (!question.trim() || busy || !consent) return;
    const text=question.trim();
    setBusy(true);setError("");
    try {
      const result=await ownerBetaChatWithMemory(text,true);
      setMessages(old => [...old,{sender:"me" as const,text},{sender:"domi" as const,text:result.reply}].slice(-20));
      setQuestion("");
      setConsent(false);
    } catch {
      setConsent(false);
      setError("La conversación privada no está disponible o fue rechazada.");
    } finally { setBusy(false); }
  }

  return (
    <main id="domi-owner-private" lang="es">
      <header className="op-head">
        <small>DOMI · OWNER BETA PRIVADA · ACCESO CONTROLADO</small>
        <h1>Tu conversación con DOMI</h1>
        <p>Una interfaz preparada para memoria privada auténtica. Sigue desactivada hasta que se certifique Neon y el acceso personal.</p>
        <a href="/owner-beta">Abrir únicamente la demostración sintética</a>
      </header>
      <div className="op-layout">
        <section className="op-panel" aria-label="Memoria autorizada">
          <h2>Lo que autorizas recordar</h2>
          <p>Esta memoria es privada: no se comparte automáticamente con proveedores de IA.</p>
          <label htmlFor="op-person">Tu perfil autorizado</label>
          <select id="op-person" value={personId} onChange={e=>setPersonId(e.target.value)} disabled={!ready||busy}>
            {people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
          <label htmlFor="op-memory">Nuevo recuerdo</label>
          <textarea id="op-memory" rows={3} maxLength={1200} value={newMemory}
            onChange={e=>setNewMemory(e.target.value)} placeholder="Escribe algo que quieres que DOMI recuerde" />
          <button type="button" onClick={save} disabled={!ready||busy||!personId||!newMemory.trim()}>
            Guardar recuerdo privado
          </button>
          <h3>Recuerdos autorizados</h3>
          <ul className="op-memories">
            {memories.map(m=><li key={m.id}>{m.content}</li>)}
          </ul>
          {ready && memories.length===0 && <p>Aún no hay recuerdos privados.</p>}
          <button type="button" className="op-muted" onClick={()=>{setError("");refresh().catch(()=>setError("No se pudieron recuperar recuerdos."));}} disabled={busy}>Recuperar desde el servidor</button>
        </section>
        <section className="op-panel" aria-label="Conversación privada">
          <h2>Conversemos</h2>
          <p>No se almacena una copia de la conversación en el navegador. Cada respuesta requiere tu permiso para procesar recuerdos.</p>
          <div className="op-messages" aria-live="polite">
            {messages.length===0 && <p>La conversación aparecerá aquí cuando el servicio esté autorizado.</p>}
            {messages.map((m,i)=><p key={i}><strong>{m.sender==="domi"?"DOMI":"Tú"}:</strong> {m.text}</p>)}
          </div>
          <label htmlFor="op-question">Tu mensaje</label>
          <textarea id="op-question" rows={3} maxLength={1200} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="¿Qué recuerdas de mí?" />
          <label className="op-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
            Autorizo enviar hasta seis de mis recuerdos privados más recientes al proveedor de IA únicamente para esta respuesta.
          </label>
          <button type="button" onClick={talk} disabled={!ready||busy||!question.trim()||!consent}>Enviar con mi autorización</button>
          <button type="button" className="op-muted" onClick={()=>setMessages([])}>Limpiar conversación visible</button>
        </section>
      </div>
      {error && <p className="op-error" role="alert">{error}</p>}
      <footer>Sin uso en producción. Neon RLS, autorización del servicio y prueba física pendientes.</footer>
    </main>
  );
}
