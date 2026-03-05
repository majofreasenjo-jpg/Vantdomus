"use client";
import { evalAndPersist } from "../../lib/api";

export function EvalRulesButton({ eventId }: { eventId: string }) {
  return (
    <button
      onClick={async () => { await evalAndPersist(eventId); location.reload(); }}
      style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", marginBottom: 12 }}
    >
      Evaluate & Persist Rules
    </button>
  );
}
