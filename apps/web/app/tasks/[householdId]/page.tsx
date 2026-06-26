import { createTask, listTasks, markTaskDone, setTaskStatus, getDashboard } from "../../../lib/api";
import { revalidatePath } from "next/cache";
import CreateTaskForm from "./CreateTaskForm";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";
import SchoolPlannerForm from "./SchoolPlannerForm";
import DomiOrb from "../../components/DomiOrb";

export default async function Tasks({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const dash = await getDashboard(hid);
  const tasks = await listTasks(hid);
  const presetKey = dash.household.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[presetKey] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean(tax.family_mode);
  const personLabel = (p: any) => {
    if (!isFamily) return p.display_name;
    return String(p.display_name || "")
      .replace(/^Supervisor\s+/i, "Responsable de ")
      .replace(/^Técnico de\s+/i, "Integrante de ")
      .replace(/^Tecnico de\s+/i, "Integrante de ");
  };
  const taskTitle = (title: string) => {
    if (!isFamily) return title;
    return String(title || "")
      .replace(/^Accion critica familiar/i, "Pendiente familiar critico")
      .replace(/^Inspección de Rutina$/i, "Rutina familiar registrada")
      .replace(/^Inspeccion de Rutina$/i, "Rutina familiar registrada");
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      {isFamily && <SchoolPlannerForm hid={hid} persons={dash.persons} />}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isFamily ? <DomiOrb state="motivado" size={44} showChips={false} /> : null}
          <div>
            <div className="cardTitle">{isFamily ? "Rutinas y compromisos" : "Tasks"}</div>
            <div className="big" style={{ fontSize: 26 }}>{isFamily ? "Agenda familiar y seguimiento" : "Execution Engine"}</div>
            <div className="small">{isFamily ? "Recordatorios, preparacion escolar, compras, salud, acuerdos y tareas del hogar." : "Asignacion, vencimientos, cumplimiento."}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <CreateTaskForm 
            hid={hid} 
            persons={dash.persons} 
            isFamily={isFamily}
            onCreate={async (fd: FormData) => {
              "use server";
              await createTask(hid, {
                title: String(fd.get("title") || ""),
                due_date: String(fd.get("due_date") || "") || undefined,
                priority: String(fd.get("priority") || "medium"),
                assigned_person_id: String(fd.get("assigned_person_id") || "") || undefined,
                tags: (String(fd.get("tags") || "") || "").split(",").map(s => s.trim()).filter(Boolean),
              });
              revalidatePath(`/tasks/${hid}`);
            }} 
          />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {/* COLUMNA 1: TO DO */}
        <div className="card" style={{ background: "rgba(255,255,255,0.01)", borderStyle: "dashed" }}>
          <div className="sectionTitle" style={{ marginTop: 0 }}>{isFamily ? "Por hacer" : "Pendientes (To Do)"}</div>
          <div className="small" style={{ marginBottom: 12 }}>{isFamily ? "Compromisos y rutinas por coordinar." : "Iniciativas por comenzar."}</div>
          
          <div className="grid" style={{ gap: 10 }}>
            {tasks.items.filter((t: any) => ["open", "todo", "missed", "overdue"].includes(t.status)).map((t: any) => {
              const isOverdue = t.status === "missed" || t.status === "overdue";
              return (
              <div key={t.id} className="card" style={{ padding: 12, border: isOverdue ? "2px solid rgba(255,50,50,0.5)" : "1px solid var(--line)" }}>
                {isOverdue && <div className="small" style={{ color: "#ff5b5b", fontWeight: "bold", marginBottom: 6 }}>⚠️ {t.status.toUpperCase()}</div>}
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className={t.priority === "high" ? "pill bad" : t.priority === "low" ? "pill" : "pill warn"}>
                    {t.priority}
                  </span>
                  <div className="small">{t.due_at ? String(t.due_at).split("T")[0] : ""}</div>
                </div>
                <div style={{ fontWeight: "bold", marginBottom: 8 }}>{taskTitle(t.title)}</div>
                <div className="small" style={{ marginBottom: 12 }}>
                  {isFamily ? "Responsable" : "Resp"}: {dash.persons.find((p: any) => p.id === t.assigned_person_id) ? personLabel(dash.persons.find((p: any) => p.id === t.assigned_person_id)) : "Sin Asignar"}
                </div>
                
                <form action={async () => { "use server"; await setTaskStatus(hid, t.id, "in_progress"); revalidatePath(`/tasks/${hid}`); }}>
                  <button className="btn btnPrimary" type="submit" style={{ width: "100%" }}>{isFamily ? "Comenzar" : "Iniciar Ejecucion"} →</button>
                </form>
              </div>
            )})}
            {tasks.items.filter((t: any) => ["open", "todo", "missed", "overdue"].includes(t.status)).length === 0 && (
              <div className="small" style={{ textAlign: "center", padding: 20 }}>Columna vacía</div>
            )}
          </div>
        </div>

        {/* COLUMNA 2: IN PROGRESS */}
        <div className="card" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}>
          <div className="sectionTitle" style={{ marginTop: 0 }}>{isFamily ? "En curso" : "En Ejecucion (In Progress)"}</div>
          <div className="small" style={{ marginBottom: 12 }}>{isFamily ? "Rutinas o acuerdos activos." : "Trabajo activo."}</div>
          
          <div className="grid" style={{ gap: 10 }}>
            {tasks.items.filter((t: any) => t.status === "in_progress").map((t: any) => (
              <div key={t.id} className="card" style={{ padding: 12, border: "1px solid var(--primary)", boxShadow: "0 0 15px rgba(91,124,250,0.1)" }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className={t.priority === "high" ? "pill bad" : t.priority === "low" ? "pill" : "pill warn"}>
                    {t.priority}
                  </span>
                  <div className="small">{t.due_at ? String(t.due_at).split("T")[0] : ""}</div>
                </div>
                <div style={{ fontWeight: "bold", marginBottom: 8 }}>{taskTitle(t.title)}</div>
                <div className="small" style={{ marginBottom: 12 }}>
                  {isFamily ? "Responsable" : "Resp"}: {dash.persons.find((p: any) => p.id === t.assigned_person_id) ? personLabel(dash.persons.find((p: any) => p.id === t.assigned_person_id)) : "Sin Asignar"}
                </div>
                
                <div className="row">
                  <form action={async () => { "use server"; await setTaskStatus(hid, t.id, "open"); revalidatePath(`/tasks/${hid}`); }} style={{ flex: 1 }}>
                    <button className="btn" type="submit" style={{ width: "100%" }}>Detener</button>
                  </form>
                  <form action={async () => { "use server"; await markTaskDone(hid, t.id); revalidatePath(`/tasks/${hid}`); }} style={{ flex: 1 }}>
                    <button className="btn btnPrimary" type="submit" style={{ width: "100%", background: "var(--good)", borderColor: "var(--good)" }}>Finalizar ✓</button>
                  </form>
                </div>
              </div>
            ))}
            {tasks.items.filter((t: any) => t.status === "in_progress").length === 0 && (
              <div className="small" style={{ textAlign: "center", padding: 20 }}>Sin tareas activas</div>
            )}
          </div>
        </div>

        {/* COLUMNA 3: DONE */}
        <div className="card" style={{ background: "transparent" }}>
          <div className="sectionTitle" style={{ marginTop: 0 }}>{isFamily ? "Completado" : "Completados (Done)"}</div>
          <div className="small" style={{ marginBottom: 12 }}>{isFamily ? "Historial familiar." : "Historial de avance."}</div>
          
          <div className="grid" style={{ gap: 10, opacity: 0.6 }}>
            {tasks.items.filter((t: any) => t.status === "done").map((t: any) => (
              <div key={t.id} className="card" style={{ padding: 12, border: "1px solid var(--line)" }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="pill good">done</span>
                  <div className="small">{t.due_at ? String(t.due_at).split("T")[0] : ""}</div>
                </div>
                <div style={{ textDecoration: "line-through", marginBottom: 8 }}>{taskTitle(t.title)}</div>
                <div className="small">
                  {isFamily ? "Responsable" : "Resp"}: {dash.persons.find((p: any) => p.id === t.assigned_person_id) ? personLabel(dash.persons.find((p: any) => p.id === t.assigned_person_id)) : "Sin Asignar"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
