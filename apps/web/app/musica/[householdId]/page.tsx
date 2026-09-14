/**
 * OPS-2 M10 — MUSIC-0: Música de la familia.
 * Biblioteca de enlaces musicales por momento (calma/energía/estudio/dormir/
 * fiesta). Abrir siempre es acción explícita; sin OAuth ni contraseñas.
 */
import { getDashboard } from "../../../lib/api";
import DomiOrb from "../../components/DomiOrb";
import FamilyMusic from "../../components/FamilyMusic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MusicaPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const dash = await getDashboard(hid).catch(() => null);
  const familyName = dash?.household?.meta?.family_name || "Tu hogar";

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DomiOrb state="sereno" size={48} showChips={false} />
          <div>
            <div className="small">{familyName}</div>
            <div className="big" style={{ fontSize: 28 }}>Música</div>
          </div>
        </div>
        <a className="btn" href={`/hogar/${hid}`}>← Panel del hogar</a>
      </div>

      <FamilyMusic hid={hid} />
    </div>
  );
}
