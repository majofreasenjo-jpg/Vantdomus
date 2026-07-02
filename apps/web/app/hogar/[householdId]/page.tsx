/**
 * U1-COMPANION CP1b-INTEGRATION — Home companion-first (port Google AI Studio).
 *
 * Server Component: obtiene datos REALES del hogar (integrantes, compras) y los
 * pasa al port aprobado (DomiCompanionHome). Si un endpoint falla, el componente
 * usa su fallback demo del prototipo (marcado como demo) — la integración visual
 * no se bloquea por datos.
 *
 * La experiencia visible es la diseñada por Google AI Studio; aquí no se
 * rediseña nada, solo se conecta la arquitectura del repo.
 */
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { getDashboard, shoppingList } from "../../../lib/api";
import DomiCompanionHome, { DomiHomeData } from "../../components/domi/DomiCompanionHome";

// Tipografías del prototipo aprobado, servidas por next/font (sin @import de
// red en runtime). domi.css las consume vía --domi-font-*.
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--domi-font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--domi-font-grotesk", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--domi-font-jetbrains", display: "swap" });

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HogarCompanionPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;

  const [dash, shopping] = await Promise.all([
    getDashboard(hid).catch(() => null),
    shoppingList(hid).catch(() => null),
  ]);

  const data: DomiHomeData = {};

  // Integrantes reales → FamilyMember del prototipo
  const persons = (dash?.persons || []) as any[];
  if (persons.length > 0) {
    data.familyMembers = persons.map((p) => ({
      id: String(p.id),
      name: p.display_name || "Integrante",
      role: p.relation || "Integrante del hogar",
      avatar: (p.display_name || "?").trim().charAt(0).toUpperCase(),
      status: p.status_text || "En casa",
    }));
  }

  // Compras reales → ShoppingItem del prototipo
  const items = (shopping?.items || []) as any[];
  if (items.length > 0) {
    data.shoppingItems = items.map((s) => ({
      id: String(s.id),
      name: s.item_name || "Producto",
      checked: s.status === "bought",
      qty: `${s.quantity ?? 1}${s.unit ? ` ${s.unit}` : " ud"}`,
      category: s.place_hint || s.category || "Supermercado",
    }));
  }

  return (
    <div className={`${inter.variable} ${grotesk.variable} ${jetbrains.variable}`}>
      <DomiCompanionHome data={data} />
    </div>
  );
}
