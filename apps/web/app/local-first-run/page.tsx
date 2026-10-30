import { notFound } from "next/navigation";
import { r87LocalFirstRunEnabled } from "../../lib/domiR87LocalFirstRun.mjs";
import { createFictionalHousehold } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {title:"DOMI — alta local ficticia",robots:{index:false,follow:false}};

export default async function LocalFirstRun({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if (!r87LocalFirstRunEnabled()) notFound();
  const {error} = await searchParams;
  return <main style={{maxWidth:540,margin:"8vh auto",padding:24,fontFamily:"system-ui"}}>
    <h1>DOMI · Primer ingreso local</h1>
    <p>Entorno exclusivamente ficticio en este computador. Sin sincronización, sin datos familiares reales ni inteligencia artificial externa.</p>
    {error ? <p role="alert" style={{color:"#ad3131"}}>{error==="invalid"?"Verifica el alias, la contraseña y la confirmación de datos inventados.":"No se completó la configuración. Si el registro ya fue creado, usa el acceso normal. No se ha reiniciado ni borrado la base."}</p>:null}
    <form action={createFictionalHousehold} style={{display:"grid",gap:14}}>
      <label>Alias inventado (3–20 letras, números o guiones)
        <input name="alias" required minLength={3} maxLength={20} pattern="[a-z][a-z0-9-]{2,19}" autoComplete="off" style={{display:"block",width:"100%",padding:12}} placeholder="ejemplo-alex"/>
      </label>
      <label>Contraseña de ensayo (12 o más caracteres; combinación segura)
        <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" style={{display:"block",width:"100%",padding:12}}/>
      </label>
      <label><input type="checkbox" name="fictional" value="yes" required/> Confirmo que solo utilizaré información ficticia.</label>
      <button type="submit" style={{padding:12,fontWeight:700}}>Crear hogar ficticio local</button>
    </form>
    <p>¿Ya creaste el hogar de ensayo? <a href="/login">Entrar con tu alias@example.invalid y contraseña</a>.</p>
    <small>El registro real permanece cerrado en los perfiles familiares de despliegue. Esta herramienta solo existe en desarrollo local.</small>
  </main>;
}
