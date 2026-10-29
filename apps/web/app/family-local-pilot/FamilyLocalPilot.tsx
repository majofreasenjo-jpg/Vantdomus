"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LOCAL_PILOT_KEY, emptyPilot, restorePilot, planOverview,
  missingIngredients, insertMissingGroceries, suggestStudyPeriod, createSyntheticExample
} from "../../lib/domiLocalFamilyPilot.mjs";
import { LOCAL_PILOT_LIMIT } from "../../lib/domiLocalFamilyPilot.mjs";
import {encodeSyntheticTransfer,decodeSyntheticTransfer} from "../../lib/domiSyntheticTransfer.mjs";

type Member = {id:string;alias:string;studyWindow:"manana"|"tarde"|"noche"};
type Event = {id:string;memberId:string;title:string;kind:"prueba"|"tarea"|"actividad";date:string;time:string;done:boolean};
type Grocery = {id:string;name:string;quantity:string;done:boolean};
type Recipe = {id:string;name:string;ingredients:string[]};
type PilotState = {schema:number;mode:string;members:Member[];events:Event[];groceries:Grocery[];recipes:Recipe[]};
const id=()=>crypto.randomUUID();
const today=()=>new Date().toLocaleDateString("en-CA");
const field:React.CSSProperties={background:"#ffffff",color:"#172237",border:"1px solid #cbd5e1",borderRadius:9,padding:"10px 12px",width:"100%",minWidth:0};
const action:React.CSSProperties={borderRadius:10,padding:"10px 13px",background:"#204caa",color:"#fff",border:0,cursor:"pointer"};
const card:React.CSSProperties={background:"#fff",color:"#172237",border:"1px solid #dae1eb",borderRadius:16,padding:18,boxShadow:"0 4px 14px rgba(20,30,60,.06)"};
export default function FamilyLocalPilot() {
  const [state,setState]=useState<PilotState>(emptyPilot() as PilotState);
  const [ready,setReady]=useState(false);
  const [notice,setNotice]=useState("");
  const [alias,setAlias]=useState("");
  const [studyWindow,setStudyWindow]=useState<Member["studyWindow"]>("tarde");
  const [eventTitle,setEventTitle]=useState("");
  const [eventMember,setEventMember]=useState("");
  const [eventKind,setEventKind]=useState<Event["kind"]>("prueba");
  const [eventDate,setEventDate]=useState("");
  const [eventTime,setEventTime]=useState("");
  const [product,setProduct]=useState("");
  const [recipeName,setRecipeName]=useState("");
  const [ingredients,setIngredients]=useState("");
  const [proposedRecipe,setProposedRecipe]=useState<string|null>(null);
  const [fictionConfirmed,setFictionConfirmed]=useState(false);
  useEffect(()=>{try{setState(restorePilot(localStorage.getItem(LOCAL_PILOT_KEY)) as PilotState);}catch{}setReady(true);},[]);
  useEffect(()=>{if(!ready)return;try{localStorage.setItem(LOCAL_PILOT_KEY,JSON.stringify(state));}catch{setNotice("El navegador bloqueó el guardado local. Puedes seguir usando el ensayo, pero no se garantiza su persistencia.");}},[ready,state]);
  const overview=useMemo(()=>planOverview(state,today()),[state]);
  const memberLabel=(key:string)=>state.members.find(m=>m.id===key)?.alias||"Integrante";
  const addMember=(e:React.FormEvent)=>{e.preventDefault();if(!alias.trim()||state.members.length>=12)return;setState(s=>({...s,members:[...s.members,{id:id(),alias:alias.trim().slice(0,40),studyWindow}]}));setAlias("");};
  const addEvent=(e:React.FormEvent)=>{e.preventDefault();if(!eventTitle.trim()||!eventMember||!eventDate||state.events.length>=150)return;setState(s=>({...s,events:[...s.events,{id:id(),title:eventTitle.trim().slice(0,110),memberId:eventMember,kind:eventKind,date:eventDate,time:eventTime,done:false}]}));setEventTitle("");};
  const addGrocery=(e:React.FormEvent)=>{e.preventDefault();if(!product.trim()||state.groceries.length>=180)return;setState(s=>({...s,groceries:[...s.groceries,{id:id(),name:product.trim().slice(0,75),quantity:"1",done:false}]}));setProduct("");};
  const addRecipe=(e:React.FormEvent)=>{e.preventDefault();const items=ingredients.split(/[,\n]/).map(x=>x.trim()).filter(Boolean).slice(0,30);if(!recipeName.trim()||!items.length||state.recipes.length>=35)return;setState(s=>({...s,recipes:[...s.recipes,{id:id(),name:recipeName.trim().slice(0,100),ingredients:items}]}));setRecipeName("");setIngredients("");};
  const remove=(which:"members"|"events"|"groceries"|"recipes",key:string)=>setState(s=>({...s,[which]:s[which].filter(x=>x.id!==key),...(which==="members"?{events:s.events.filter(x=>x.memberId!==key)}:{})}));
  const confirmIngredients=()=>{if(!proposedRecipe)return;setState(s=>insertMissingGroceries(s,proposedRecipe,id));setProposedRecipe(null);setNotice("Ingredientes pendientes agregados a la lista LOCAL. No se envió ninguna compra ni aviso.");};
  const clearData=()=>{if(!window.confirm("¿Borrar todos los datos ficticios de este navegador?"))return;setState(emptyPilot() as PilotState);setProposedRecipe(null);setNotice("Datos ficticios borrados del ensayo local.");};
  const exportSynthetic=()=>{
    if(!fictionConfirmed){setNotice("Confirma antes que todos los datos utilizados son inventados.");return;}
    try{
      const raw=encodeSyntheticTransfer(state);
      const blob=new Blob([raw],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download="domi-ejemplo-ficticio-"+today()+".json";
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice("Archivo JSON ficticio generado en este navegador. Transfiérelo manualmente si deseas probarlo en otro dispositivo; no existe sincronización automática.");
    }catch{setNotice("No se pudo generar el archivo: los datos no cumplen el formato ficticio estricto o exceden el límite permitido.");}
  };
  const importSynthetic=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const control=e.currentTarget;
    const file=control.files?.[0];control.value="";
    if(!file)return;
    if(!fictionConfirmed){setNotice("Confirma antes que el archivo contiene exclusivamente información inventada.");return;}
    try{
      if(file.size>LOCAL_PILOT_LIMIT)throw Error("FILE_TOO_LARGE");
      const imported=decodeSyntheticTransfer(await file.text()) as PilotState;
      if(!window.confirm("¿Reemplazar los datos ficticios actuales por el contenido del archivo? No se hará ninguna conexión externa."))return;
      setState(imported);
      setProposedRecipe(null);
      setNotice("Ejemplo ficticio importado y validado. Persistirá únicamente en este navegador; no se ha creado una cuenta ni sincronización real.");
    }catch{setNotice("Archivo rechazado: se requiere un JSON ficticio DOMI válido, versión compatible y sin campos adicionales.");}
  };
  if(!ready)return <p style={{padding:24}}>Preparando ensayo local…</p>;
  return <main style={{maxWidth:1100,margin:"28px auto",padding:"0 18px 50px",fontFamily:"system-ui,Arial,sans-serif",color:"#162139"}}>
    <header style={{background:"linear-gradient(125deg,#132b56,#2856ad)",padding:24,color:"white",borderRadius:20,marginBottom:18}}>
      <p style={{margin:"0 0 8px",letterSpacing:2,fontSize:12,fontWeight:800}}>DOMI · ENSAYO LOCAL R84 (BASE R81)</p>
      <h1 style={{fontSize:"clamp(24px,4vw,36px)",margin:"0 0 10px"}}>Tu planificador familiar de prueba</h1>
      <p style={{lineHeight:1.6,maxWidth:850,margin:"0 0 12px"}}>Prueba cómo DOMI coordina horarios, evaluaciones, compras y recetas con integrantes inventados. El contenido queda únicamente en este navegador; funciona sin Render ni inteligencia artificial externa.</p>
      <p style={{background:"#fff1d6",color:"#5b3700",padding:12,borderRadius:10,fontWeight:700,fontSize:14}}>Usa exclusivamente nombres e información ficticios. No hay cuentas, memoria real, sincronización de móvil ni ejecución de acciones externas. No es una beta familiar operativa.</p>
    </header>
    <section style={{...card,marginBottom:18,background:"#eaf2ff"}} aria-label="Ejemplo listo para probar">
      <strong style={{display:"block",fontSize:18}}>Prueba DOMI con un ejemplo ficticio</strong>
      <p style={{margin:"8px 0 12px"}}>Carga dos integrantes inventados, pruebas escolares, un conflicto de horario, una receta y compras. No necesitas escribir datos de tu familia.</p>
      <button type="button" style={action} onClick={()=>{
        if(state.members.length||state.events.length||state.groceries.length||state.recipes.length){
          if(!window.confirm("¿Reemplazar los datos ficticios existentes por el ejemplo?"))return;
        }
        setState(createSyntheticExample(today()) as PilotState);
        setProposedRecipe(null);
        setNotice("Ejemplo ficticio cargado. Revisa el conflicto de horario y confirma los ingredientes faltantes para observar los cambios.");
      }}>Cargar ejemplo ficticio</button>
    </section>
    {notice&&<p role="status" style={{background:"#eaf5ff",borderRadius:9,padding:12}}>{notice}</p>}
    <section aria-label="Resumen" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:18}}>
      {[["Integrantes",state.members.length],["Evaluaciones próximas",overview.upcomingTests.length],["Compras pendientes",overview.pendingGroceries],["Conflictos de horario",overview.conflictPairs.length]].map(([k,v])=><div key={k} style={card}><div style={{fontSize:13,color:"#475569"}}>{k}</div><strong style={{fontSize:29}}>{v}</strong></div>)}
    </section>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,460px),1fr))",gap:16}}>
      <section style={card}><h2>1 · Integrantes ficticios</h2>
        <form onSubmit={addMember} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
          <label>Alias inventado<input style={field} placeholder="Ej.: Alex" value={alias} onChange={e=>setAlias(e.target.value)} required maxLength={40}/></label>
          <label>Mejor hora para estudiar<select style={field} value={studyWindow} onChange={e=>setStudyWindow(e.target.value as Member["studyWindow"])}><option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="noche">Noche</option></select></label>
          <button style={action} type="submit">Agregar integrante</button>
        </form>
        {state.members.length===0?<p>Agrega un integrante inventado para planificar.</p>:<ul>{state.members.map(m=><li key={m.id} style={{marginBottom:8}}><strong>{m.alias}</strong> · Sugerencia estudio: {suggestStudyPeriod(m)} <button type="button" onClick={()=>remove("members",m.id)} aria-label={"Eliminar "+m.alias}>Eliminar</button></li>)}</ul>}
      </section>
      <section style={card}><h2>2 · Pruebas, tareas y horarios</h2>
        <form onSubmit={addEvent} style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}>
          <label style={{gridColumn:"1/-1"}}>Actividad<input style={field} value={eventTitle} onChange={e=>setEventTitle(e.target.value)} placeholder="Ej.: prueba de matemáticas" maxLength={110} required/></label>
          <label>Integrante<select style={field} value={eventMember} onChange={e=>setEventMember(e.target.value)} required><option value="">Seleccionar</option>{state.members.map(m=><option key={m.id} value={m.id}>{m.alias}</option>)}</select></label>
          <label>Tipo<select style={field} value={eventKind} onChange={e=>setEventKind(e.target.value as Event["kind"])}><option value="prueba">Prueba</option><option value="tarea">Tarea</option><option value="actividad">Actividad</option></select></label>
          <label>Fecha<input style={field} type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} required/></label>
          <label>Hora<input style={field} type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)}/></label>
          <button style={action} type="submit" disabled={!state.members.length}>Agregar evento</button>
        </form>
        {state.events.length===0?<p>Los eventos ficticios aparecerán aquí.</p>:<ul>{state.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(ev=><li key={ev.id} style={{padding:"6px 0"}}>
          <label><input type="checkbox" checked={ev.done} onChange={()=>setState(s=>({...s,events:s.events.map(x=>x.id===ev.id?{...x,done:!x.done}:x)}))}/> {ev.date} {ev.time} · {ev.title} ({memberLabel(ev.memberId)})</label> <button onClick={()=>remove("events",ev.id)} type="button">Eliminar</button>
        </li>)}</ul>}
        {overview.conflictPairs.length>0&&<p role="status" style={{padding:12,background:"#fff4cf",borderRadius:8}}><strong>Coincidencias detectadas:</strong> {overview.conflictPairs.map(([a,b])=>a.title+" / "+b.title+" ("+memberLabel(a.memberId)+", "+a.date+" "+a.time+")").join("; ")}</p>}
      </section>
      <section style={card}><h2>3 · Compras</h2><form onSubmit={addGrocery} style={{display:"flex",gap:8}}><input style={field} value={product} onChange={e=>setProduct(e.target.value)} placeholder="Producto ficticio" maxLength={75} required/><button style={action} type="submit">Añadir</button></form>
        {state.groceries.length===0?<p>Tu lista de ensayo está vacía.</p>:<ul>{state.groceries.map(g=><li key={g.id} style={{padding:"5px 0"}}><label><input type="checkbox" checked={g.done} onChange={()=>setState(s=>({...s,groceries:s.groceries.map(x=>x.id===g.id?{...x,done:!x.done}:x)}))}/> {g.name}</label> <button onClick={()=>remove("groceries",g.id)} type="button">Eliminar</button></li>)}</ul>}
      </section>
      <section style={card}><h2>4 · Recetas y faltantes</h2><form onSubmit={addRecipe} style={{display:"grid",gap:9}}><label>Nombre de receta<input style={field} value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Ej.: pasta con verduras" required/></label><label>Ingredientes separados por comas<textarea style={{...field,minHeight:72}} value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder="pasta, tomate, zanahoria" required/></label><button style={action} type="submit">Guardar receta ficticia</button></form>
        {state.recipes.map(r=><div key={r.id} style={{borderTop:"1px solid #ddd",marginTop:13,paddingTop:12}}>
          <strong>{r.name}</strong> <button type="button" onClick={()=>remove("recipes",r.id)}>Eliminar</button>
          <p style={{margin:"7px 0"}}>Faltantes en tu lista: {missingIngredients(r,state.groceries).join(", ")||"Ninguno"}</p>
          <button type="button" style={action} onClick={()=>setProposedRecipe(r.id)}>Proponer ingredientes</button>
        </div>)}
        {proposedRecipe&&<div style={{background:"#fff4d5",padding:12,borderRadius:9,marginTop:14}} role="status"><strong>Confirmación humana</strong><p>¿Agregar los ingredientes faltantes de la receta a la lista local? No se hará ninguna compra externa.</p><button style={action} onClick={confirmIngredients}>Confirmar</button> <button onClick={()=>setProposedRecipe(null)}>Rechazar</button></div>}
      </section>
    </div>
    <section style={{...card,marginTop:16,background:"#f4f8ff"}} aria-label="Transferencia manual de ensayo ficticio">
      <h2>5 · Continuar un ejemplo ficticio en otro navegador</h2>
      <p>R84 permite exportar e importar un archivo JSON local, sin servidores ni cuentas. Debes mover el archivo por tus propios medios. Esto <strong>no es sincronización automática</strong> ni continuidad de identidad o memoria real.</p>
      <label style={{display:"flex",gap:9,alignItems:"flex-start",marginBottom:14,fontWeight:700}}>
        <input type="checkbox" checked={fictionConfirmed} onChange={e=>setFictionConfirmed(e.target.checked)} />
        Confirmo que los nombres, eventos, compras y recetas del ensayo son exclusivamente ficticios y no contienen datos personales reales.
      </label>
      <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
        <button type="button" disabled={!fictionConfirmed} onClick={exportSynthetic} style={{...action,opacity:fictionConfirmed?1:.5}}>Exportar archivo ficticio</button>
        <label style={{fontWeight:700}}>Importar JSON de ensayo
          <input type="file" accept=".json,application/json" disabled={!fictionConfirmed} onChange={importSynthetic} style={{display:"block",marginTop:7,maxWidth:290}} />
        </label>
      </div>
      <p style={{fontSize:12,color:"#475569",marginTop:12}}>La importación exige confirmación antes de reemplazar el estado actual. Se rechazan versiones incompatibles, campos adicionales o archivos superiores a {LOCAL_PILOT_LIMIT} bytes. El archivo queda bajo tu custodia.</p>
    </section>
    <section style={{...card,marginTop:16}}>
      <h2>Resumen que genera DOMI (reglas, no IA)</h2>
      <p>Próximas actividades: {overview.upcoming.length ? overview.upcoming.map(e=>e.date+" "+e.title+" de "+memberLabel(e.memberId)).join("; "):"Ninguna registrada"}. Compras pendientes: {overview.pendingGroceries}.</p>
      {overview.upcomingTests.map(e=><p key={e.id}>Para la prueba <strong>{e.title}</strong> de {memberLabel(e.memberId)} el {e.date}, considera un bloque de repaso {suggestStudyPeriod(state.members.find(m=>m.id===e.memberId))}. Esta sugerencia es orientativa y no modifica el calendario.</p>)}
      <button type="button" onClick={clearData} style={{...action,background:"#963a3a"}}>Borrar datos ficticios de este navegador</button>
      <p style={{fontSize:12,color:"#475569",lineHeight:1.6}}>Almacenamiento local de este navegador. No sincroniza con otros dispositivos, no guarda memoria autobiográfica real y puede desaparecer al borrar datos del navegador. No incluyas información personal.</p>
    </section>
  </main>;
}
