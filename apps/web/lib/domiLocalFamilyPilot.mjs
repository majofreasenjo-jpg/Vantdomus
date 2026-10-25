/**
 * R81 LOCAL PILOT — explicit synthetic-only, single-browser Family utility.
 * No API, no external model, no authentication, no cross-device sync.
 * Never treat this data as production DOMI memory or household authority.
 */
export const LOCAL_PILOT_KEY = "domi-r81-synthetic-family-local-v1";
export const LOCAL_PILOT_SCHEMA = 1;
export const LOCAL_PILOT_LIMIT = 80000;

export function emptyPilot() {
  return { schema: LOCAL_PILOT_SCHEMA, mode: "synthetic_only", members: [], events: [], groceries: [], recipes: [] };
}
export function norm(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function safeText(value, max = 90) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null;
}
function dateOrBlank(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value+"T12:00:00Z").getTime()) ? value : "";
}
function timeOrBlank(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";
}
export function restorePilot(raw) {
  if (!raw || raw.length > LOCAL_PILOT_LIMIT) return emptyPilot();
  try {
    const p = JSON.parse(raw);
    if (p?.schema !== LOCAL_PILOT_SCHEMA || p.mode !== "synthetic_only" ||
      !Array.isArray(p.members) || !Array.isArray(p.events) ||
      !Array.isArray(p.groceries) || !Array.isArray(p.recipes)) return emptyPilot();
    const members=p.members.slice(0,12).map(m=>({
      id:safeId(m?.id), alias:safeText(m?.alias,40),
      studyWindow:["manana","tarde","noche"].includes(m?.studyWindow) ? m.studyWindow : "tarde"
    })).filter(m=>m.id && m.alias);
    const validIds=new Set(members.map(m=>m.id));
    const events=p.events.slice(0,150).map(e=>({
      id:safeId(e?.id), memberId:safeId(e?.memberId), title:safeText(e?.title,110),
      kind:["prueba","tarea","actividad"].includes(e?.kind)?e.kind:"actividad",
      date:dateOrBlank(e?.date), time:timeOrBlank(e?.time), done:e?.done===true,
    })).filter(e=>e.id && e.title && e.date && validIds.has(e.memberId));
    const groceries=p.groceries.slice(0,180).map(g=>({
      id:safeId(g?.id), name:safeText(g?.name,75), quantity:safeText(g?.quantity,26)||"1",
      done:g?.done===true,
    })).filter(g=>g.id && g.name);
    const recipes=p.recipes.slice(0,35).map(r=>({
      id:safeId(r?.id), name:safeText(r?.name,100),
      ingredients:Array.isArray(r?.ingredients)?r.ingredients.slice(0,30).map(x=>safeText(x,65)).filter(Boolean):[],
    })).filter(r=>r.id && r.name && r.ingredients.length>0);
    return {schema:LOCAL_PILOT_SCHEMA,mode:"synthetic_only",members,events,groceries,recipes};
  } catch { return emptyPilot(); }
}
export function planOverview(state, today) {
  const date=dateOrBlank(today);
  const upcoming=state.events.filter(e=>!e.done && e.date>=date).sort((a,b)=>(a.date+" "+a.time).localeCompare(b.date+" "+b.time));
  const upcomingTests=upcoming.filter(e=>e.kind==="prueba").slice(0,6);
  const conflictPairs=[];
  for(let i=0;i<upcoming.length;i++){
    for(let j=i+1;j<upcoming.length;j++){
      const a=upcoming[i],b=upcoming[j];
      if(a.date===b.date && a.memberId===b.memberId && a.time && b.time && a.time===b.time) conflictPairs.push([a,b]);
    }
  }
  return {
    upcoming:upcoming.slice(0,12),upcomingTests,conflictPairs:conflictPairs.slice(0,10),
    pendingGroceries:state.groceries.filter(g=>!g.done).length,
    doneEvents:state.events.filter(e=>e.done).length
  };
}
export function missingIngredients(recipe, groceries) {
  const existing=new Set(groceries.map(g=>norm(g.name)));
  return recipe.ingredients.filter(ingredient=>!existing.has(norm(ingredient)));
}
export function suggestStudyPeriod(member) {
  return {manana:"09:00–10:00",tarde:"16:00–17:00",noche:"19:00–20:00"}[member?.studyWindow]||"16:00–17:00";
}
export function insertMissingGroceries(state, recipeId, createId) {
  const recipe=state.recipes.find(r=>r.id===recipeId);
  if(!recipe) return state;
  const missing=missingIngredients(recipe,state.groceries);
  const room=Math.max(0,180-state.groceries.length);
  return {...state,groceries:state.groceries.concat(missing.slice(0,room).map(name=>({
    id:createId(),name,quantity:"1",done:false,
  })))};
}

/**
 * R82 — one-click, fictional example so the Owner can see real UI behavior
 * immediately, without typing anything personal. Dates follow the selected
 * local reference day; this does not query or read real calendars.
 */
export function createSyntheticExample(referenceDate) {
  const initial = dateOrBlank(referenceDate);
  if (!initial) throw new Error("INVALID_SYNTHETIC_EXAMPLE_DATE");
  const after = days => {
    const d = new Date(initial + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return {
    ...emptyPilot(),
    members: [
      {id:"example-alex",alias:"Alex (ficticio)",studyWindow:"tarde"},
      {id:"example-sam",alias:"Sam (ficticio)",studyWindow:"manana"},
    ],
    events: [
      {id:"example-1",memberId:"example-alex",title:"Prueba de matemáticas",kind:"prueba",date:after(2),time:"10:00",done:false},
      {id:"example-2",memberId:"example-alex",title:"Actividad deportiva",kind:"actividad",date:after(2),time:"10:00",done:false},
      {id:"example-3",memberId:"example-sam",title:"Prueba de historia",kind:"prueba",date:after(4),time:"09:00",done:false},
      {id:"example-4",memberId:"example-alex",title:"Entregar investigación",kind:"tarea",date:after(5),time:"16:00",done:false},
    ],
    groceries:[
      {id:"example-food-1",name:"Pasta",quantity:"1",done:false},
      {id:"example-food-2",name:"Tomate",quantity:"2",done:false},
    ],
    recipes:[
      {id:"example-recipe-1",name:"Pasta con verduras",ingredients:["Pasta","Tomate","Zanahoria","Cebolla"]},
    ],
  };
}
