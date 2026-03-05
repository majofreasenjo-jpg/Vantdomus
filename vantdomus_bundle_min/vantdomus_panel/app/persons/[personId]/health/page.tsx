import { getPersonHealthTimeline, setAdherencePlan, healthCheckin } from "@/lib/api";

export default async function PersonHealthPage({ params, searchParams }: { params: { personId: string }, searchParams: { hid?: string } }) {
  const pid = params.personId;
  const hid = searchParams.hid || "";
  const data = await getPersonHealthTimeline(pid);
  const householdId = hid || data.person.household_id;

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>Health timeline</h1>
      <div style={{ color: "#666", marginBottom: 12 }}>
        <b>{data.person.display_name}</b> · person_id {data.person.id}
      </div>

      <form
        action={async (fd: FormData) => {
          "use server";
          const med = String(fd.get("med") || "");
          const times = String(fd.get("times") || "").split(",").map(s => s.trim()).filter(Boolean);
          const mode = String(fd.get("mode") || "none");
          await setAdherencePlan({ household_id: householdId, person_id: pid, med_name: med, reminder_times: times, verification_mode: mode });
        }}
        style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, marginBottom: 12 }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Adherence plan</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="med" defaultValue="Losartan" placeholder="Medication" />
          <input name="times" defaultValue="08:00,20:00" placeholder="08:00,20:00" />
          <select name="mode" defaultValue="none">
            <option value="none">none</option>
            <option value="tap">tap</option>
            <option value="voice">voice</option>
          </select>
          <button type="submit">Save plan</button>
        </div>
      </form>

      <form
        action={async (fd: FormData) => {
          "use server";
          const med = String(fd.get("med") || "");
          const status = String(fd.get("status") || "taken");
          await healthCheckin({ household_id: householdId, person_id: pid, med_name: med, status });
        }}
        style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, marginBottom: 12 }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Medication check-in</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="med" defaultValue="Losartan" placeholder="Medication" />
          <select name="status" defaultValue="taken">
            <option value="taken">taken</option>
            <option value="missed">missed</option>
          </select>
          <button type="submit">Submit</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          Si marcas 2 veces seguidas <b>missed</b>, se creará un <b>alert</b>.
        </div>
      </form>

      {data.items.length === 0 ? <div>Sin eventos de salud aún.</div> : (
        <ul>
          {data.items.map((it: any) => (
            <li key={it.id} style={{ marginBottom: 10 }}>
              {it.summary}
              <div style={{ fontSize: 12, color: "#666" }}>{it.event_type} · {it.occurred_at}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
