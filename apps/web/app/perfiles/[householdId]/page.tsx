/**
 * U3 — Perfiles de la familia.
 *
 * Cada integrante puede elegir su avatar (set ilustrado o foto) y su estado del
 * hogar (estilo WhatsApp, nativo y privado). Server component que compone el
 * editor cliente por persona.
 */

import { getDashboard } from "../../../lib/api";
import MemberIdentityEditor from "../../components/MemberIdentityEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PerfilesPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const dash = await getDashboard(hid).catch(() => null);
  const persons: any[] = dash?.persons || [];
  const familyName: string = dash?.household?.meta?.family_name || "Tu hogar";

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
        <div>
          <div className="small">{familyName}</div>
          <div className="big" style={{ fontSize: 28 }}>Perfiles de la familia</div>
        </div>
        <a className="btn" href={`/hogar/${hid}`}>← Panel del hogar</a>
      </div>

      <div className="small" style={{ color: "var(--muted)", marginBottom: 14 }}>
        Cada integrante elige su avatar y su estado. El estado es privado para la familia y se
        comparte solo cuando lo pones (sin seguimiento en segundo plano).
      </div>

      {persons.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="small">Todavía no hay integrantes en este hogar.</div>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {persons.map((p) => (
            <MemberIdentityEditor
              key={p.id}
              personId={p.id}
              name={p.display_name}
              avatar={p.avatar}
              statusEmoji={p.status_emoji}
              statusText={p.status_text}
            />
          ))}
        </div>
      )}
    </div>
  );
}
