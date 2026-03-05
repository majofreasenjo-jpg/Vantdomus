import { createTask, listTasks, markTaskDone, getDashboard } from "@/lib/api";

export default async function Tasks({ params }: { params: { householdId: string } }) {
  const hid = params.householdId;
  const dash = await getDashboard(hid);
  const tasks = await listTasks(hid);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardTitle">Tasks</div>
        <div className="big" style={{ fontSize: 26 }}>Execution Engine</div>
        <div className="small">Asignación, vencimientos, cumplimiento.</div>

        <div style={{ marginTop: 14 }}>
          <form
            className="formRow"
            action={async (fd: FormData) => {
              "use server";
              await createTask(hid, {
                title: String(fd.get("title") || ""),
                due_date: String(fd.get("due_date") || "") || undefined,
                priority: String(fd.get("priority") || "medium"),
                assigned_person_id: String(fd.get("assigned_person_id") || "") || undefined,
                tags: (String(fd.get("tags") || "") || "").split(",").map(s => s.trim()).filter(Boolean),
              });
            }}
          >
            <input className="input" name="title" placeholder="Nueva tarea" style={{ minWidth: 260 }} />
            <input className="input" name="due_date" placeholder="YYYY-MM-DD" style={{ width: 140 }} />
            <select className="input" name="priority" defaultValue="medium">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <select className="input" name="assigned_person_id" defaultValue="">
              <option value="">(sin asignar)</option>
              {dash.persons.map((p: any) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
            <input className="input" name="tags" placeholder="tags (csv)" style={{ width: 160 }} />
            <button className="btn btnPrimary" type="submit">Crear</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="sectionTitle">Listado</div>
        <table className="table">
          <thead>
            <tr><th>Title</th><th>Priority</th><th>Status</th><th>Due</th><th></th></tr>
          </thead>
          <tbody>
            {tasks.items.map((t: any) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>
                  <span className={t.priority === "high" ? "pill bad" : t.priority === "low" ? "pill" : "pill warn"}>
                    {t.priority}
                  </span>
                </td>
                <td className="small">{t.status}</td>
                <td className="small">{t.due_at || "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {t.status !== "done" ? (
                    <form action={async () => { "use server"; await markTaskDone(hid, t.id); }}>
                      <button className="btn" type="submit">Done</button>
                    </form>
                  ) : (
                    <span className="pill good">done</span>
                  )}
                </td>
              </tr>
            ))}
            {tasks.items.length === 0 ? (
              <tr><td colSpan={5} className="small">Sin tareas.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
