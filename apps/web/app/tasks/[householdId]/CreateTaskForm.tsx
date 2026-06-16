"use client";

import { useRef } from "react";

export default function CreateTaskForm({ 
  hid, 
  persons, 
  onCreate,
  isFamily = false,
}: { 
  hid: string, 
  persons: any[], 
  onCreate: (fd: FormData) => Promise<void>,
  isFamily?: boolean,
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const personLabel = (p: any) => {
    if (!isFamily) return p.display_name;
    return String(p.display_name || "")
      .replace(/^Supervisor\s+/i, "Responsable de ")
      .replace(/^Técnico de\s+/i, "Integrante de ")
      .replace(/^Tecnico de\s+/i, "Integrante de ");
  };

  return (
    <form
      ref={formRef}
      className="formRow"
      action={async (fd: FormData) => {
        await onCreate(fd);
        formRef.current?.reset();
      }}
    >
      <input className="input" name="title" placeholder={isFamily ? "Nuevo compromiso familiar..." : "Nueva tarea operativa..."} style={{ minWidth: 260 }} required />
      <input type="date" className="input" name="due_date" style={{ width: 140 }} />
      <select className="input" name="priority" defaultValue="medium">
        <option value="low">Baja</option>
        <option value="medium">Media</option>
        <option value="high">Alta</option>
      </select>
      <select className="input" name="assigned_person_id" defaultValue="">
        <option value="">(Sin asignar)</option>
        {persons.map((p: any) => (
          <option key={p.id} value={p.id}>{personLabel(p)}</option>
        ))}
      </select>
      <input className="input" name="tags" placeholder={isFamily ? "salud, colegio..." : "Etiquetas (csv)"} style={{ width: 160 }} />
      <button className="btn btnPrimary" type="submit">Agregar</button>
    </form>
  );
}
