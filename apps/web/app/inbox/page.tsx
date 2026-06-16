import { listLogbookEntries } from "../../lib/api";
import BuzonClient from "./BuzonClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InboxPage() {
  const householdId = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "288e2700-07df-4217-993a-3a4087ac3657";

  let data = { items: [] };
  try {
    data = await listLogbookEntries(householdId);
  } catch (err) {
    console.error("Failed to load inbox entries", err);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ color: "#081a2d", fontSize: 32, margin: 0, fontWeight: "800" }}>Buzon de Evidencia</h1>
          <p style={{ color: "#666", margin: "4px 0 0" }}>Centro de instrucciones y evidencia VantDomus</p>
        </div>
        <div style={{ background: "#d4af37", color: "#fff", padding: "8px 16px", borderRadius: 20, fontWeight: "bold" }}>
          Cliente activo
        </div>
      </header>

      <BuzonClient householdId={householdId} initialEntries={data.items} />
    </main>
  );
}
